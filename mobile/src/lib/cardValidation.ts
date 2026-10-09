// Card form logic: brand detection, Luhn, paste-safe formatting, expiry and CVC rules.
// Formatters take the whole raw field value (not a keystroke delta), so a paste or an autofill
// arriving in a single onChangeText formats exactly like typing it out.

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown';

export type FieldResult = { valid: boolean; error?: string };

export const digitsOnly = (input: string) => input.replace(/\D/g, '');

const inRange = (digits: string, len: number, min: number, max: number) => {
  if (digits.length < len) return false;
  const n = Number(digits.slice(0, len));
  return n >= min && n <= max;
};

/** Detect the brand from the leading digits. Returns 'unknown' until the prefix is unambiguous. */
export function detectBrand(input: string): CardBrand {
  const d = digitsOnly(input);
  if (d.startsWith('4')) return 'visa';
  if (d.startsWith('34') || d.startsWith('37')) return 'amex';
  if (inRange(d, 2, 51, 55) || inRange(d, 4, 2221, 2720)) return 'mastercard';
  if (d.startsWith('6011') || d.startsWith('65')) return 'discover';
  return 'unknown';
}

export const cardNumberLength = (brand: CardBrand) => (brand === 'amex' ? 15 : 16);

export const cvcLength = (brand: CardBrand) => (brand === 'amex' ? 4 : 3);

const GROUPS: Record<'amex' | 'default', number[]> = { amex: [4, 6, 5], default: [4, 4, 4, 4] };

/** "378282246310005" -> "3782 822463 10005"; "4242424242424242" -> "4242 4242 4242 4242". */
export function formatCardNumber(input: string): string {
  const brand = detectBrand(input);
  const digits = digitsOnly(input).slice(0, cardNumberLength(brand));
  const groups = brand === 'amex' ? GROUPS.amex : GROUPS.default;
  const parts: string[] = [];
  let i = 0;
  for (const size of groups) {
    if (i >= digits.length) break;
    parts.push(digits.slice(i, i + size));
    i += size;
  }
  return parts.join(' ');
}

export function luhnCheck(input: string): boolean {
  const d = digitsOnly(input);
  if (d.length < 12 || d.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

/** True once enough digits are entered for the brand — the cue to auto-advance focus. */
export const isCardNumberComplete = (input: string) =>
  digitsOnly(input).length === cardNumberLength(detectBrand(input));

export function validateCardNumber(input: string): FieldResult {
  const digits = digitsOnly(input);
  if (!digits) return { valid: false, error: 'Enter a card number.' };
  const brand = detectBrand(digits);
  if (brand === 'unknown' && digits.length >= 4) {
    return { valid: false, error: 'We accept Visa, Mastercard, Amex, and Discover.' };
  }
  if (digits.length < cardNumberLength(brand)) return { valid: false, error: 'Card number is incomplete.' };
  if (!luhnCheck(digits)) return { valid: false, error: 'Card number is invalid.' };
  return { valid: true };
}

export type Expiry = { month: number; year: number };

/**
 * Formats the expiry field as MM/YY. A leading 2-9 becomes "0N" (no month starts with it), and a
 * pasted "MM/YYYY" keeps the right year instead of clipping to "MM/YY" of the first four digits.
 */
export function formatExpiry(input: string): string {
  const pasted = input.match(/^\s*(\d{1,2})\s*[/\-.]\s*(\d{4}|\d{2})\s*$/);
  if (pasted) return `${pasted[1].padStart(2, '0')}/${pasted[2].slice(-2)}`;
  let d = digitsOnly(input);
  if (/^[2-9]/.test(d)) d = '0' + d;
  d = d.slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

/** Parses "MM/YY" (or MMYY) into a month and four-digit year; null when malformed. */
export function parseExpiry(input: string): Expiry | null {
  const match = input.trim().match(/^(\d{2})\s*\/?\s*(\d{2})$/);
  if (!match) return null;
  const month = Number(match[1]);
  if (month < 1 || month > 12) return null;
  return { month, year: 2000 + Number(match[2]) };
}

/** Cards are valid through the last day of their expiry month, so the current month still counts. */
export function isExpiryInFuture({ month, year }: Expiry, now: Date = new Date()): boolean {
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth() + 1;
  return year > nowYear || (year === nowYear && month >= nowMonth);
}

const MAX_YEARS_AHEAD = 20;

export function validateExpiry(input: string, now: Date = new Date()): FieldResult {
  if (!digitsOnly(input)) return { valid: false, error: 'Enter an expiration date.' };
  if (digitsOnly(input).length < 4) return { valid: false, error: 'Expiration date is incomplete.' };
  const expiry = parseExpiry(input);
  if (!expiry) return { valid: false, error: 'Expiration date is invalid.' };
  if (!isExpiryInFuture(expiry, now)) return { valid: false, error: 'This card has expired.' };
  if (expiry.year > now.getFullYear() + MAX_YEARS_AHEAD) {
    return { valid: false, error: 'Expiration date is invalid.' };
  }
  return { valid: true };
}

export const formatCvc = (input: string, brand: CardBrand) => digitsOnly(input).slice(0, cvcLength(brand));

export function validateCvc(input: string, brand: CardBrand): FieldResult {
  const digits = digitsOnly(input);
  if (!digits) return { valid: false, error: 'Enter a security code.' };
  if (digits !== input.trim()) return { valid: false, error: 'Security code is invalid.' };
  if (digits.length !== cvcLength(brand)) {
    return {
      valid: false,
      error: digits.length < cvcLength(brand) ? 'Security code is incomplete.' : 'Security code is invalid.',
    };
  }
  return { valid: true };
}

export type CardForm = { number: string; expiry: string; cvc: string };

export type CardFormResult = { valid: boolean; errors: Partial<Record<keyof CardForm, string>> };

export function validateCardForm(form: CardForm, now: Date = new Date()): CardFormResult {
  const results = {
    number: validateCardNumber(form.number),
    expiry: validateExpiry(form.expiry, now),
    cvc: validateCvc(form.cvc, detectBrand(form.number)),
  };
  const errors: CardFormResult['errors'] = {};
  for (const key of Object.keys(results) as (keyof CardForm)[]) {
    if (results[key].error) errors[key] = results[key].error;
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export type CardPayload = { number: string; expMonth: number; expYear: number; cvc: string };

/** The `card` body for POST /payments. Call only on a form that passed validateCardForm. */
export function toCardPayload(form: CardForm): CardPayload {
  const expiry = parseExpiry(form.expiry);
  if (!expiry) throw new Error('toCardPayload called with an invalid expiry');
  return { number: digitsOnly(form.number), expMonth: expiry.month, expYear: expiry.year, cvc: digitsOnly(form.cvc) };
}
