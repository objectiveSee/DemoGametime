// Turns a server Order into display strings. Money stays integer cents until this boundary.
import type { Order } from './paymentsApi';

/** 13590 -> "$135.90". */
export const formatCents = (cents: number) =>
  `$${String(Math.floor(cents / 100)).replace(/\B(?=(\d{3})+$)/g, ',')}.${String(cents % 100).padStart(2, '0')}`;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * "2026-10-24T19:30:00-07:00" -> "Sat 10/24 · 7:30 PM". Reads the wall-clock fields as written so
 * the time shown is venue-local, whatever timezone the phone is in.
 */
export function formatEventTime(startsAt: string): string {
  const m = startsAt.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return '';
  const [, y, mo, d, h, min] = m.map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${weekday} ${mo}/${d} · ${hour12}:${String(min).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export type OrderSummary = {
  title: string;
  meta: string;
  seats: string;
  lines: { label: string; amount: string }[];
  total: string;
};

export function summarizeOrder(order: Order): OrderSummary {
  const { event, listing, quantity, pricing } = order;
  const tickets = `${quantity} ${quantity === 1 ? 'ticket' : 'tickets'}`;
  return {
    title: event.title,
    meta: `${formatEventTime(event.startsAt)} · ${event.venue}`,
    seats: `Sec ${listing.section} · Row ${listing.row} · ${tickets}`,
    lines: [
      {
        label: `Tickets (${quantity} × ${formatCents(pricing.unitPriceCents)})`,
        amount: formatCents(pricing.subtotalCents),
      },
      ...pricing.fees.map((fee) => ({ label: fee.label, amount: formatCents(fee.amountCents) })),
    ],
    total: formatCents(pricing.totalCents),
  };
}
