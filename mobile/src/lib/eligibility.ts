// Which payment methods the fan sees. Pure on purpose: real detection (Platform.OS + stubbed SDK
// capability checks) and the dev-menu environment overrides both feed the same inputs.

export type PaymentMethod = 'apple_pay' | 'google_pay' | 'affirm' | 'card';

export type EligibilityInput = {
  platform: 'ios' | 'android';
  /** Apple Pay can make payments with a provisioned Wallet card. */
  applePayCapable: boolean;
  /** Google Pay is set up on the device. */
  googlePaySetUp: boolean;
  totalCents: number;
};

/** Affirm is offered only when the total is strictly over $100. */
export const AFFIRM_MIN_EXCLUSIVE_CENTS = 10000;

export type Eligibility = Record<PaymentMethod, boolean>;

export function getEligibility({
  platform,
  applePayCapable,
  googlePaySetUp,
  totalCents,
}: EligibilityInput): Eligibility {
  return {
    apple_pay: platform === 'ios' && applePayCapable,
    google_pay: platform === 'android' && googlePaySetUp,
    affirm: totalCents > AFFIRM_MIN_EXCLUSIVE_CENTS,
    card: true,
  };
}

/** Display order: the platform wallet first, then Affirm, then card as the always-there fallback. */
const DISPLAY_ORDER: PaymentMethod[] = ['apple_pay', 'google_pay', 'affirm', 'card'];

export function eligibleMethods(input: EligibilityInput): PaymentMethod[] {
  const eligibility = getEligibility(input);
  return DISPLAY_ORDER.filter((method) => eligibility[method]);
}

export const isExpressMethod = (method: PaymentMethod) => method !== 'card';
