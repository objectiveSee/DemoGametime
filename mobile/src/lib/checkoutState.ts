// Checkout state machine. Pure: the reducer never performs side effects, and an event that is
// illegal in the current state returns the same state object (a no-op), so a stray double-tap or
// a late callback can't move checkout somewhere it shouldn't be.
import type { PaymentMethod } from './eligibility';

export type Failure = { code: string; message: string };

export type Receipt = { paymentId: string; confirmationCode: string; amountCents: number; method: PaymentMethod };

export type CheckoutState =
  | { status: 'idle' }
  /** Card submit pressed; client-side validation running. */
  | { status: 'validating' }
  /** Express wallet sheet / Affirm redirect is up; nothing has been sent to the server. */
  | { status: 'authorizing'; method: PaymentMethod }
  /** POST /payments in flight. */
  | { status: 'processing'; method: PaymentMethod }
  /** Outcome unknown (relaunched with a pending payment, or the request lost its response). */
  | { status: 'checking'; method: PaymentMethod }
  | { status: 'succeeded'; receipt: Receipt }
  | { status: 'declined'; method: PaymentMethod; failure: Failure };

export type RecoveryOutcome =
  | { kind: 'succeeded'; receipt: Receipt }
  | { kind: 'declined'; failure: Failure }
  /** The server never charged this attempt; it's safe to start over. */
  | { kind: 'not_charged' };

export type CheckoutEvent =
  | { type: 'SUBMIT' }
  | { type: 'VALIDATION_PASSED' }
  | { type: 'VALIDATION_FAILED' }
  | { type: 'EXPRESS_START'; method: PaymentMethod }
  | { type: 'SHEET_CANCELLED' }
  | { type: 'SHEET_AUTHORIZED' }
  | { type: 'RESULT_SUCCEEDED'; receipt: Receipt }
  | { type: 'RESULT_DECLINED'; failure: Failure }
  | { type: 'RESULT_UNKNOWN' }
  | { type: 'RELAUNCH_WITH_PENDING'; method: PaymentMethod }
  | { type: 'RECOVERY_RESOLVED'; outcome: RecoveryOutcome }
  | { type: 'RETRY' }
  /** "Start new order" from the confirmation: the purchase is done, checkout starts fresh. */
  | { type: 'NEW_ORDER' };

export const initialCheckoutState: CheckoutState = { status: 'idle' };

/** Idle and declined are the resting states a fan can start a new attempt from. */
const canStart = (state: CheckoutState) => state.status === 'idle' || state.status === 'declined';

export function checkoutReducer(state: CheckoutState, event: CheckoutEvent): CheckoutState {
  switch (event.type) {
    case 'SUBMIT':
      return canStart(state) ? { status: 'validating' } : state;
    case 'VALIDATION_PASSED':
      return state.status === 'validating' ? { status: 'processing', method: 'card' } : state;
    case 'VALIDATION_FAILED':
      return state.status === 'validating' ? { status: 'idle' } : state;
    case 'EXPRESS_START':
      return canStart(state) && event.method !== 'card' ? { status: 'authorizing', method: event.method } : state;
    case 'SHEET_CANCELLED':
      return state.status === 'authorizing' ? { status: 'idle' } : state;
    case 'SHEET_AUTHORIZED':
      return state.status === 'authorizing' ? { status: 'processing', method: state.method } : state;
    case 'RESULT_SUCCEEDED':
      return state.status === 'processing' ? { status: 'succeeded', receipt: event.receipt } : state;
    case 'RESULT_DECLINED':
      return state.status === 'processing'
        ? { status: 'declined', method: state.method, failure: event.failure }
        : state;
    case 'RESULT_UNKNOWN':
      return state.status === 'processing' ? { status: 'checking', method: state.method } : state;
    case 'RELAUNCH_WITH_PENDING':
      return state.status === 'idle' ? { status: 'checking', method: event.method } : state;
    case 'RECOVERY_RESOLVED': {
      if (state.status !== 'checking') return state;
      const { outcome } = event;
      if (outcome.kind === 'succeeded') return { status: 'succeeded', receipt: outcome.receipt };
      if (outcome.kind === 'declined') return { status: 'declined', method: state.method, failure: outcome.failure };
      return { status: 'idle' };
    }
    case 'RETRY':
      return state.status === 'declined' ? { status: 'idle' } : state;
    case 'NEW_ORDER':
      return state.status === 'succeeded' ? initialCheckoutState : state;
  }
}

/** True while an attempt is underway: inputs, method rows and pay buttons should be locked. */
export const isBusy = (state: CheckoutState) =>
  state.status === 'validating' ||
  state.status === 'authorizing' ||
  state.status === 'processing' ||
  state.status === 'checking';
