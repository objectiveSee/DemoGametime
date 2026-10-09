---
name: mock-server
description: Run, check, and exercise the local mock payment API (server/index.js on port 4000). Use when starting/stopping the server, curling the payment API, forcing a decline or delay, or debugging checkout network calls. Triggers - "mock server", "payment API", "magic cards", "test card", "force a decline", "server not responding", "port 4000".
---

# Mock payment server

> `server/index.js` is the source of truth (zero dependencies, ~170 lines). The contract rationale lives in README.md "Mock API contract". If this file and the code disagree, the code wins — fix this file.

## Start / stop / check

- **Check first** — it's usually already running as a daemon:
  `curl -s localhost:4000/health` → `{"ok":true}`
- **Start detached** (from repo root, survives the shell):
  `nohup node server/index.js > server/server.log 2>&1 &`
  Foreground alternatives: `node server/index.js`, or `npm start` inside `server/`.
- **Log:** `server/server.log` (gitignored). One line per request: method, path, status, payment id + status, `(replayed)`, duration.
- **Who's on the port / stop it:** `lsof -iTCP:4000 -sTCP:LISTEN` then `kill <pid>`.
- Port override: `PORT=4001 node server/index.js`.

## Endpoints

All money is integer cents. Errors are `{"error":{"code","message?"}}`.

| Call | Notes |
|---|---|
| `GET /health` | `{ok:true}` |
| `GET /order?quantity=N` | Priced order. `quantity` defaults to 2; must be integer 1-8 else 400 `invalid_quantity` |
| `POST /payments` | Body: `idempotencyKey`, `quantity`, `amountCents`, `method` (`card`/`apple_pay`/`google_pay`/`affirm`), plus `card.number` or `token` |
| `GET /payments/:id` | 200 `{payment}` or 404 `not_found` |
| `GET /affirm/checkout` | HTML stand-in for Affirm's hosted checkout. Query: `amount_cents`, `order_id`, `return_to` (deep link the page redirects back to with `?token=tok_affirm_…` on approve or `?cancelled=1`), `decline=1` makes the approve token carry the `tok_declined` prefix |
| `POST /debug/delay` | Test hook: `{"ms":20000}` overrides the default processing delay for all payments until `{"ms":null}` resets it. Lets Maestro flows kill the app mid-charge deterministically. An `x-mock-delay` header still wins over the override |
| `GET /debug/charges` | Test hook: `{count}` = distinct charges started (one per idempotency key, in flight or settled; replays don't count). Flow 07 reads it before and after to assert exactly one charge |

## Magic triggers

**Declines are HTTP 201 with `payment.status: "declined"`** — not an HTTP error. Only validation problems are 4xx.

| Input | Result |
|---|---|
| card `4242 4242 4242 4242` (any Luhn-valid number) | `succeeded` + `confirmationCode` (`GT-XXXXXX`) |
| card `4000 0000 0000 0002` | declined, `card_declined` |
| card failing Luhn (or not 12-19 digits) | declined, `incorrect_number` |
| `token` starting with `tok_declined` (wallets/affirm) | declined, `payment_failed` |
| `amountCents` ≠ server total for `quantity` | **409** `amount_mismatch` ("expected N cents") |
| missing `idempotencyKey` | 400 `missing_idempotency_key` |
| header `x-mock-delay: <ms>` | overrides the default ~1500 ms processing delay (`0` = instant) |

Spaces in card numbers are stripped server-side.

## Idempotency

- Same `idempotencyKey` → same payment back with `replayed: true`. The replay ignores the rest of the body (a bare `{"idempotencyKey":"..."}` works).
- A retry **while the original is still in flight** waits on the same charge and returns it — no double charge.
- Everything is in memory: restarting the server forgets all payments and keys.

## Quick test

```bash
curl -s -H 'Content-Type: application/json' -H 'x-mock-delay: 0' localhost:4000/payments \
  -d '{"idempotencyKey":"k1","quantity":2,"amountCents":13590,"method":"card","card":{"number":"4000000000000002"}}'
```

(13590 = total for quantity 2; get it from `GET /order?quantity=2` → `order.pricing.totalCents` rather than hardcoding.)

## Gotchas

- In zsh, quote URLs with `?` (`curl -s 'localhost:4000/order?quantity=2'`) or it errors with "no matches found".
- iOS simulator reaches the host at `localhost:4000`. An Android emulator would need `10.0.2.2:4000`; a physical device needs the Mac's LAN IP.
- Server restarted mid-session → old payment ids 404 and old idempotency keys create fresh charges.
