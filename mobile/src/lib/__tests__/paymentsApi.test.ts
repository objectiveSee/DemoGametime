import {
  API_BASE_URL,
  ApiError,
  getOrder,
  getPayment,
  isOutcomeUnknown,
  newIdempotencyKey,
  postPayment,
  toReceipt,
  type PaymentAttempt,
} from '../paymentsApi';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => '3b241101-e2bb-4255-8caf-4136c566a962') }));

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
});

const respond = (status: number, body: unknown) =>
  fetchMock.mockResolvedValueOnce({ ok: status >= 200 && status < 300, status, json: async () => body });

const attempt: PaymentAttempt = {
  idempotencyKey: 'key-1',
  orderId: 'ord_demo_001',
  quantity: 2,
  amountCents: 13590,
  method: 'card',
};
const card = { number: '4242424242424242', expMonth: 12, expYear: 2028, cvc: '123' };
const basePayment = {
  id: 'pay_1',
  orderId: 'ord_demo_001',
  amountCents: 13590,
  method: 'card' as const,
  createdAt: '2026-10-09T13:05:12Z',
};

it('targets localhost on iOS (jest-expo default platform)', () => {
  expect(API_BASE_URL).toBe('http://localhost:4000');
});

it('newIdempotencyKey uses expo-crypto randomUUID', () => {
  expect(newIdempotencyKey()).toBe('3b241101-e2bb-4255-8caf-4136c566a962');
});

describe('getOrder', () => {
  it('requests the quantity and unwraps the order', async () => {
    const order = { id: 'ord_demo_001', quantity: 2, pricing: { totalCents: 13590 } };
    respond(200, { order });
    await expect(getOrder(2)).resolves.toEqual(order);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/order?quantity=2');
  });

  it('throws an ApiError on 400', async () => {
    respond(400, { error: { code: 'invalid_quantity', message: 'quantity must be an integer 1-8' } });
    await expect(getOrder(9)).rejects.toMatchObject({ status: 400, code: 'invalid_quantity' });
  });
});

describe('postPayment', () => {
  it('POSTs the attempt plus card and returns a succeeded payment', async () => {
    const payment = { ...basePayment, status: 'succeeded', confirmationCode: 'GT-ABC123' };
    respond(201, { payment });
    await expect(postPayment(attempt, { card })).resolves.toEqual({ payment, replayed: false });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:4000/payments');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ ...attempt, card });
  });

  it('sends a token instead of a card for express methods', async () => {
    respond(201, { payment: { ...basePayment, method: 'apple_pay', status: 'succeeded', confirmationCode: 'GT-1' } });
    await postPayment({ ...attempt, method: 'apple_pay' }, { token: 'tok_applepay_stub_1' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.token).toBe('tok_applepay_stub_1');
    expect(body.card).toBeUndefined();
  });

  it('returns a 201 decline as a result, not an exception', async () => {
    const payment = {
      ...basePayment,
      status: 'declined',
      failureCode: 'card_declined',
      failureMessage: 'Your card was declined.',
    };
    respond(201, { payment });
    await expect(postPayment(attempt, { card })).resolves.toEqual({ payment, replayed: false });
  });

  it('surfaces replayed: true from an idempotent replay', async () => {
    respond(201, { payment: { ...basePayment, status: 'succeeded', confirmationCode: 'GT-1' }, replayed: true });
    expect((await postPayment(attempt)).replayed).toBe(true);
  });

  it('throws a definitive ApiError on 409 amount_mismatch', async () => {
    respond(409, { error: { code: 'amount_mismatch', message: 'expected 13590 cents' } });
    const err = await postPayment({ ...attempt, amountCents: 1 }, { card }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, code: 'amount_mismatch', message: 'expected 13590 cents' });
    expect(isOutcomeUnknown(err)).toBe(false);
  });

  it('throws on 400 with the server error code', async () => {
    respond(400, { error: { code: 'missing_idempotency_key' } });
    await expect(postPayment({ ...attempt, idempotencyKey: '' })).rejects.toMatchObject({
      status: 400,
      code: 'missing_idempotency_key',
    });
  });

  it('maps a network failure to status 0 (outcome unknown)', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    const err = await postPayment(attempt, { card }).catch((e) => e);
    expect(err).toMatchObject({ status: 0, code: 'network_error' });
    expect(isOutcomeUnknown(err)).toBe(true);
  });

  it('handles a non-JSON error body', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('bad json');
      },
    });
    const err = await postPayment(attempt).catch((e) => e);
    expect(err).toMatchObject({ status: 502, code: 'http_error' });
    expect(isOutcomeUnknown(err)).toBe(true);
  });

  it('passes the x-mock-delay override when asked', async () => {
    respond(201, { payment: { ...basePayment, status: 'succeeded', confirmationCode: 'GT-1' } });
    await postPayment(attempt, {}, { mockDelayMs: 5000 });
    expect(fetchMock.mock.calls[0][1].headers['x-mock-delay']).toBe('5000');
  });
});

describe('getPayment', () => {
  it('fetches by id', async () => {
    const payment = { ...basePayment, status: 'succeeded', confirmationCode: 'GT-1' };
    respond(200, { payment });
    await expect(getPayment('pay_1')).resolves.toEqual(payment);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/payments/pay_1');
  });

  it('throws not_found on 404', async () => {
    respond(404, { error: { code: 'not_found' } });
    await expect(getPayment('pay_x')).rejects.toMatchObject({ status: 404, code: 'not_found' });
  });
});

it('toReceipt maps a succeeded payment', () => {
  expect(toReceipt({ ...basePayment, status: 'succeeded', confirmationCode: 'GT-ABC123' })).toEqual({
    paymentId: 'pay_1',
    confirmationCode: 'GT-ABC123',
    amountCents: 13590,
    method: 'card',
  });
});
