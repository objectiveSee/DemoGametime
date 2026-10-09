// Mock payment API for the checkout demo. Zero dependencies: `node server/index.js`.
// Contract and rationale: docs/MOCK_PLAN.md. All money is integer cents.
const http = require('node:http');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT) || 4000;
const DEFAULT_DELAY_MS = 1500;

const UNIT_PRICE_CENTS = 5800;
const PROCESSING_FEE_CENTS = 250;
const ORDER_ID = 'ord_demo_001';

function priceOrder(quantity) {
  const subtotalCents = UNIT_PRICE_CENTS * quantity;
  const fees = [
    { label: 'Service fee', amountCents: Math.round(subtotalCents * 0.15) },
    { label: 'Processing', amountCents: PROCESSING_FEE_CENTS },
  ];
  const totalCents = subtotalCents + fees.reduce((sum, f) => sum + f.amountCents, 0);
  return { unitPriceCents: UNIT_PRICE_CENTS, subtotalCents, fees, totalCents, currency: 'USD' };
}

function buildOrder(quantity) {
  return {
    id: ORDER_ID,
    event: {
      id: 'evt_gsw_lal',
      title: 'Warriors vs Lakers',
      venue: 'Chase Center',
      city: 'San Francisco, CA',
      startsAt: '2026-10-24T19:30:00-07:00',
    },
    listing: { id: 'lst_115_r12', section: '115', row: '12', deliveryType: 'mobile_transfer' },
    quantity,
    pricing: priceOrder(quantity),
  };
}

function parseQuantity(raw) {
  const n = raw == null ? 2 : Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 8 ? n : null;
}

function luhnValid(number) {
  if (!/^\d{12,19}$/.test(number)) return false;
  let sum = 0;
  for (let i = 0; i < number.length; i++) {
    let d = Number(number[number.length - 1 - i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

// Magic triggers (docs/MOCK_PLAN.md §3). Returns null on success or a failure tuple.
function decide(body) {
  if (body.method === 'card') {
    const number = String(body.card?.number ?? '').replace(/\s/g, '');
    if (number === '4000000000000002') return ['card_declined', 'Your card was declined.'];
    if (!luhnValid(number)) return ['incorrect_number', 'Your card number is incorrect.'];
    return null;
  }
  if (String(body.token ?? '').startsWith('tok_declined')) {
    return ['payment_failed', 'The payment could not be completed.'];
  }
  return null;
}

const randomId = (len) => crypto.randomBytes(len).toString('base64url').slice(0, len);
const confirmationCode = () => 'GT-' + crypto.randomBytes(6).toString('hex').toUpperCase().slice(0, 6);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const paymentsById = new Map();
// idempotencyKey -> Promise<payment>. Storing the promise (not the result) means a retry that
// arrives while the original is still "processing" waits on the same charge instead of a new one.
const paymentsByKey = new Map();

async function createPayment(body, delayMs) {
  await sleep(delayMs);
  const failure = decide(body);
  const payment = {
    id: 'pay_' + randomId(8),
    orderId: body.orderId,
    amountCents: body.amountCents,
    method: body.method,
    status: failure ? 'declined' : 'succeeded',
    ...(failure
      ? { failureCode: failure[0], failureMessage: failure[1] }
      : { confirmationCode: confirmationCode() }),
    createdAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  };
  paymentsById.set(payment.id, payment);
  return payment;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

const errorBody = (code, message) => ({ error: { code, ...(message && { message }) } });

async function route(req, url) {
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (req.method === 'GET' && path === '/health') return [200, { ok: true }];

  if (req.method === 'GET' && path === '/order') {
    const quantity = parseQuantity(url.searchParams.get('quantity'));
    if (quantity == null) return [400, errorBody('invalid_quantity', 'quantity must be an integer 1-8')];
    return [200, { order: buildOrder(quantity) }];
  }

  if (req.method === 'POST' && path === '/payments') {
    let body;
    try { body = await readJson(req); } catch { return [400, errorBody('invalid_json')]; }

    const key = body.idempotencyKey;
    if (typeof key !== 'string' || !key) return [400, errorBody('missing_idempotency_key')];

    if (paymentsByKey.has(key)) {
      const payment = await paymentsByKey.get(key);
      return [201, { payment, replayed: true }];
    }

    const quantity = parseQuantity(body.quantity);
    if (quantity == null) return [400, errorBody('invalid_quantity')];
    if (!['card', 'apple_pay', 'google_pay', 'affirm'].includes(body.method)) {
      return [400, errorBody('invalid_method')];
    }
    if (body.amountCents !== priceOrder(quantity).totalCents) {
      return [409, errorBody('amount_mismatch', `expected ${priceOrder(quantity).totalCents} cents`)];
    }

    const override = Number(req.headers['x-mock-delay']);
    const delayMs = Number.isFinite(override) && override >= 0 ? override : DEFAULT_DELAY_MS;
    const pending = createPayment(body, delayMs);
    paymentsByKey.set(key, pending);
    return [201, { payment: await pending }];
  }

  const match = req.method === 'GET' && path.match(/^\/payments\/([\w-]+)$/);
  if (match) {
    const payment = paymentsById.get(match[1]);
    return payment ? [200, { payment }] : [404, errorBody('not_found')];
  }

  return [404, errorBody('not_found')];
}

http
  .createServer(async (req, res) => {
    const started = Date.now();
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let status, body;
    try {
      [status, body] = await route(req, url);
    } catch (err) {
      console.error(err);
      [status, body] = [500, errorBody('internal_error')];
    }
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
    const p = body.payment;
    const detail = p ? ` ${p.id} ${p.status}${body.replayed ? ' (replayed)' : ''}` : '';
    console.log(`${new Date().toISOString()} ${req.method} ${req.url} -> ${status}${detail} ${Date.now() - started}ms`);
  })
  .listen(PORT, () => console.log(`mock payment API listening on http://localhost:${PORT}`));
