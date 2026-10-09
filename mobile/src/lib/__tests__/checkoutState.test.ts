import {
  checkoutReducer,
  initialCheckoutState,
  isBusy,
  type CheckoutEvent,
  type CheckoutState,
  type Receipt,
} from '../checkoutState';

const receipt: Receipt = { paymentId: 'pay_1', confirmationCode: 'GT-ABC123', amountCents: 13590, method: 'card' };
const failure = { code: 'card_declined', message: 'Your card was declined.' };

const S = {
  idle: { status: 'idle' },
  validating: { status: 'validating' },
  authorizing: { status: 'authorizing', method: 'apple_pay' },
  processingCard: { status: 'processing', method: 'card' },
  processingExpress: { status: 'processing', method: 'apple_pay' },
  checking: { status: 'checking', method: 'affirm' },
  succeeded: { status: 'succeeded', receipt },
  declined: { status: 'declined', method: 'card', failure },
} satisfies Record<string, CheckoutState>;

const E = {
  SUBMIT: { type: 'SUBMIT' },
  VALIDATION_PASSED: { type: 'VALIDATION_PASSED' },
  VALIDATION_FAILED: { type: 'VALIDATION_FAILED' },
  EXPRESS_START: { type: 'EXPRESS_START', method: 'apple_pay' },
  SHEET_CANCELLED: { type: 'SHEET_CANCELLED' },
  SHEET_AUTHORIZED: { type: 'SHEET_AUTHORIZED' },
  RESULT_SUCCEEDED: { type: 'RESULT_SUCCEEDED', receipt },
  RESULT_DECLINED: { type: 'RESULT_DECLINED', failure },
  RESULT_UNKNOWN: { type: 'RESULT_UNKNOWN' },
  RELAUNCH_WITH_PENDING: { type: 'RELAUNCH_WITH_PENDING', method: 'google_pay' },
  RECOVERY_RESOLVED: { type: 'RECOVERY_RESOLVED', outcome: { kind: 'succeeded', receipt } },
  RETRY: { type: 'RETRY' },
  NEW_ORDER: { type: 'NEW_ORDER' },
} satisfies Record<string, CheckoutEvent>;

type StateName = keyof typeof S;
type EventName = keyof typeof E;

// Every legal transition. Any (state, event) pair not listed here must be a no-op.
const TRANSITIONS: [StateName, EventName, CheckoutState][] = [
  ['idle', 'SUBMIT', { status: 'validating' }],
  ['declined', 'SUBMIT', { status: 'validating' }],
  ['validating', 'VALIDATION_PASSED', { status: 'processing', method: 'card' }],
  ['validating', 'VALIDATION_FAILED', { status: 'idle' }],
  ['idle', 'EXPRESS_START', { status: 'authorizing', method: 'apple_pay' }],
  ['declined', 'EXPRESS_START', { status: 'authorizing', method: 'apple_pay' }],
  ['authorizing', 'SHEET_CANCELLED', { status: 'idle' }],
  ['authorizing', 'SHEET_AUTHORIZED', { status: 'processing', method: 'apple_pay' }],
  ['processingCard', 'RESULT_SUCCEEDED', { status: 'succeeded', receipt }],
  ['processingExpress', 'RESULT_SUCCEEDED', { status: 'succeeded', receipt }],
  ['processingCard', 'RESULT_DECLINED', { status: 'declined', method: 'card', failure }],
  ['processingExpress', 'RESULT_DECLINED', { status: 'declined', method: 'apple_pay', failure }],
  ['processingCard', 'RESULT_UNKNOWN', { status: 'checking', method: 'card' }],
  ['processingExpress', 'RESULT_UNKNOWN', { status: 'checking', method: 'apple_pay' }],
  ['idle', 'RELAUNCH_WITH_PENDING', { status: 'checking', method: 'google_pay' }],
  ['checking', 'RECOVERY_RESOLVED', { status: 'succeeded', receipt }],
  ['declined', 'RETRY', { status: 'idle' }],
  ['succeeded', 'NEW_ORDER', { status: 'idle' }],
];

describe('checkoutReducer', () => {
  it('starts idle', () => {
    expect(initialCheckoutState).toEqual({ status: 'idle' });
  });

  it.each(TRANSITIONS)('%s + %s', (state, event, expected) => {
    expect(checkoutReducer(S[state], E[event])).toEqual(expected);
  });

  describe('illegal events are no-ops (same object returned)', () => {
    const legal = new Set(TRANSITIONS.map(([s, e]) => `${s}:${e}`));
    const illegal: [StateName, EventName][] = [];
    for (const s of Object.keys(S) as StateName[]) {
      for (const e of Object.keys(E) as EventName[]) {
        if (!legal.has(`${s}:${e}`)) illegal.push([s, e]);
      }
    }

    it('covers the rest of the state x event table', () => {
      expect(illegal.length + TRANSITIONS.length).toBe(Object.keys(S).length * Object.keys(E).length);
    });

    it.each(illegal)('%s ignores %s', (state, event) => {
      expect(checkoutReducer(S[state], E[event])).toBe(S[state]);
    });
  });

  it('ignores EXPRESS_START for the card method (card goes through SUBMIT)', () => {
    expect(checkoutReducer(S.idle, { type: 'EXPRESS_START', method: 'card' })).toBe(S.idle);
  });

  it('cannot double-submit: a second SUBMIT while processing is ignored', () => {
    const processing = checkoutReducer(checkoutReducer(S.idle, E.SUBMIT), E.VALIDATION_PASSED);
    expect(checkoutReducer(processing, E.SUBMIT)).toBe(processing);
    expect(checkoutReducer(processing, E.EXPRESS_START)).toBe(processing);
  });

  it('cannot RETRY out of checking (that would risk a second charge)', () => {
    expect(checkoutReducer(S.checking, E.RETRY)).toBe(S.checking);
  });

  describe('RECOVERY_RESOLVED outcomes', () => {
    it('declined keeps the method that was being checked', () => {
      expect(
        checkoutReducer(S.checking, { type: 'RECOVERY_RESOLVED', outcome: { kind: 'declined', failure } }),
      ).toEqual({ status: 'declined', method: 'affirm', failure });
    });

    it('not_charged returns to idle', () => {
      expect(checkoutReducer(S.checking, { type: 'RECOVERY_RESOLVED', outcome: { kind: 'not_charged' } })).toEqual({
        status: 'idle',
      });
    });
  });

  describe('end-to-end flows', () => {
    const run = (events: CheckoutEvent[], from: CheckoutState = initialCheckoutState) =>
      events.reduce(checkoutReducer, from);

    it('card: submit -> validate -> process -> succeed', () => {
      expect(run([E.SUBMIT, E.VALIDATION_PASSED, E.RESULT_SUCCEEDED])).toEqual({ status: 'succeeded', receipt });
    });

    it('success -> new order: back to a fresh idle that can pay again', () => {
      const fresh = run([E.SUBMIT, E.VALIDATION_PASSED, E.RESULT_SUCCEEDED, E.NEW_ORDER]);
      expect(fresh).toBe(initialCheckoutState);
      expect(checkoutReducer(fresh, E.EXPRESS_START)).toEqual({ status: 'authorizing', method: 'apple_pay' });
    });

    it('card: decline then retry then succeed', () => {
      expect(run([E.SUBMIT, E.VALIDATION_PASSED, E.RESULT_DECLINED, E.RETRY, E.SUBMIT, E.VALIDATION_PASSED])).toEqual({
        status: 'processing',
        method: 'card',
      });
    });

    it('express: cancelled sheet returns to idle without processing', () => {
      expect(run([E.EXPRESS_START, E.SHEET_CANCELLED])).toEqual({ status: 'idle' });
    });

    it('express: one tap through to success', () => {
      expect(run([E.EXPRESS_START, E.SHEET_AUTHORIZED, E.RESULT_SUCCEEDED]).status).toBe('succeeded');
    });

    it('lost response -> checking -> recovered', () => {
      expect(run([E.EXPRESS_START, E.SHEET_AUTHORIZED, E.RESULT_UNKNOWN, E.RECOVERY_RESOLVED]).status).toBe(
        'succeeded',
      );
    });

    it('relaunch with pending -> checking -> recovered', () => {
      expect(run([E.RELAUNCH_WITH_PENDING, E.RECOVERY_RESOLVED])).toEqual({ status: 'succeeded', receipt });
    });

    it('a late RESULT after the sheet was cancelled is ignored', () => {
      expect(run([E.EXPRESS_START, E.SHEET_CANCELLED, E.RESULT_SUCCEEDED])).toEqual({ status: 'idle' });
    });
  });
});

describe('isBusy', () => {
  it.each`
    state                  | busy
    ${'idle'}              | ${false}
    ${'validating'}        | ${true}
    ${'authorizing'}       | ${true}
    ${'processingCard'}    | ${true}
    ${'processingExpress'} | ${true}
    ${'checking'}          | ${true}
    ${'succeeded'}         | ${false}
    ${'declined'}          | ${false}
  `('$state -> $busy', ({ state, busy }: { state: StateName; busy: boolean }) => {
    expect(isBusy(S[state])).toBe(busy);
  });
});
