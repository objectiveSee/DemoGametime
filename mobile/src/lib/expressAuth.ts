// Stub authorization for the express methods. Real Apple Pay / Google Pay / Affirm hand back an
// opaque token after the user authorizes; these helpers mint the same shape. The server treats any
// token with the `tok_declined` prefix as a payment the processor refused (see mock-server skill),
// which is how a simulated decline rides an otherwise normal authorization.
import * as Crypto from 'expo-crypto';

import type { PaymentMethod } from './eligibility';

export type ExpressMethod = Exclude<PaymentMethod, 'card'>;

export const DECLINED_TOKEN_PREFIX = 'tok_declined';

/** The token a successful wallet-sheet authorization yields, e.g. `tok_apple_pay_<nonce>`. */
export function expressAuthToken(
  method: ExpressMethod,
  { declined = false, nonce = Crypto.randomUUID() }: { declined?: boolean; nonce?: string } = {},
): string {
  return declined ? `${DECLINED_TOKEN_PREFIX}_${method}_${nonce}` : `tok_${method}_${nonce}`;
}

export type AffirmCheckoutParams = {
  baseUrl: string;
  /** Where the hosted page sends the fan back (deep link into the app). */
  returnUrl: string;
  amountCents: number;
  orderId: string;
  /** Makes the hosted page hand back a declined token on approve (hidden test hook). */
  simulateDecline?: boolean;
};

/** URL of the mock server's hosted Affirm page (the stand-in for Affirm's real checkout redirect). */
export function affirmCheckoutUrl({
  baseUrl,
  returnUrl,
  amountCents,
  orderId,
  simulateDecline = false,
}: AffirmCheckoutParams): string {
  const params = [
    `amount_cents=${amountCents}`,
    `order_id=${encodeURIComponent(orderId)}`,
    `return_to=${encodeURIComponent(returnUrl)}`,
  ];
  if (simulateDecline) params.push('decline=1');
  return `${baseUrl}/affirm/checkout?${params.join('&')}`;
}

export type AffirmReturn = { kind: 'approved'; token: string } | { kind: 'cancelled' };

/**
 * Reads the outcome out of the deep link the Affirm page redirects back to. Anything malformed
 * counts as cancelled: without a token there is nothing to charge, so the safe reading is "the fan
 * backed out" rather than an error state.
 */
export function parseAffirmReturn(url: string): AffirmReturn {
  const query = url.split('?')[1];
  if (!query) return { kind: 'cancelled' };
  for (const pair of query.split('&')) {
    const [key, value = ''] = pair.split('=');
    if (key !== 'token' || !value) continue;
    try {
      return { kind: 'approved', token: decodeURIComponent(value) };
    } catch {
      return { kind: 'cancelled' }; // malformed percent-encoding (URIError)
    }
  }
  return { kind: 'cancelled' };
}
