// Runs payment attempts through the checkout state machine. The reducer decides what state we're
// in; this hook owns the side effects: persisting the attempt, POSTing it, and resolving an
// unknown outcome by replaying the persisted attempt (same idempotency key, so never a 2nd charge).
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { toCardPayload, validateCardForm, type CardForm } from '../lib/cardValidation';
import { checkoutReducer, initialCheckoutState, isBusy, type Failure } from '../lib/checkoutState';
import {
  ApiError,
  isOutcomeUnknown,
  newIdempotencyKey,
  postPayment,
  toReceipt,
  type Order,
  type PaymentResponse,
} from '../lib/paymentsApi';
import {
  attemptFromSnapshot,
  clearSnapshot,
  loadSnapshot,
  persistSnapshot,
  recoverPendingPayment,
  type PaymentSnapshot,
} from '../lib/pendingPayment';

const RECOVERY_BACKOFF_MS = [1000, 2000, 4000, 8000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const NOT_CHARGED_NOTICE = "Your last payment didn't go through. You have not been charged.";

export function useCheckout() {
  const [state, dispatch] = useReducer(checkoutReducer, initialCheckoutState);
  const [notice, setNotice] = useState<string | null>(null);
  // The reducer already ignores a second SUBMIT, but the side effects below must not run twice.
  const inFlight = useRef(false);

  /** Replays the snapshot until the server gives a definitive answer. Stays in "checking" meanwhile. */
  const resolveUnknown = useCallback(async (snapshot: PaymentSnapshot) => {
    for (let attempt = 0; ; attempt++) {
      try {
        const outcome = await recoverPendingPayment(snapshot, postPayment);
        if (outcome.kind === 'not_charged') setNotice(NOT_CHARGED_NOTICE);
        dispatch({ type: 'RECOVERY_RESOLVED', outcome });
        return;
      } catch {
        await sleep(RECOVERY_BACKOFF_MS[Math.min(attempt, RECOVERY_BACKOFF_MS.length - 1)]);
      }
    }
  }, []);

  // Relaunch: a snapshot on disk means the app died with a payment in flight.
  useEffect(() => {
    loadSnapshot().then((snapshot) => {
      if (!snapshot || inFlight.current) return;
      inFlight.current = true;
      dispatch({ type: 'RELAUNCH_WITH_PENDING', method: snapshot.method });
      resolveUnknown(snapshot).finally(() => (inFlight.current = false));
    });
  }, [resolveUnknown]);

  const payWithCard = useCallback(
    async (order: Order, form: CardForm) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setNotice(null);
      try {
        dispatch({ type: 'SUBMIT' });
        if (!validateCardForm(form).valid) {
          dispatch({ type: 'VALIDATION_FAILED' });
          return;
        }
        dispatch({ type: 'VALIDATION_PASSED' });

        const snapshot: PaymentSnapshot = {
          idempotencyKey: newIdempotencyKey(),
          orderId: order.id,
          quantity: order.quantity,
          amountCents: order.pricing.totalCents,
          method: 'card',
        };
        try {
          await persistSnapshot(snapshot);
        } catch {
          dispatch({ type: 'RESULT_DECLINED', failure: { code: 'storage_error', message: GENERIC_FAILURE } });
          return;
        }

        let response: PaymentResponse;
        try {
          response = await postPayment(attemptFromSnapshot(snapshot).attempt, { card: toCardPayload(form) });
        } catch (err) {
          if (isOutcomeUnknown(err)) {
            dispatch({ type: 'RESULT_UNKNOWN' });
            await resolveUnknown(snapshot);
          } else {
            // A 4xx is rejected before any charge is made.
            await clearSnapshot();
            dispatch({ type: 'RESULT_DECLINED', failure: toFailure(err) });
          }
          return;
        }

        await clearSnapshot();
        const { payment } = response;
        dispatch(
          payment.status === 'succeeded'
            ? { type: 'RESULT_SUCCEEDED', receipt: toReceipt(payment) }
            : { type: 'RESULT_DECLINED', failure: { code: payment.failureCode, message: payment.failureMessage } },
        );
      } finally {
        inFlight.current = false;
      }
    },
    [resolveUnknown],
  );

  const retry = useCallback(() => dispatch({ type: 'RETRY' }), []);

  return { state, busy: isBusy(state), notice, payWithCard, retry };
}

const GENERIC_FAILURE = "We couldn't process this payment.";

const toFailure = (err: unknown): Failure => ({
  code: err instanceof ApiError ? err.code : 'unknown',
  message: GENERIC_FAILURE,
});
