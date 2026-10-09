// The no-double-charge keystone. Before any POST /payments, the exact attempt (idempotency key +
// amount) is written to disk. If the app dies mid-request, the relaunch finds the snapshot and
// re-POSTs it verbatim: the server replays the original result for that key instead of charging
// again. Recovery must use the snapshot, never re-derived order state — the server answers 409 if
// the amount doesn't match, and a fresh key would be a second charge.
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RecoveryOutcome } from './checkoutState';
import {
  isOutcomeUnknown,
  toReceipt,
  type PaymentAttempt,
  type PaymentCredentials,
  type PaymentResponse,
} from './paymentsApi';

export const PENDING_PAYMENT_KEY = 'gametime.pendingPayment.v1';

export type PaymentSnapshot = PaymentAttempt & {
  /**
   * Express authorization token, so a replay is complete even if the original POST never reached
   * the server. Card numbers are never persisted.
   */
  token?: string;
};

const METHODS = ['card', 'apple_pay', 'google_pay', 'affirm'];

function isSnapshot(value: unknown): value is PaymentSnapshot {
  const v = value as Record<string, unknown> | null;
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof v.idempotencyKey === 'string' &&
    v.idempotencyKey.length > 0 &&
    typeof v.orderId === 'string' &&
    Number.isInteger(v.quantity) &&
    Number.isInteger(v.amountCents) &&
    METHODS.includes(v.method as string) &&
    (v.token === undefined || typeof v.token === 'string')
  );
}

export async function persistSnapshot(snapshot: PaymentSnapshot): Promise<void> {
  await AsyncStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(snapshot));
}

/** The pending attempt, or null. A corrupt entry is discarded rather than crashing launch. */
export async function loadSnapshot(): Promise<PaymentSnapshot | null> {
  const raw = await AsyncStorage.getItem(PENDING_PAYMENT_KEY);
  if (raw == null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isSnapshot(parsed)) return parsed;
  } catch {
    // fall through
  }
  await clearSnapshot();
  return null;
}

export async function clearSnapshot(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_PAYMENT_KEY);
}

/** Splits a snapshot back into the POST body parts, preserving its key and amount exactly. */
export function attemptFromSnapshot(snapshot: PaymentSnapshot): {
  attempt: PaymentAttempt;
  credentials: PaymentCredentials;
} {
  const { idempotencyKey, orderId, quantity, amountCents, method, token } = snapshot;
  return {
    attempt: { idempotencyKey, orderId, quantity, amountCents, method },
    credentials: token ? { token } : {},
  };
}

/** Maps a POST /payments result for a replayed snapshot onto the checkout state machine. */
export function recoveryOutcome(snapshot: PaymentSnapshot, { payment, replayed }: PaymentResponse): RecoveryOutcome {
  if (payment.status === 'succeeded') return { kind: 'succeeded', receipt: toReceipt(payment) };
  // A card replay carries no card details. If the server had never seen this key it evaluated a
  // card-less request and declined it — meaning the original never charged. Start over cleanly
  // instead of showing the fan a misleading "incorrect number".
  if (snapshot.method === 'card' && !replayed) return { kind: 'not_charged' };
  return { kind: 'declined', failure: { code: payment.failureCode, message: payment.failureMessage } };
}

/**
 * Resolves a pending snapshot by re-POSTing it with the same idempotency key. Clears the snapshot
 * only on a definitive answer; when the outcome is still unknown (offline, 5xx) it rethrows and
 * the snapshot stays for the next attempt.
 */
export async function recoverPendingPayment(
  snapshot: PaymentSnapshot,
  post: (attempt: PaymentAttempt, credentials: PaymentCredentials) => Promise<PaymentResponse>,
): Promise<RecoveryOutcome> {
  const { attempt, credentials } = attemptFromSnapshot(snapshot);
  let outcome: RecoveryOutcome;
  try {
    outcome = recoveryOutcome(snapshot, await post(attempt, credentials));
  } catch (err) {
    if (isOutcomeUnknown(err)) throw err;
    // The server checks the key before anything else, so a 4xx means it has no charge for this
    // key: nothing was taken.
    outcome = { kind: 'not_charged' };
  }
  await clearSnapshot();
  return outcome;
}
