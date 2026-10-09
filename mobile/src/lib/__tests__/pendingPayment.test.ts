import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ApiError,
  type Payment,
  type PaymentAttempt,
  type PaymentCredentials,
  type PaymentResponse,
} from '../paymentsApi';
import {
  attemptFromSnapshot,
  clearSnapshot,
  loadSnapshot,
  PENDING_PAYMENT_KEY,
  persistSnapshot,
  recoverPendingPayment,
  recoveryOutcome,
  type PaymentSnapshot,
} from '../pendingPayment';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'uuid') }));

const cardSnapshot: PaymentSnapshot = {
  idempotencyKey: 'key-1',
  orderId: 'ord_demo_001',
  quantity: 2,
  amountCents: 13590,
  method: 'card',
};
const expressSnapshot: PaymentSnapshot = { ...cardSnapshot, method: 'apple_pay', token: 'tok_applepay_stub_1' };

const succeeded: Payment = {
  id: 'pay_1',
  orderId: 'ord_demo_001',
  amountCents: 13590,
  method: 'card',
  status: 'succeeded',
  confirmationCode: 'GT-ABC123',
  createdAt: '2026-10-09T13:05:12Z',
};
const declined: Payment = {
  id: 'pay_2',
  orderId: 'ord_demo_001',
  amountCents: 13590,
  method: 'card',
  status: 'declined',
  failureCode: 'card_declined',
  failureMessage: 'Your card was declined.',
  createdAt: '2026-10-09T13:05:12Z',
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('snapshot storage', () => {
  it('loads null when nothing is pending', async () => {
    expect(await loadSnapshot()).toBeNull();
  });

  it('round-trips persist -> load', async () => {
    await persistSnapshot(expressSnapshot);
    expect(await loadSnapshot()).toEqual(expressSnapshot);
  });

  it('clear removes it', async () => {
    await persistSnapshot(cardSnapshot);
    await clearSnapshot();
    expect(await loadSnapshot()).toBeNull();
    expect(await AsyncStorage.getItem(PENDING_PAYMENT_KEY)).toBeNull();
  });

  it('a new persist replaces the previous attempt', async () => {
    await persistSnapshot(cardSnapshot);
    await persistSnapshot({ ...cardSnapshot, idempotencyKey: 'key-2' });
    expect((await loadSnapshot())?.idempotencyKey).toBe('key-2');
  });

  it.each([
    ['not JSON', '{oops'],
    ['missing key', JSON.stringify({ ...cardSnapshot, idempotencyKey: '' })],
    ['non-integer amount', JSON.stringify({ ...cardSnapshot, amountCents: 135.9 })],
    ['unknown method', JSON.stringify({ ...cardSnapshot, method: 'paypal' })],
    ['null', 'null'],
  ])('discards a corrupt entry (%s) instead of crashing', async (_label, raw) => {
    await AsyncStorage.setItem(PENDING_PAYMENT_KEY, raw);
    expect(await loadSnapshot()).toBeNull();
    expect(await AsyncStorage.getItem(PENDING_PAYMENT_KEY)).toBeNull();
  });

  it('never persists card numbers', async () => {
    await persistSnapshot(cardSnapshot);
    const raw = (await AsyncStorage.getItem(PENDING_PAYMENT_KEY)) ?? '';
    expect(raw).not.toMatch(/number|cvc/);
  });
});

describe('attemptFromSnapshot', () => {
  it('preserves key and exact amount, and carries the express token', () => {
    expect(attemptFromSnapshot(expressSnapshot)).toEqual({
      attempt: {
        idempotencyKey: 'key-1',
        orderId: 'ord_demo_001',
        quantity: 2,
        amountCents: 13590,
        method: 'apple_pay',
      },
      credentials: { token: 'tok_applepay_stub_1' },
    });
  });

  it('sends no credentials for a card snapshot', () => {
    expect(attemptFromSnapshot(cardSnapshot).credentials).toEqual({});
  });
});

describe('recoveryOutcome', () => {
  it('succeeded -> receipt', () => {
    expect(recoveryOutcome(cardSnapshot, { payment: succeeded, replayed: true })).toEqual({
      kind: 'succeeded',
      receipt: { paymentId: 'pay_1', confirmationCode: 'GT-ABC123', amountCents: 13590, method: 'card' },
    });
  });

  it('a replayed decline is a real decline', () => {
    expect(recoveryOutcome(cardSnapshot, { payment: declined, replayed: true })).toEqual({
      kind: 'declined',
      failure: { code: 'card_declined', message: 'Your card was declined.' },
    });
  });

  it('a fresh (non-replayed) decline of a card-less replay means the original never charged', () => {
    expect(recoveryOutcome(cardSnapshot, { payment: declined, replayed: false })).toEqual({ kind: 'not_charged' });
  });

  it('an express decline is real even if not replayed (the token was resent)', () => {
    const payment: Payment = { ...declined, method: 'apple_pay', failureCode: 'payment_failed' };
    expect(recoveryOutcome(expressSnapshot, { payment, replayed: false }).kind).toBe('declined');
  });
});

describe('recoverPendingPayment', () => {
  type Post = (attempt: PaymentAttempt, credentials: PaymentCredentials) => Promise<PaymentResponse>;

  it('replays from the snapshot, not from current order state', async () => {
    await persistSnapshot(cardSnapshot);
    const post = jest
      .fn<ReturnType<Post>, Parameters<Post>>()
      .mockResolvedValue({ payment: succeeded, replayed: true });

    // Simulate the fan having changed quantity after the crash: the replay must ignore it.
    const currentOrder = { quantity: 1, totalCents: 6920 };
    const snapshot = (await loadSnapshot())!;
    await recoverPendingPayment(snapshot, post);

    expect(post).toHaveBeenCalledTimes(1);
    const [attempt] = post.mock.calls[0];
    expect(attempt).toEqual({
      idempotencyKey: 'key-1',
      orderId: 'ord_demo_001',
      quantity: 2,
      amountCents: 13590,
      method: 'card',
    });
    expect(attempt.amountCents).not.toBe(currentOrder.totalCents);
  });

  it('clears the snapshot on a definitive answer', async () => {
    await persistSnapshot(cardSnapshot);
    const outcome = await recoverPendingPayment(cardSnapshot, async () => ({ payment: succeeded, replayed: true }));
    expect(outcome.kind).toBe('succeeded');
    expect(await loadSnapshot()).toBeNull();
  });

  it.each([
    ['offline', new ApiError(0, 'network_error')],
    ['server error', new ApiError(500, 'internal_error')],
    ['non-ApiError', new TypeError('boom')],
  ])('keeps the snapshot and rethrows when the outcome is still unknown (%s)', async (_label, error) => {
    await persistSnapshot(cardSnapshot);
    await expect(recoverPendingPayment(cardSnapshot, () => Promise.reject(error))).rejects.toBe(error);
    expect(await loadSnapshot()).toEqual(cardSnapshot);
  });

  it('returns the definitive answer even when clearing the snapshot fails', async () => {
    await persistSnapshot(cardSnapshot);
    jest.spyOn(AsyncStorage, 'removeItem').mockRejectedValueOnce(new Error('disk'));
    const outcome = await recoverPendingPayment(cardSnapshot, async () => ({ payment: succeeded, replayed: true }));
    expect(outcome.kind).toBe('succeeded');
    expect(await loadSnapshot()).toEqual(cardSnapshot);
  });

  it('treats a 409 as not charged and clears the snapshot', async () => {
    await persistSnapshot(cardSnapshot);
    const outcome = await recoverPendingPayment(cardSnapshot, () =>
      Promise.reject(new ApiError(409, 'amount_mismatch')),
    );
    expect(outcome).toEqual({ kind: 'not_charged' });
    expect(await loadSnapshot()).toBeNull();
  });
});
