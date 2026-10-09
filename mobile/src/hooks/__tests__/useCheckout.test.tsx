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

/** Mounted, with the launch-time snapshot read settled (attempts are gated on it). */
async function mountLoaded() {
  const checkout = mountCheckout();
  await act(async () => {});
  return checkout;
}

const goodCard = { number: '4242 4242 4242 4242', expiry: '12/30', cvc: '123' };

const succeededPayment = {
  id: 'pay_1',
  orderId: order.id,
  amountCents: 13590,
  method: 'card',
  status: 'succeeded',
  confirmationCode: 'GT-ABC123',
  createdAt: '2026-10-09T13:05:12Z',
};

beforeEach(async () => {
  await AsyncStorage.clear();
  (postPayment as jest.Mock).mockReset();
  (postPayment as jest.Mock).mockResolvedValue({ replayed: false, payment: succeededPayment });
});

describe('useCheckout: start new order', () => {
  it('the snapshot is already cleared at success, and new order returns to a fresh idle', async () => {
    const checkout = await mountLoaded();
    await act(async () => {
      await checkout.current.payWithCard(order, goodCard);
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

describe('useCheckout: launch gate', () => {
  const pending = {
    idempotencyKey: 'key-pending',
    orderId: order.id,
    quantity: 2,
    amountCents: 13590,
    method: 'card' as const,
  };

  // A new attempt would overwrite the pending snapshot and lose its recovery, so attempts issued
  // before the snapshot read settles are refused.
  it('refuses attempts issued before the snapshot loads, then recovers the pending payment', async () => {
    await persistSnapshot(pending);
    (postPayment as jest.Mock).mockResolvedValue({
      replayed: true,
      payment: { ...succeededPayment, id: 'pay_pending', confirmationCode: 'GT-PEND01' },
    });
    const checkout = mountCheckout();
    let started = true;
    act(() => {
      started = checkout.current.startExpress('apple_pay');
    });
    const early = checkout.current.payWithCard(order, goodCard);
    expect(started).toBe(false);
    expect(checkout.current.state).toEqual({ status: 'idle' });

    await act(async () => {
      await early;
    });
    expect(postPayment).toHaveBeenCalledTimes(1);
    expect((postPayment as jest.Mock).mock.calls[0][0]).toMatchObject({ idempotencyKey: 'key-pending' });
    expect(checkout.current.state).toMatchObject({
      status: 'succeeded',
      receipt: { confirmationCode: 'GT-PEND01' },
    });
  });

  it('lets attempts through once the snapshot has loaded', async () => {
    const checkout = await mountLoaded();
    let started = false;
    act(() => {
      started = checkout.current.startExpress('apple_pay');
    });
    expect(started).toBe(true);
    expect(checkout.current.state).toMatchObject({ status: 'authorizing', method: 'apple_pay' });
  });

  it('a failed snapshot read still unlocks checkout', async () => {
    const getItem = jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
    const checkout = await mountLoaded();
    await act(async () => {
      await checkout.current.payWithCard(order, goodCard);
    });
    expect(postPayment).toHaveBeenCalledTimes(1);
    expect(checkout.current.state).toMatchObject({ status: 'succeeded' });
    getItem.mockRestore();
  });
});

describe('useCheckout: card submit only from a resting state', () => {
  it('ignores a card submit while an express authorization is up', async () => {
    const checkout = await mountLoaded();
    act(() => {
      checkout.current.startExpress('apple_pay');
    });
    await act(async () => {
      await checkout.current.payWithCard(order, goodCard);
    });
    expect(postPayment).not.toHaveBeenCalled();
    expect(await loadSnapshot()).toBeNull();
    expect(checkout.current.state).toMatchObject({ status: 'authorizing', method: 'apple_pay' });
  });

  it('ignores a card submit after the purchase succeeded', async () => {
    const checkout = await mountLoaded();
    await act(async () => {
      await checkout.current.payWithCard(order, goodCard);
    });
    expect(checkout.current.state).toMatchObject({ status: 'succeeded' });
    await act(async () => {
      await checkout.current.payWithCard(order, goodCard);
    });
    expect(postPayment).toHaveBeenCalledTimes(1);
    expect(await loadSnapshot()).toBeNull();
  });

  it('accepts a new submit after a decline', async () => {
    (postPayment as jest.Mock).mockResolvedValueOnce({
      replayed: false,
      payment: { ...succeededPayment, status: 'declined', failureCode: 'card_declined', failureMessage: 'Declined' },
    });
    const checkout = await mountLoaded();
    await act(async () => {
      await checkout.current.payWithCard(order, goodCard);
    });
    expect(checkout.current.state).toMatchObject({ status: 'declined' });
    await act(async () => {
      await checkout.current.payWithCard(order, goodCard);
    });
    expect(postPayment).toHaveBeenCalledTimes(2);
    expect(checkout.current.state).toMatchObject({ status: 'succeeded' });
  });
});
