# Mock Server Plan — Checkout & Payments

Companion to `REQUIREMENTS.md`. This plans the mock payment API in `server/` that the Expo app talks to. The PDF makes the API contract itself an evaluation criterion ("the API contract between your checkout and your mock backend is part of what we're evaluating"), so the goal is *small but defensible*: few endpoints, each with a reason to exist.

## 1. Assignment distillation (what the mock must enable)

The app must demonstrate:

1. **Eligibility-gated payment methods** — Apple Pay (iOS + card provisioned), Google Pay (Android + set up), Affirm (total > $100), card always. **Eligibility is computed on-device** (platform + stubbed SDK capability checks + order total); the PDF frames it as device/platform detection, so the server deliberately has *no* eligibility endpoint. The server's only role in eligibility is serving the order total that the Affirm rule reads.
2. **A real request/response boundary** — in-process mocks are allowed, but a local HTTP server is the strongest version of "a contract you can defend" and costs almost nothing.
3. **At least one failure path** — a declined card (server-side) and a cancelled Apple Pay sheet (client-side stub; never reaches the server).
4. **No double-charge on kill-and-relaunch mid-request** — this is the contract's keystone: **idempotency keys**. Client generates a key before submitting, persists it, and a retry with the same key replays the original result instead of charging again.
5. **Visible intermediate states** ("processing", "we don't know yet, we're checking") — the server adds artificial latency so those states actually render.
6. **Affirm reacting to total changes** — order pricing is computed server-side from quantity, so changing quantity round-trips and the total (hence Affirm eligibility) genuinely changes.

Extrapolations beyond the PDF are marked ⚠️ below.

## 2. Mock inventory

Three endpoints. All JSON. All money in **integer cents** (defensible: no float math on money).

### 2.1 `GET /order?quantity=N`

The order summary for the already-picked seats. `quantity` defaults to 2; server recomputes fees/total so the client never does money math. One hardcoded event/listing — the PDF starts *after* seat selection, so no event catalog, no listing search.

Pricing is tuned so quantity crosses the Affirm $100 threshold: **1 ticket → $69.20 (no Affirm), 2 tickets → $135.90 (Affirm appears)**. That makes the "total changed, eligibility reacted" demo a one-tap stepper interaction.

```json
{
  "order": {
    "id": "ord_demo_001",
    "event": {
      "id": "evt_gsw_lal",
      "title": "Warriors vs Lakers",
      "venue": "Chase Center",
      "city": "San Francisco, CA",
      "startsAt": "2026-10-24T19:30:00-07:00"
    },
    "listing": {
      "id": "lst_115_r12",
      "section": "115",
      "row": "12",
      "deliveryType": "mobile_transfer"
    },
    "quantity": 2,
    "pricing": {
      "unitPriceCents": 5800,
      "subtotalCents": 11600,
      "fees": [
        { "label": "Service fee", "amountCents": 1740 },
        { "label": "Processing", "amountCents": 250 }
      ],
      "totalCents": 13590,
      "currency": "USD"
    }
  }
}
```

(Service fee = 15% of subtotal, processing flat $2.50 — realistic Gametime-ish shape, trivial to compute.)

### 2.2 `POST /payments`

The single purchase endpoint for *all* methods — card and express alike. The stubbed SDKs (Apple Pay sheet, Google Pay, Affirm redirect) run on-device and produce an opaque authorization token; the server just receives `method` + token. This mirrors real PSP shape (tokenized payloads, raw PANs only for the card form) and keeps the server dumb.

Request:

```json
{
  "idempotencyKey": "b3f1c2d4-...-uuid",
  "orderId": "ord_demo_001",
  "quantity": 2,
  "amountCents": 13590,
  "method": "card",
  "card": { "number": "4242424242424242", "expMonth": 12, "expYear": 2028, "cvc": "123" }
}
```

For express methods, `card` is replaced by `"token": "tok_applepay_stub_abc123"` (whatever the stub sheet returns).

Response — always `201` with a payment resource whose `status` carries the business outcome (a declined charge is a *valid outcome*, not a transport error; this is the defensible choice and keeps client code to one path):

```json
{
  "payment": {
    "id": "pay_8f2k1",
    "orderId": "ord_demo_001",
    "amountCents": 13590,
    "method": "card",
    "status": "succeeded",
    "confirmationCode": "GT-4F7K2M",
    "createdAt": "2026-10-09T13:05:12Z"
  }
}
```

Declined variant: `"status": "declined"`, plus `"failureCode": "card_declined"`, `"failureMessage": "Your card was declined."`, no `confirmationCode`.

**Behavior:**
- **Idempotency**: in-memory `Map<idempotencyKey, response>`. A repeat key returns the stored response verbatim plus `"replayed": true` — the proof there was no second charge. (Not purely static responses, but this one `Map` is what makes the no-double-charge story demonstrable; it resets on server restart, which is fine for a demo and worth one README line.)
- **Latency**: fixed ~1500 ms delay before responding, so "processing" UI is visible and kill-mid-request is easy to demo. ⚠️ Optional nicety: honor an `x-mock-delay: <ms>` header override for demos/tests.
- **Amount check**: if `amountCents` doesn't match server-computed total for `quantity`, respond `409 { "error": { "code": "amount_mismatch" } }`. ⚠️ Extrapolation (stale-price guard) — cheap (3 lines) and makes the contract look thought-through; skip if time-pressed.

### 2.3 `GET /payments/:id`

Status lookup: `200` with the same payment resource, or `404 { "error": { "code": "not_found" } }`. Exists for the relaunch story — "app died mid-request, do we know the outcome?" Note the *primary* recovery mechanism is simpler: re-`POST` with the persisted idempotency key and let replay answer. This endpoint is the belt-and-suspenders read path and takes ~5 lines. ⚠️ Mildly extrapolated; keep it, it's nearly free.

### Not building (legitimate skips)

- No eligibility/payment-config endpoint (client-side per the PDF), no auth, no user accounts, no event catalog/search, no webhooks, no persistence across server restarts, no CORS handling (React Native `fetch` is not a browser; CORS doesn't apply).

## 3. Error & edge scenarios — deterministic triggers

Simplest mechanism: **magic card numbers** (Stripe convention, familiar to any reviewer) plus one magic token prefix. No query flags, no config.

| Scenario | Trigger | Server result |
|---|---|---|
| Happy path | `4242 4242 4242 4242` (or any other Luhn-valid number) | `status: succeeded` |
| Card declined | `4000 0000 0000 0002` | `status: declined`, `failureCode: card_declined` |
| Express declined ⚠️ | token starting `tok_declined` (dev-menu toggle in the stub SDK) | `status: declined`, `failureCode: payment_failed` |
| Cancelled Apple Pay sheet | *client-side only* — stub sheet resolves `cancelled`, no request is made | n/a (server never sees it) |
| Double-submit / kill-and-relaunch | same `idempotencyKey` re-POSTed | original response replayed, `replayed: true` |
| Stale amount ⚠️ | `amountCents` ≠ server total | `409 amount_mismatch` |

The PDF requires "at least one failure path" — declined card + cancelled sheet covers it; the ⚠️ rows are bonus depth.

## 4. Server implementation recommendation

**A single zero-dependency file: `server/index.js` using `node:http`.** Run with `node server/index.js` — no install step at all, which beats Express (needs `npm install`) and json-server (can't express idempotency replay or magic-number logic; it only does static CRUD). The whole thing is ~120 lines: a tiny JSON-body helper, a route switch on `method + path`, the pricing function, the `Map`, `setTimeout` for latency.

- **Port: `4000`** (avoids Metro's 8081, Expo tooling's 19000-range, and the commonly-occupied 3000).
- **iOS simulator reaches it at `http://localhost:4000`** — the simulator shares the Mac's network stack, so localhost just works. (Android emulator later: `http://10.0.2.2:4000`; one `Platform.select` in the app, deferred per CLAUDE.md.)
- Add a trivial `server/package.json` with `{ "name": "mock-payment-api", "private": true, "scripts": { "start": "node index.js" } }` so `npm start` works by convention — still zero deps, zero install.
- Log each request (`method path → status`) to the console; the terminal becomes the demo's "backend observability" for free.

## 5. Plumbing checklist (for the builder agent)

Server (`server/`):
1. `server/index.js` — routes from §2, pricing function, magic numbers from §3, 1500 ms delay, idempotency `Map`, request logging. `GET /health` → `{ "ok": true }` for a quick smoke check.
2. `server/package.json` — name + `start` script only.
3. Smoke-test with `curl`: `curl 'localhost:4000/order?quantity=1'`, a `POST /payments` with the decline card, and a repeated POST with the same key to see `replayed: true`.

Mobile side (owned by the mobile agents — just coordinate):
4. A single constant, e.g. `mobile/src/api/config.ts`: `export const API_BASE_URL = "http://localhost:4000"` (wrap in `Platform.select` only when Android happens).
5. The client must: generate a UUID idempotency key *per purchase attempt* (new key for a user-initiated retry after decline; same key for automatic retry/recovery), persist `{key, orderId}` to AsyncStorage before the POST, clear it on a terminal response, and on app launch check for a leftover pending key → re-POST (or `GET /payments/:id`) to resolve the unknown state.

## 6. Sequencing

1. **`GET /order` + happy-path `POST /payments`** (static success, with delay) — unblocks all mobile UI work immediately; ship this first.
2. **Idempotency replay + declined magic card** — the two contract features the rubric actually grades.
3. **`GET /payments/:id` + `/health` + amount-mismatch check** — cheap depth, do if time allows.
4. ⚠️ Skip anything else (webhooks, persistence, auth, config endpoints) — the PDF neither asks nor rewards it in a 3-hour budget.
