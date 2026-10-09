// Thin fetch client for the mock payment API (server/index.js). All money is integer cents.
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import type { CardPayload } from './cardValidation';
import type { Receipt } from './checkoutState';
import type { PaymentMethod } from './eligibility';

// The iOS simulator shares the Mac's network stack; the Android emulator reaches the host via 10.0.2.2.
export const API_BASE_URL = Platform.select({ android: 'http://10.0.2.2:4000', default: 'http://localhost:4000' });

const REQUEST_TIMEOUT_MS = 15000;

export type Order = {
  id: string;
  event: { id: string; title: string; venue: string; city: string; startsAt: string };
  listing: { id: string; section: string; row: string; deliveryType: string };
  quantity: number;
  pricing: {
    unitPriceCents: number;
    subtotalCents: number;
    fees: { label: string; amountCents: number }[];
    totalCents: number;
    currency: string;
  };
};

type PaymentBase = { id: string; orderId: string; amountCents: number; method: PaymentMethod; createdAt: string };

/** A declined charge is a valid outcome carried in `status`, not a transport error. */
export type Payment =
  | (PaymentBase & { status: 'succeeded'; confirmationCode: string })
  | (PaymentBase & { status: 'declined'; failureCode: string; failureMessage: string });

/** Everything that identifies one purchase attempt. Persisted before the POST (see pendingPayment). */
export type PaymentAttempt = {
  idempotencyKey: string;
  orderId: string;
  quantity: number;
  amountCents: number;
  method: PaymentMethod;
};

export type PaymentCredentials = { card: CardPayload } | { token: string } | Record<string, never>;

export type PaymentResponse = { payment: Payment; replayed: boolean };

export const toReceipt = (payment: Extract<Payment, { status: 'succeeded' }>): Receipt => ({
  paymentId: payment.id,
  confirmationCode: payment.confirmationCode,
  amountCents: payment.amountCents,
  method: payment.method,
});

/**
 * status 0 = the request never got a response (offline, timeout). Together with 5xx that means
 * "outcome unknown" — the charge may or may not have happened, so recover with the same key.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'ApiError';
  }
}

export const isOutcomeUnknown = (err: unknown) => !(err instanceof ApiError) || err.status === 0 || err.status >= 500;

export const newIdempotencyKey = () => Crypto.randomUUID();

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...init, signal: controller.signal });
  } catch (err) {
    throw new ApiError(0, 'network_error', err instanceof Error ? err.message : String(err));
  } finally {
    clearTimeout(timer);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body?.error?.code ?? 'http_error', body?.error?.message);
  }
  return body as T;
}

export async function getOrder(quantity: number): Promise<Order> {
  const { order } = await request<{ order: Order }>(`/order?quantity=${quantity}`);
  return order;
}

/**
 * Charges exactly what the attempt says. Callers pass the persisted attempt (never re-derived
 * order state) so a recovery replay sends the same key and amount as the original.
 */
export async function postPayment(
  attempt: PaymentAttempt,
  credentials: PaymentCredentials = {},
  options: { mockDelayMs?: number } = {},
): Promise<PaymentResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.mockDelayMs != null) headers['x-mock-delay'] = String(options.mockDelayMs);
  const { payment, replayed } = await request<{ payment: Payment; replayed?: boolean }>('/payments', {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...attempt, ...credentials }),
  });
  return { payment, replayed: replayed === true };
}

export async function getPayment(id: string): Promise<Payment> {
  const { payment } = await request<{ payment: Payment }>(`/payments/${encodeURIComponent(id)}`);
  return payment;
}
