// Runs payment attempts through the checkout state machine. The reducer decides what state we're
// in; this hook owns the side effects: persisting the attempt, POSTing it, and resolving an
// unknown outcome by replaying the persisted attempt (same idempotency key, so never a 2nd charge).
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { toCardPayload, validateCardForm, type CardForm } from '../lib/cardValidation';
import { checkoutReducer, initialCheckoutState, isBusy, type Failure } from '../lib/checkoutState';
import type { ExpressMethod } from '../lib/expressAuth';
import {
  ApiError,
  isOutcomeUnknown,
  newIdempotencyKey,
  postPayment,
  toReceipt,
  type Order,
  type PaymentCredentials,
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
// After this many failed replays (~23 s of backoff) the checking overlay reassures the fan; the
// replays carry on at the 8 s cap, and the snapshot stays put until the server answers.
const SLOW_CHECK_AFTER_ATTEMPTS = 5;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const NOT_CHARGED_NOTICE = "Your last payment didn't go through. You have not been charged.";

export function useCheckout() {
  const [state, dispatch] = useReducer(checkoutReducer, initialCheckoutState);
  const [notice, setNotice] = useState<string | null>(null);
  const [slowCheck, setSlowCheck] = useState(false);
  // The reducer already ignores a second SUBMIT, but the side effects below must not run twice.
  const inFlight = useRef(false);
  // Mirrors `state` for callbacks that outlive a render (e.g. the express sheet's authorize timer
  // racing a cancel): the reducer no-ops the stray event, and this ref gates its side effects.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  /** Replays the snapshot until the server gives a definitive answer. Stays in "checking" meanwhile. */
  const resolveUnknown = useCallback(async (snapshot: PaymentSnapshot) => {
    setSlowCheck(false);
    for (let attempt = 0; ; attempt++) {
      try {
        const outcome = await recoverPendingPayment(snapshot, postPayment);
        if (outcome.kind === 'not_charged') setNotice(NOT_CHARGED_NOTICE);
        setSlowCheck(false);
        dispatch({ type: 'RECOVERY_RESOLVED', outcome });
        return;
      } catch {
        if (attempt + 1 >= SLOW_CHECK_AFTER_ATTEMPTS) setSlowCheck(true);
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

  /**
   * Shared tail of every attempt: POST the (already persisted) snapshot and settle the outcome.
   * Expects the reducer to be in `processing` already.
   */
  const runAttempt = useCallback(
    async (snapshot: PaymentSnapshot, credentials: PaymentCredentials) => {
      let response: PaymentResponse;
      try {
        response = await postPayment(attemptFromSnapshot(snapshot).attempt, credentials);
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
    },
    [resolveUnknown],
  );

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

        await runAttempt(snapshot, { card: toCardPayload(form) });
      } finally {
        inFlight.current = false;
      }
    },
    [runAttempt],
  );

  /** Tap on an express button: brings up that method's authorization (sheet / redirect). */
  const startExpress = useCallback((method: ExpressMethod) => {
    if (inFlight.current) return;
    setNotice(null);
    dispatch({ type: 'EXPRESS_START', method });
  }, []);

  /** The fan backed out of the sheet / redirect. Nothing was sent; back to idle, no error UI. */
  const cancelExpress = useCallback(() => dispatch({ type: 'SHEET_CANCELLED' }), []);

  /**
   * The method authorized and handed back a token: persist the attempt (token included, so a
   * relaunch can replay it verbatim), then charge. One interaction end-to-end — nothing here
   * waits for another tap.
   */
  const completeExpress = useCallback(
    async (order: Order, method: ExpressMethod, token: string) => {
      // A cancel may have already landed (reducer would no-op SHEET_AUTHORIZED); skip the charge too.
      if (stateRef.current.status !== 'authorizing' || inFlight.current) return;
      inFlight.current = true;
      try {
        dispatch({ type: 'SHEET_AUTHORIZED' });
        const snapshot: PaymentSnapshot = {
          idempotencyKey: newIdempotencyKey(),
          orderId: order.id,
          quantity: order.quantity,
          amountCents: order.pricing.totalCents,
          method,
          token,
        };
        try {
          await persistSnapshot(snapshot);
        } catch {
          dispatch({ type: 'RESULT_DECLINED', failure: { code: 'storage_error', message: GENERIC_FAILURE } });
          return;
        }

        await runAttempt(snapshot, { token });
      } finally {
        inFlight.current = false;
      }
    },
    [runAttempt],
  );

  const retry = useCallback(() => dispatch({ type: 'RETRY' }), []);
  // Only legal from the confirmation. The pending-payment snapshot is already gone by then:
  // every definitive answer clears it before the success is dispatched.
  const startNewOrder = useCallback(() => {
    setNotice(null);
    dispatch({ type: 'NEW_ORDER' });
  }, []);

  return {
    state,
    busy: isBusy(state),
    notice,
    /** Recovery has been retrying a while (server unreachable): show the reassurance line. */
    stillChecking: state.status === 'checking' && slowCheck,
    payWithCard,
    startExpress,
    cancelExpress,
    completeExpress,
    retry,
    startNewOrder,
  };
}

const GENERIC_FAILURE = "We couldn't process this payment.";

const toFailure = (err: unknown): Failure => ({
  code: err instanceof ApiError ? err.code : 'unknown',
  message: GENERIC_FAILURE,
});
