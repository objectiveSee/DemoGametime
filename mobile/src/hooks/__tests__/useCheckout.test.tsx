import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, create } from 'react-test-renderer';

import { PENDING_PAYMENT_KEY } from '../../lib/pendingPayment';
import { postPayment, type Order } from '../../lib/paymentsApi';
import { useCheckout } from '../useCheckout';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'key-1') }));
jest.mock('../../lib/paymentsApi', () => ({
  ...jest.requireActual('../../lib/paymentsApi'),
  postPayment: jest.fn(),
}));

const order: Order = {
  id: 'ord_demo_001',
  event: { id: 'evt', title: 'Warriors vs Lakers', venue: 'Chase Center', city: 'SF', startsAt: '2026-10-24T19:30:00-07:00' },
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
