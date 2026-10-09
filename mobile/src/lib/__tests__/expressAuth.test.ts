import { affirmCheckoutUrl, expressAuthToken, parseAffirmReturn } from '../expressAuth';

describe('expressAuthToken', () => {
  it('mints a method-scoped token', () => {
    expect(expressAuthToken('apple_pay', { nonce: 'abc' })).toBe('tok_apple_pay_abc');
    expect(expressAuthToken('google_pay', { nonce: 'abc' })).toBe('tok_google_pay_abc');
  });

  it('prefixes a simulated decline with the magic trigger the server watches for', () => {
    expect(expressAuthToken('affirm', { declined: true, nonce: 'abc' })).toBe('tok_declined_affirm_abc');
  });

  // Uniqueness comes from Crypto.randomUUID, which jest-expo stubs; only the shape is ours to test.
  it('generates a nonce when none is given', () => {
    expect(expressAuthToken('apple_pay')).toMatch(/^tok_apple_pay_.+/);
  });
});

describe('affirmCheckoutUrl', () => {
  const params = {
    baseUrl: 'http://localhost:4000',
    returnUrl: 'exp://127.0.0.1:8081/--/affirm',
    amountCents: 13590,
    orderId: 'ord_demo_001',
  };

  it('builds the hosted-page URL with the return deep link encoded', () => {
    expect(affirmCheckoutUrl(params)).toBe(
      'http://localhost:4000/affirm/checkout?amount_cents=13590&order_id=ord_demo_001' +
        '&return_to=exp%3A%2F%2F127.0.0.1%3A8081%2F--%2Faffirm',
    );
  });

  it('appends the decline flag only when simulating a decline', () => {
    expect(affirmCheckoutUrl({ ...params, simulateDecline: true })).toMatch(/&decline=1$/);
    expect(affirmCheckoutUrl(params)).not.toContain('decline');
  });
});

describe('parseAffirmReturn', () => {
  it('reads an approved token out of the redirect', () => {
    expect(parseAffirmReturn('exp://127.0.0.1:8081/--/affirm?token=tok_affirm_xyz')).toEqual({
      kind: 'approved',
      token: 'tok_affirm_xyz',
    });
  });

  it('decodes an encoded token', () => {
    expect(parseAffirmReturn('exp://host/--/affirm?token=tok%5Faffirm%5F1')).toEqual({
      kind: 'approved',
      token: 'tok_affirm_1',
    });
  });

  it('treats an explicit cancel, a missing token and a bare URL all as cancelled', () => {
    expect(parseAffirmReturn('exp://host/--/affirm?cancelled=1')).toEqual({ kind: 'cancelled' });
    expect(parseAffirmReturn('exp://host/--/affirm?token=')).toEqual({ kind: 'cancelled' });
    expect(parseAffirmReturn('exp://host/--/affirm')).toEqual({ kind: 'cancelled' });
  });
});
