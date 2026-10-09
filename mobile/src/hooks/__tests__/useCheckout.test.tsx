import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, create } from 'react-test-renderer';

import { loadSnapshot, PENDING_PAYMENT_KEY, persistSnapshot } from '../../lib/pendingPayment';
import { postPayment, type Order } from '../../lib/paymentsApi';
import { useCheckout } from '../useCheckout';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'key-1') }));
jest.mock('../../lib/paymentsApi', () => ({
  ...jest.requireActual('../../lib/paymentsApi'),
  postPayment: jest.fn(),
}));

const order: Order = {
  id: 'ord_demo_001',
  event: {
    id: 'evt',
    title: 'Warriors vs Lakers',
    venue: 'Chase Center',
    city: 'SF',
    startsAt: '2026-10-24T19:30:00-07:00',
  },
  listing: { id: 'lst', section: '115', row: '12', deliveryType: 'mobile_transfer' },
  quantity: 2,
  pricing: { unitPriceCents: 5800, subtotalCents: 11600, fees: [], totalCents: 13590, currency: 'USD' },
};

function mountCheckout() {
  const ref: { current: ReturnType<typeof useCheckout> | null } = { current: null };
  function Probe() {
    ref.current = useCheckout();
    return null;
  }
  act(() => {
    create(<Probe />);
  });
  return ref as { current: ReturnType<typeof useCheckout> };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  (postPayment as jest.Mock).mockReset();
  (postPayment as jest.Mock).mockResolvedValue({
    replayed: false,
    payment: {
      id: 'pay_1',
      orderId: order.id,
      amountCents: 13590,
      method: 'card',
      status: 'succeeded',
      confirmationCode: 'GT-ABC123',
      createdAt: '2026-10-09T13:05:12Z',
    },
  });
});

describe('useCheckout: start new order', () => {
  it('the snapshot is already cleared at success, and new order returns to a fresh idle', async () => {
    const checkout = mountCheckout();
    await act(async () => {
      await checkout.current.payWithCard(order, { number: '4242 4242 4242 4242', expiry: '12/30', cvc: '123' });
    });

    expect(checkout.current.state).toMatchObject({ status: 'succeeded' });
    expect(await AsyncStorage.getItem(PENDING_PAYMENT_KEY)).toBeNull();

    act(() => checkout.current.startNewOrder());
    expect(checkout.current.state).toEqual({ status: 'idle' });
    expect(checkout.current.busy).toBe(false);
    expect(await AsyncStorage.getItem(PENDING_PAYMENT_KEY)).toBeNull();
  });
});

describe('useCheckout: relaunch recovery while the server is down', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const snapshot = {
    idempotencyKey: 'key-pending',
    orderId: order.id,
    quantity: 2,
    amountCents: 13590,
    method: 'card' as const,
  };

  it('reassures after repeated failed replays, keeps retrying, and keeps the snapshot', async () => {
    await persistSnapshot(snapshot);
    (postPayment as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
    const checkout = mountCheckout();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(checkout.current.state).toMatchObject({ status: 'checking' });
    expect(checkout.current.stillChecking).toBe(false);

    // Attempts 1-4 fail with 1+2+4 s of backoff between them: not yet.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(7000);
    });
    expect((postPayment as jest.Mock).mock.calls).toHaveLength(4);
    expect(checkout.current.stillChecking).toBe(false);

    // Attempt 5 fails after the 8 s step: the reassurance line appears.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(8000);
    });
    expect((postPayment as jest.Mock).mock.calls).toHaveLength(5);
    expect(checkout.current.stillChecking).toBe(true);
    expect(checkout.current.state).toMatchObject({ status: 'checking' });
    expect(await loadSnapshot()).toEqual(snapshot);

    // Still retrying at the 8 s cap; the server comes back and the original outcome lands.
    (postPayment as jest.Mock).mockResolvedValue({
      replayed: true,
      payment: {
        id: 'pay_1',
        orderId: order.id,
        amountCents: 13590,
        method: 'card',
        status: 'succeeded',
        confirmationCode: 'GT-ABC123',
        createdAt: '2026-10-09T13:05:12Z',
      },
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(8000);
    });
    expect(checkout.current.state).toMatchObject({ status: 'succeeded' });
    expect(checkout.current.stillChecking).toBe(false);
    expect(await loadSnapshot()).toBeNull();
  });
});

describe('useCheckout: relaunch replay gate', () => {
  // The snapshot read is async, so an express tap can land first. The reducer then ignores
  // RELAUNCH_WITH_PENDING; the replay must not run either (it would grab inFlight and swallow the
  // fan's authorization).
  it('skips the replay when checkout already left idle before the snapshot loaded', async () => {
    await persistSnapshot({
      idempotencyKey: 'key-pending',
      orderId: order.id,
      quantity: 2,
      amountCents: 13590,
      method: 'card',
    });
    const checkout = mountCheckout();
    act(() => checkout.current.startExpress('apple_pay'));
    await act(async () => {});

    expect(postPayment).not.toHaveBeenCalled();
    expect(checkout.current.state).toMatchObject({ status: 'authorizing', method: 'apple_pay' });

    await act(async () => {
      await checkout.current.completeExpress(order, 'apple_pay', 'tok_apple_pay_1');
    });
    expect(postPayment).toHaveBeenCalledTimes(1);
    expect(checkout.current.state).toMatchObject({ status: 'succeeded' });
  });
});
