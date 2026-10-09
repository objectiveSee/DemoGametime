import { AFFIRM_MIN_EXCLUSIVE_CENTS, eligibleMethods, getEligibility, isExpressMethod } from '../eligibility';

const base = { platform: 'ios' as const, applePayCapable: false, googlePaySetUp: false, totalCents: 5000 };

describe('getEligibility', () => {
  describe('wallet matrix', () => {
    it.each`
      platform     | applePayCapable | googlePaySetUp | applePay | googlePay
      ${'ios'}     | ${true}         | ${false}       | ${true}  | ${false}
      ${'ios'}     | ${false}        | ${false}       | ${false} | ${false}
      ${'ios'}     | ${false}        | ${true}        | ${false} | ${false}
      ${'ios'}     | ${true}         | ${true}        | ${true}  | ${false}
      ${'android'} | ${false}        | ${true}        | ${false} | ${true}
      ${'android'} | ${false}        | ${false}       | ${false} | ${false}
      ${'android'} | ${true}         | ${false}       | ${false} | ${false}
      ${'android'} | ${true}         | ${true}        | ${false} | ${true}
    `(
      '$platform, applePayCapable=$applePayCapable, googlePaySetUp=$googlePaySetUp',
      ({ platform, applePayCapable, googlePaySetUp, applePay, googlePay }) => {
        const result = getEligibility({ ...base, platform, applePayCapable, googlePaySetUp });
        expect(result.apple_pay).toBe(applePay);
        expect(result.google_pay).toBe(googlePay);
      },
    );
  });

  describe('Affirm threshold (strictly over $100)', () => {
    it.each`
      totalCents | affirm
      ${0}       | ${false}
      ${6920}    | ${false}
      ${9999}    | ${false}
      ${10000}   | ${false}
      ${10001}   | ${true}
      ${13590}   | ${true}
    `('$totalCents cents -> $affirm', ({ totalCents, affirm }) => {
      expect(getEligibility({ ...base, totalCents }).affirm).toBe(affirm);
    });

    it('is independent of platform and wallet state', () => {
      for (const platform of ['ios', 'android'] as const) {
        expect(
          getEligibility({ platform, applePayCapable: true, googlePaySetUp: true, totalCents: 10001 }).affirm,
        ).toBe(true);
      }
    });

    it('exposes the $100 boundary constant', () => {
      expect(AFFIRM_MIN_EXCLUSIVE_CENTS).toBe(10000);
    });
  });

  it('always offers card, even with nothing else eligible', () => {
    expect(getEligibility({ ...base, platform: 'android', totalCents: 0 }).card).toBe(true);
  });
});

describe('eligibleMethods', () => {
  it('lists everything eligible on a capable iOS device in display order', () => {
    expect(eligibleMethods({ ...base, applePayCapable: true, totalCents: 13590 })).toEqual([
      'apple_pay',
      'affirm',
      'card',
    ]);
  });

  it('lists Google Pay first on a set-up Android device', () => {
    expect(eligibleMethods({ ...base, platform: 'android', googlePaySetUp: true, totalCents: 13590 })).toEqual([
      'google_pay',
      'affirm',
      'card',
    ]);
  });

  it('falls back to card only', () => {
    expect(eligibleMethods({ ...base, totalCents: 6920 })).toEqual(['card']);
  });

  it('reacts to a total change across the threshold (quantity 1 -> 2)', () => {
    const device = { ...base, applePayCapable: true };
    expect(eligibleMethods({ ...device, totalCents: 6920 })).not.toContain('affirm');
    expect(eligibleMethods({ ...device, totalCents: 13590 })).toContain('affirm');
  });
});

describe('isExpressMethod', () => {
  it('treats every non-card method as express', () => {
    expect(isExpressMethod('apple_pay')).toBe(true);
    expect(isExpressMethod('google_pay')).toBe(true);
    expect(isExpressMethod('affirm')).toBe(true);
    expect(isExpressMethod('card')).toBe(false);
  });
});
