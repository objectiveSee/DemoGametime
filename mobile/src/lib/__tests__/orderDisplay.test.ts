import { formatCents, formatEventTime, summarizeOrder } from '../orderDisplay';
import type { Order } from '../paymentsApi';

const order: Order = {
  id: 'ord_demo_001',
  event: {
    id: 'evt',
    title: 'Warriors vs Lakers',
    venue: 'Chase Center',
    city: 'San Francisco, CA',
    startsAt: '2026-10-24T19:30:00-07:00',
  },
  listing: { id: 'lst', section: '115', row: '12', deliveryType: 'mobile_transfer' },
  quantity: 2,
  pricing: {
    unitPriceCents: 5800,
    subtotalCents: 11600,
    fees: [
      { label: 'Service fee', amountCents: 1740 },
      { label: 'Processing', amountCents: 250 },
    ],
    totalCents: 13590,
    currency: 'USD',
  },
};

describe('formatCents', () => {
  it.each([
    [13590, '$135.90'],
    [6920, '$69.20'],
    [5, '$0.05'],
    [0, '$0.00'],
    [123456789, '$1,234,567.89'],
  ])('%i -> %s', (cents, expected) => expect(formatCents(cents)).toBe(expected));
});

describe('formatEventTime', () => {
  it('uses the venue-local wall clock, not the device timezone', () => {
    expect(formatEventTime('2026-10-24T19:30:00-07:00')).toBe('Sat 10/24 · 7:30 PM');
  });

  it('handles noon and midnight', () => {
    expect(formatEventTime('2026-01-01T00:05:00Z')).toBe('Thu 1/1 · 12:05 AM');
    expect(formatEventTime('2026-01-01T12:00:00Z')).toBe('Thu 1/1 · 12:00 PM');
  });

  it('returns empty for malformed input', () => {
    expect(formatEventTime('soon')).toBe('');
  });
});

describe('summarizeOrder', () => {
  it('maps pricing into line items and a total', () => {
    expect(summarizeOrder(order)).toEqual({
      title: 'Warriors vs Lakers',
      meta: 'Sat 10/24 · 7:30 PM · Chase Center',
      seats: 'Sec 115 · Row 12 · 2 tickets',
      lines: [
        { label: 'Tickets (2 × $58.00)', amount: '$116.00' },
        { label: 'Service fee', amount: '$17.40' },
        { label: 'Processing', amount: '$2.50' },
      ],
      total: '$135.90',
    });
  });

  it('singularizes one ticket', () => {
    expect(summarizeOrder({ ...order, quantity: 1 }).seats).toBe('Sec 115 · Row 12 · 1 ticket');
  });
});
