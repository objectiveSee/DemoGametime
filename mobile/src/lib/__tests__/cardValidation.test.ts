import {
  cardNumberLength,
  cvcLength,
  detectBrand,
  formatCardNumber,
  formatCvc,
  formatExpiry,
  isCardNumberComplete,
  isExpiryInFuture,
  luhnCheck,
  parseExpiry,
  toCardPayload,
  validateCardForm,
  validateCardNumber,
  validateCvc,
  validateExpiry,
} from '../cardValidation';

// Fixed clock: October 2026.
const NOW = new Date(2026, 9, 9);

describe('detectBrand', () => {
  it.each`
    input                    | brand
    ${'4'}                   | ${'visa'}
    ${'4242424242424242'}    | ${'visa'}
    ${'34'}                  | ${'amex'}
    ${'37'}                  | ${'amex'}
    ${'378282246310005'}     | ${'amex'}
    ${'35'}                  | ${'unknown'}
    ${'3'}                   | ${'unknown'}
    ${'51'}                  | ${'mastercard'}
    ${'55'}                  | ${'mastercard'}
    ${'50'}                  | ${'unknown'}
    ${'56'}                  | ${'unknown'}
    ${'2221'}                | ${'mastercard'}
    ${'2720'}                | ${'mastercard'}
    ${'2220'}                | ${'unknown'}
    ${'2721'}                | ${'unknown'}
    ${'222'}                 | ${'unknown'}
    ${'2223003122003222'}    | ${'mastercard'}
    ${'6011'}                | ${'discover'}
    ${'601'}                 | ${'unknown'}
    ${'6012'}                | ${'unknown'}
    ${'65'}                  | ${'discover'}
    ${'6011111111111117'}    | ${'discover'}
    ${''}                    | ${'unknown'}
    ${'4242 4242 4242 4242'} | ${'visa'}
  `('$input -> $brand', ({ input, brand }) => {
    expect(detectBrand(input)).toBe(brand);
  });
});

describe('luhnCheck', () => {
  it.each(['4242424242424242', '4000000000000002', '5555555555554444', '378282246310005', '6011111111111117'])(
    'accepts known-good %s',
    (n) => expect(luhnCheck(n)).toBe(true),
  );

  it.each(['4242424242424241', '4242424242424243', '5555555555554440', '378282246310006', '1234567812345678'])(
    'rejects known-bad %s',
    (n) => expect(luhnCheck(n)).toBe(false),
  );

  it('ignores formatting spaces', () => {
    expect(luhnCheck('4242 4242 4242 4242')).toBe(true);
  });

  it('rejects numbers too short or too long to be cards', () => {
    expect(luhnCheck('0')).toBe(false);
    expect(luhnCheck('00000000000')).toBe(false);
    expect(luhnCheck('0'.repeat(20))).toBe(false);
  });
});

describe('formatCardNumber', () => {
  it.each`
    input                    | formatted
    ${''}                    | ${''}
    ${'4'}                   | ${'4'}
    ${'4242'}                | ${'4242'}
    ${'42424'}               | ${'4242 4'}
    ${'4242424242424242'}    | ${'4242 4242 4242 4242'}
    ${'3782'}                | ${'3782'}
    ${'37828'}               | ${'3782 8'}
    ${'3782822463'}          | ${'3782 822463'}
    ${'37828224631'}         | ${'3782 822463 1'}
    ${'378282246310005'}     | ${'3782 822463 10005'}
    ${'5555555555554444'}    | ${'5555 5555 5555 4444'}
    ${'6011111111111117'}    | ${'6011 1111 1111 1117'}
    ${'4242 4242 4242 4242'} | ${'4242 4242 4242 4242'}
  `('$input -> "$formatted"', ({ input, formatted }) => {
    expect(formatCardNumber(input)).toBe(formatted);
  });

  describe('paste-safe', () => {
    it.each`
      pasted                   | formatted
      ${'4242-4242-4242-4242'} | ${'4242 4242 4242 4242'}
      ${' 4242424242424242 '}  | ${'4242 4242 4242 4242'}
      ${'4242 4242 4242 4242'} | ${'4242 4242 4242 4242'}
      ${'3782-822463-10005'}   | ${'3782 822463 10005'}
      ${'378282246310005'}     | ${'3782 822463 10005'}
      ${'5555.5555.5555.4444'} | ${'5555 5555 5555 4444'}
      ${'4242424242424242999'} | ${'4242 4242 4242 4242'}
      ${'3782822463100059'}    | ${'3782 822463 10005'}
      ${'4242 4242 abcd 4242'} | ${'4242 4242 4242'}
    `('pasting "$pasted" gives "$formatted"', ({ pasted, formatted }) => {
      expect(formatCardNumber(pasted)).toBe(formatted);
    });

    it('is idempotent (re-formatting a formatted value is a no-op)', () => {
      for (const n of ['4242424242424242', '378282246310005', '42424']) {
        const once = formatCardNumber(n);
        expect(formatCardNumber(once)).toBe(once);
      }
    });

    it('matches typing digit-by-digit', () => {
      const full = '378282246310005';
      let field = '';
      for (const digit of full) field = formatCardNumber(field + digit);
      expect(field).toBe(formatCardNumber(full));
    });
  });

  it('re-groups when the brand changes (deleting the leading 3 of an amex)', () => {
    expect(formatCardNumber('378282246310005'.slice(1))).toBe('7828 2246 3100 05');
  });
});

describe('lengths by brand', () => {
  it('amex is 15 digits with a 4-digit CVC; others 16 and 3', () => {
    expect(cardNumberLength('amex')).toBe(15);
    expect(cvcLength('amex')).toBe(4);
    for (const brand of ['visa', 'mastercard', 'discover', 'unknown'] as const) {
      expect(cardNumberLength(brand)).toBe(16);
      expect(cvcLength(brand)).toBe(3);
    }
  });

  it('isCardNumberComplete honors the brand length', () => {
    expect(isCardNumberComplete('3782 822463 10005')).toBe(true);
    expect(isCardNumberComplete('4242 4242 4242 424')).toBe(false);
    expect(isCardNumberComplete('4242 4242 4242 4242')).toBe(true);
  });
});

describe('validateCardNumber', () => {
  it.each(['4242 4242 4242 4242', '3782 822463 10005', '5555555555554444', '6011111111111117', '2223003122003222'])(
    'accepts %s',
    (n) => expect(validateCardNumber(n)).toEqual({ valid: true }),
  );

  it('accepts the server decline test card (it is Luhn-valid; the decline happens server-side)', () => {
    expect(validateCardNumber('4000 0000 0000 0002').valid).toBe(true);
  });

  it.each`
    input                    | error
    ${''}                    | ${'Enter a card number.'}
    ${'4242 4242'}           | ${'Card number is incomplete.'}
    ${'3782 822463 1000'}    | ${'Card number is incomplete.'}
    ${'4242 4242 4242 4241'} | ${'Card number is invalid.'}
    ${'1234 5678 1234 5670'} | ${'We accept Visa, Mastercard, Amex, and Discover.'}
  `('rejects "$input" with "$error"', ({ input, error }) => {
    expect(validateCardNumber(input)).toEqual({ valid: false, error });
  });
});

describe('formatExpiry', () => {
  it.each`
    input        | formatted
    ${''}        | ${''}
    ${'1'}       | ${'1'}
    ${'12'}      | ${'12'}
    ${'122'}     | ${'12/2'}
    ${'1228'}    | ${'12/28'}
    ${'12/28'}   | ${'12/28'}
    ${'12/'}     | ${'12'}
    ${'4'}       | ${'04'}
    ${'428'}     | ${'04/28'}
    ${'0'}       | ${'0'}
    ${'05'}      | ${'05'}
    ${'12289'}   | ${'12/28'}
    ${'12/2028'} | ${'12/28'}
    ${'1/2028'}  | ${'01/28'}
    ${'3/29'}    | ${'03/29'}
    ${'12-28'}   | ${'12/28'}
    ${'ab'}      | ${''}
  `('"$input" -> "$formatted"', ({ input, formatted }) => {
    expect(formatExpiry(input)).toBe(formatted);
  });
});

describe('parseExpiry', () => {
  it('parses MM/YY and MMYY', () => {
    expect(parseExpiry('12/28')).toEqual({ month: 12, year: 2028 });
    expect(parseExpiry('0130')).toEqual({ month: 1, year: 2030 });
  });

  it.each(['', '1/28', '13/28', '00/28', '12/2', 'ab/cd', '12/28/1'])('rejects "%s"', (input) => {
    expect(parseExpiry(input)).toBeNull();
  });
});

describe('isExpiryInFuture', () => {
  it('treats the current month as still valid', () => {
    expect(isExpiryInFuture({ month: 10, year: 2026 }, NOW)).toBe(true);
  });

  it('rejects last month and last year', () => {
    expect(isExpiryInFuture({ month: 9, year: 2026 }, NOW)).toBe(false);
    expect(isExpiryInFuture({ month: 12, year: 2025 }, NOW)).toBe(false);
  });

  it('accepts next month and a later year with an earlier month', () => {
    expect(isExpiryInFuture({ month: 11, year: 2026 }, NOW)).toBe(true);
    expect(isExpiryInFuture({ month: 1, year: 2027 }, NOW)).toBe(true);
  });
});

describe('validateExpiry', () => {
  it.each`
    input      | valid    | error
    ${'10/26'} | ${true}  | ${undefined}
    ${'11/26'} | ${true}  | ${undefined}
    ${'12/28'} | ${true}  | ${undefined}
    ${'09/26'} | ${false} | ${'This card has expired.'}
    ${'12/25'} | ${false} | ${'This card has expired.'}
    ${''}      | ${false} | ${'Enter an expiration date.'}
    ${'12/2'}  | ${false} | ${'Expiration date is incomplete.'}
    ${'13/28'} | ${false} | ${'Expiration date is invalid.'}
    ${'00/28'} | ${false} | ${'Expiration date is invalid.'}
    ${'12/99'} | ${false} | ${'Expiration date is invalid.'}
    ${'ab/cd'} | ${false} | ${'Enter an expiration date.'}
  `('"$input" -> valid=$valid', ({ input, valid, error }) => {
    const result = validateExpiry(input, NOW);
    expect(result.valid).toBe(valid);
    expect(result.error).toBe(error);
  });
});

describe('CVC', () => {
  it('formatCvc clips to the brand length', () => {
    expect(formatCvc('12345', 'visa')).toBe('123');
    expect(formatCvc('12345', 'amex')).toBe('1234');
    expect(formatCvc('1a2', 'visa')).toBe('12');
  });

  it.each`
    cvc       | brand     | valid    | error
    ${'123'}  | ${'visa'} | ${true}  | ${undefined}
    ${'1234'} | ${'amex'} | ${true}  | ${undefined}
    ${'123'}  | ${'amex'} | ${false} | ${'Security code is incomplete.'}
    ${'1234'} | ${'visa'} | ${false} | ${'Security code is invalid.'}
    ${'12'}   | ${'visa'} | ${false} | ${'Security code is incomplete.'}
    ${''}     | ${'visa'} | ${false} | ${'Enter a security code.'}
    ${'12a'}  | ${'visa'} | ${false} | ${'Security code is invalid.'}
  `('$cvc for $brand -> valid=$valid', ({ cvc, brand, valid, error }) => {
    expect(validateCvc(cvc, brand)).toEqual(error ? { valid, error } : { valid });
  });
});

describe('validateCardForm', () => {
  const good = { number: '4242 4242 4242 4242', expiry: '12/28', cvc: '123' };

  it('accepts a complete valid card', () => {
    expect(validateCardForm(good, NOW)).toEqual({ valid: true, errors: {} });
  });

  it('accepts amex with a 4-digit CVC and rejects it with 3', () => {
    const amex = { number: '3782 822463 10005', expiry: '12/28', cvc: '1234' };
    expect(validateCardForm(amex, NOW).valid).toBe(true);
    expect(validateCardForm({ ...amex, cvc: '123' }, NOW).errors).toEqual({ cvc: 'Security code is incomplete.' });
  });

  it('reports every failing field at once', () => {
    const result = validateCardForm({ number: '4242', expiry: '01/20', cvc: '' }, NOW);
    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors).sort()).toEqual(['cvc', 'expiry', 'number']);
  });

  it('is invalid when any single field fails', () => {
    expect(validateCardForm({ ...good, number: '4242 4242 4242 4241' }, NOW).valid).toBe(false);
    expect(validateCardForm({ ...good, expiry: '09/26' }, NOW).valid).toBe(false);
    expect(validateCardForm({ ...good, cvc: '12' }, NOW).valid).toBe(false);
  });
});

describe('toCardPayload', () => {
  it('builds the POST /payments card body', () => {
    expect(toCardPayload({ number: '4242 4242 4242 4242', expiry: '12/28', cvc: '123' })).toEqual({
      number: '4242424242424242',
      expMonth: 12,
      expYear: 2028,
      cvc: '123',
    });
  });

  it('throws on an invalid expiry', () => {
    expect(() => toCardPayload({ number: '4242424242424242', expiry: '13/28', cvc: '123' })).toThrow();
  });
});
