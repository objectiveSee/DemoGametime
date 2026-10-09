// Mock payment API for the checkout demo. Zero dependencies: `node server/index.js`.
// Contract and rationale: README.md "Mock API contract". All money is integer cents.
const http = require('node:http');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT) || 4000;
const DEFAULT_DELAY_MS = 1500;
// Test hook: POST /debug/delay sets this so Maestro flows get a deterministic processing window
// without the app sending an x-mock-delay header. The header still wins when present.
let delayOverrideMs = null;

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

// Magic triggers (README.md "Mock API contract"). Returns null on success or a failure tuple.
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

const formatCents = (cents) => `$${(cents / 100).toFixed(2)}`;

// JSON.stringify for inline <script>: escaping '<' keeps a crafted return_to from closing the tag.
const scriptString = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

function affirmPage(params) {
  const amount = Number(params.get('amount_cents'));
  const amountLabel = Number.isFinite(amount) ? formatCents(amount) : 'your order';
  const returnTo = params.get('return_to') || '';
  const token = (params.get('decline') === '1' ? 'tok_declined_affirm_' : 'tok_affirm_') + randomId(10);
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Affirm (Demo)</title>
<style>
  body { margin: 0; font-family: -apple-system, system-ui, sans-serif; background: #0E0F11; color: #fff;
         display: flex; min-height: 100vh; align-items: center; justify-content: center; }
  .card { width: min(360px, 88vw); background: #1A1B1E; border: 1px solid #2C2D31; border-radius: 16px;
          padding: 28px 24px; text-align: center; }
  h1 { font-size: 26px; margin: 0; font-weight: 800; letter-spacing: -0.5px; }
  h1 span { color: #4A4AF4; }
  p { color: #C9CACD; font-size: 15px; line-height: 1.5; margin: 14px 0 24px; }
  button { display: block; width: 100%; border: 0; border-radius: 8px; padding: 15px; font-size: 16px;
           font-weight: 600; cursor: pointer; }
  #approve { background: #4A4AF4; color: #fff; }
  #cancel { background: none; color: #8E8F94; margin-top: 10px; }
</style></head>
<body><div class="card">
  <h1>a<span>f</span>firm <small style="font-size:13px;color:#8E8F94;font-weight:400">(demo)</small></h1>
  <p>Pay ${amountLabel} over time.<br>4 interest-free payments — demo only, nothing is real.</p>
  <button id="approve">Approve plan</button>
  <button id="cancel">Cancel</button>
</div>
<script>
  const back = (query) => { location.href = ${scriptString(returnTo)} + (${scriptString(returnTo)}.includes('?') ? '&' : '?') + query; };
  document.getElementById('approve').onclick = () => back('token=' + encodeURIComponent(${scriptString(token)}));
  document.getElementById('cancel').onclick = () => back('cancelled=1');
</script></body></html>`;
}

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

    const header = Number(req.headers['x-mock-delay']);
    const delayMs =
      Number.isFinite(header) && header >= 0 ? header : (delayOverrideMs ?? DEFAULT_DELAY_MS);
    const pending = createPayment(body, delayMs);
    paymentsByKey.set(key, pending);
    return [201, { payment: await pending }];
  }

  // Stand-in for Affirm's hosted checkout: the app opens this in a browser (a real redirect out of
  // the app), the fan approves or cancels, and the page deep-links back with the outcome. Approve
  // hands back a one-time token; `decline=1` makes that token carry the declined magic prefix.
  if (req.method === 'GET' && path === '/affirm/checkout') {
    return [200, affirmPage(url.searchParams), 'text/html'];
  }

  if (req.method === 'POST' && path === '/debug/delay') {
    let body;
    try { body = await readJson(req); } catch { return [400, errorBody('invalid_json')]; }
    delayOverrideMs = Number.isFinite(body.ms) && body.ms >= 0 ? body.ms : null;
    return [200, { ok: true, delayMs: delayOverrideMs }];
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
    let status, body, contentType;
    try {
      [status, body, contentType = 'application/json'] = await route(req, url);
    } catch (err) {
      console.error(err);
      [status, body, contentType] = [500, errorBody('internal_error'), 'application/json'];
    }
    res.writeHead(status, { 'Content-Type': contentType });
    res.end(contentType === 'application/json' ? JSON.stringify(body) : body);
    const p = contentType === 'application/json' ? body.payment : undefined;
    const detail = p ? ` ${p.id} ${p.status}${body.replayed ? ' (replayed)' : ''}` : '';
    console.log(`${new Date().toISOString()} ${req.method} ${req.url} -> ${status}${detail} ${Date.now() - started}ms`);
  })
  .listen(PORT, () => console.log(`mock payment API listening on http://localhost:${PORT}`));
