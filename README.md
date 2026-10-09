# Gametime Checkout & Payments — Take-Home

A React Native (Expo) checkout screen with eligibility-gated payment methods, a fully validated card form, stubbed express wallets (Apple Pay / Google Pay / Affirm), and a mock payment API whose idempotency contract makes "killed mid-charge, never double-charged" a demonstrable fact rather than a claim — built end-to-end by AI agents inside an agentic harness this repo also contains (see [Development harness](#development-harness)).

Layout: `mobile/` (Expo app) · `server/` (mock payment API, zero dependencies) · `docs/` (take-home PDF + distilled requirements).

## Development harness

This repo is an agentic harness — a self-contained environment in which AI agents build, test, and iterate on a feature autonomously — and the checkout is the feature it built. The harness's parts, as they exist here:

- **Verification loops the agents close themselves:** Maestro on the iOS simulator (interactively via MCP while building, plus the committed requirement suite), the 381 Jest specs, and the mock server as ground truth (flow 07 reads its charge counter to prove single-charge; its request log shows the replay).
- **Operational knowledge as code:** `.claude/skills/maestro` and `.claude/skills/mock-server` are living skills — agents read them before driving the simulator or the API, and fold gotchas back in as they hit them.
- **Policy as code:** `CLAUDE.md` carries the rules — worktree/simulator ownership, commit-per-subtask straight to `main`, the Expo Go constraint, lint before committing.
- **Process:** a top-level orchestrator dispatches focused subagents per subtask; adversarial review agents audit the result against the take-home rubric. The commit history is the audit trail.
- **The mock server doubles as a harness fixture:** deterministic magic triggers, the `x-mock-delay` header, `POST /debug/delay`, and `GET /debug/charges` exist so agents can exercise lifecycle edges (like kill-mid-charge) deterministically.

## Running it

Prerequisites: Node 18+, Xcode with an iOS simulator, Expo Go on that simulator (Expo installs it automatically on first `--ios` launch). Optional Android path: Android Studio with an emulator. No prebuild, no dev client, no Apple developer account.

```sh
# 1. Mock payment API (port 4000) — from the repo root
node server/index.js            # or: cd server && npm start  (also tees the log to server/server.log)

# 2. The app — in a second terminal
cd mobile
npm install
npx expo start --ios            # opens in Expo Go on the booted simulator
npx expo start --android        # or: on a booted emulator with Expo Go installed

# 3. Unit specs — 381 tests over validation, eligibility, state, recovery
cd mobile && npm test
```

**Platforms tested:** iOS simulator (iPhone 17 Pro, iOS 26.1) is the primary, fully tested target; Android 15 (Pixel 9 emulator, Expo Go) passes the same Maestro suite (10/10) and was also smoke-tested by hand, including hardware back on the wallet sheet.

### Maestro requirement suite

Each numbered flow in `mobile/.maestro/` proves one rubric requirement end-to-end on the simulator. With Metro running (`:8081`), the mock server up (`:4000`), and the iOS simulator booted with Expo Go installed:

```sh
cd mobile && maestro test .maestro
```

The same command runs on an Android emulator with Expo Go (`adb reverse tcp:8081 tcp:8081` first; add `--device emulator-5554` if the simulator is also booted). Flows read the platform to pick Expo Go's app id and the device's wallet (Apple Pay / Google Pay).

| Flow | Proves |
|---|---|
| 01 | Affirm appears/disappears as the quantity stepper moves the total across $100 |
| 02 | Pay button stays disabled (and ignores taps) until the card form is valid — Luhn, expiry-in-the-future, CVC length |
| 03 | Card happy path → server-issued `GT-` confirmation; Start New Order resets cleanly |
| 04 | Declined card is a handled outcome; Try Again returns to the form with the card intact |
| 05 | Express is one interaction: tap Apple Pay → confirmation, no second submit anywhere |
| 06 | Cancelling the wallet sheet is a clean no-op — no request, no error UI, back to idle |
| 07 | **Kill the app mid-charge, relaunch → "Checking…" → original outcome. Exactly one charge** |
| 08 | A declined express payment recovers gracefully (long-press = hidden decline hook) |
| 09 | Affirm redirects through a real browser and deep-links back to a completed purchase |
| 10 | Environment simulator forces every eligibility branch from one device |

Flow 07 is the keystone: it sets the server's processing delay to 20 s, kills Expo Go while the charge is in flight, cold-starts it, and asserts recovery lands on the original payment. It then verifies single-charge itself: it reads the server's distinct-charge count (`GET /debug/charges`) before and after, and fails unless it moved by exactly 1 — replays under the same idempotency key don't count. The server's stdout — or `server/server.log` when run via `npm start` — tells the same story: one `pay_` id across both POSTs, the second marked `(replayed)`.

## Eligibility detection & the environment simulator

Eligibility is one pure function, `mobile/src/lib/eligibility.ts`:

| Method | Rule |
|---|---|
| Apple Pay | platform is iOS **and** a Wallet card is provisioned |
| Google Pay | platform is Android **and** Google Pay is set up |
| Affirm | order total strictly over $100 |
| Card | always |

Inputs come from `useEnvironment()`: `Platform.OS` is real; the wallet checks (`mobile/src/lib/walletCapability.ts`) are async stubs shaped like `PKPaymentAuthorizationController.canMakePayments(usingNetworks:)` / Google Pay `isReadyToPay` (neither is reachable from Expo Go). They answer `true` after a short delay; a `false` or a failed check hides that wallet, and swapping in the real SDK call changes nothing else. The payment methods wait behind the loading spinner until the checks answer, so a wallet button never pops in above Affirm under the fan's finger. The Affirm input is the server-priced total, so changing quantity genuinely re-evaluates eligibility — the pricing is tuned so 1 ticket ($69.20) vs 2 ($135.90) crosses the threshold with one tap.

**Real detection is the default.** The gear at the top right opens the environment simulator (a native page sheet) for reviewing every branch on one device:

- Platform: auto / force iOS / force Android
- "No provisioned cards" (Apple Pay off) and "Google Pay not set up"
- Force express decline — the next authorization hands back a declined token
- Component gallery toggle, and Reset back to detection

Two deliberate properties: overrides are **in-memory only** (a persisted override would survive the kill-and-relaunch demo and make a fresh launch lie about the device), and the wallet toggles can only **remove** a capability, never fake one the device doesn't report — the merge is `detected && !override`. The platform override is different by design: it substitutes the platform outright, so a reviewer with one device sees the other platform's wallet. A dot on the gear marks any active override. Environment changes apply live but never mid-attempt: a busy checkout keeps its method list until the attempt settles.

## Mock API contract

`server/index.js` — a single zero-dependency `node:http` file, deliberately a prop supporting the app rather than a graded artifact in itself. In-memory store; restarting the server forgets all payments (fine for a demo, stated as a limitation). All money is **integer cents**; errors are `{"error":{"code","message?"}}`.

| Endpoint | Purpose |
|---|---|
| `GET /order?quantity=N` | Server-priced order (subtotal, fees, total) — the client never does money math |
| `POST /payments` | The single purchase endpoint for every method |
| `GET /payments/:id` | Status lookup by payment id. Part of the contract; the app doesn't call it — recovery re-POSTs the snapshot under the same idempotency key instead |
| `GET /affirm/checkout` | Hosted HTML stand-in for Affirm's redirect; deep-links back with a token or a cancel |
| `POST /debug/delay` | Test hook: pin the processing delay (used by flow 07); `x-mock-delay` header overrides per-request |
| `GET /debug/charges` | Test hook: `{"count"}` of distinct charges started (one per idempotency key; replays don't count) — flow 07 asserts it moves by exactly 1 |
| `GET /health` | `{"ok":true}` |

Design decisions, and why:

- **Declines are `201` with `status: "declined"`**, never an HTTP error. A refused charge is a business outcome the payment resource carries (`failureCode`, `failureMessage`); 4xx/5xx are reserved for malformed requests and transport problems. The client gets exactly one happy-path shape to parse.
- **`idempotencyKey` is the contract's keystone.** The server keys charges on it, and a repeated key replays the original payment with `"replayed": true` instead of charging again. It stores the *promise*, not the result — so a replay arriving while the original charge is still processing parks on the same in-flight charge and both callers get the same payment. That's what makes the relaunched client in flow 07 land on the original outcome even when it comes back before the first request finishes.
- **`409 amount_mismatch`** if `amountCents` doesn't match the server-computed total for the quantity — a stale-price guard on *new* attempts. A known key is answered with its stored payment before the amount is checked, so key reuse, not the 409, is what keeps recovery from charging twice. (Reusing a key with a different body therefore returns the original payment; a real PSP would 409 that, and the app never does it.)
- **One request shape for all methods.** Card attempts carry `card: {number, expMonth, expYear, cvc}`; express attempts carry an opaque `token` minted by the stub SDK — mirroring real PSP tokenization and keeping the server dumb.
- **Deterministic failure triggers** (Stripe convention): `4242 4242 4242 4242` succeeds, `4000 0000 0000 0002` declines, any non-Luhn number declines as `incorrect_number`, and any token prefixed `tok_declined` declines as `payment_failed`. A cancelled wallet sheet never reaches the server at all.
- **~1.5 s default processing delay**, so "processing" is a real visible state and killing mid-request is easy to do by hand.

## Payment state: tap → confirmed

One reducer (`mobile/src/lib/checkoutState.ts`) owns the truth; events that are illegal in the current state are no-ops, so double-taps and late callbacks can't move checkout somewhere invalid. States:

`idle → validating → processing → succeeded | declined` (card)
`idle → authorizing → processing → succeeded | declined` (express)
plus `checking` — "we don't know yet" — entered from a relaunch with a pending attempt or a request that lost its response.

**Card:** Pay is disabled until the form validates (fields format on every change — typing, paste, and keychain autofill all arrive as whole-field values and format identically; errors appear on blur, or on every field when a not-yet-valid Pay is tapped, then clear live). Submit re-validates, writes a snapshot `{idempotencyKey, orderId, quantity, amountCents, method}` to AsyncStorage, *then* POSTs. A definitive answer clears the snapshot and settles the state.

**Express:** one tap opens the authorization — a stub wallet sheet that mimics the real shape (slides up, shows the total, fake biometric, auto-authorizes; cancellable via ✕ or scrim until authorization fires), or for Affirm a real browser redirect (`openAuthSessionAsync` against the server's hosted page) that deep-links back. Authorization yields a token; the snapshot is persisted **with the token**, then the same POST path runs. No second submit anywhere.

**Backgrounding:** there is deliberately no AppState choreography. A system prompt (`inactive`) leaves JS running; an app switch (`background`) suspends it, the in-flight `fetch` completes when the app returns, or fails and is replayed under the same key, and the state machine picks up where it was. Affirm's browser takes the screen differently per platform (measured with an `AppState` listener): on iOS the auth session presents over the app and `AppState` never leaves `active`; on Android the Chrome Custom Tab fully backgrounds the app (`background` → `active`). Either way the await spans the whole browser round trip. The design treats **kill as the general case** and makes it safe, which makes mere backgrounding free.

**Kill-and-relaunch:** the snapshot is written *before* every POST, so a killed app leaves evidence. On launch, a found snapshot moves checkout to `checking` ("Checking your payment…") and re-POSTs the snapshot verbatim — same key, same amount — with exponential backoff until the server answers definitively. Replay semantics guarantee the answer is the *original* charge's outcome: success shows the original confirmation code; a decline shows the decline. One honest wrinkle: **card numbers are never persisted**, so a card replay carries no card. If the server says `replayed: true`, the original outcome stands; if it doesn't (the original POST never arrived), the card-less request fails validation — which proves nothing was charged, so recovery resets to idle with "You have not been charged." That heuristic trades a tiny ambiguity window for never writing a PAN to disk. Death mid-authorization (killed while the Affirm browser is up) is safe too: the snapshot is written only once a token comes back, so the app relaunches into idle with nothing charged — on Android via the returning deep link, on iOS directly (the auth session dies with the app).

**Single charge, evidenced:** flow 07 asserts it mechanically via `GET /debug/charges` (above). For a human-readable trail, the server logs every request to stdout (and to `server/server.log` when run via `npm start`). A kill-and-relaunch run shows two `POST /payments` lines with one payment id — the second marked `(replayed)`:

```
POST /payments -> 201 pay_Ab3dE9fG succeeded 20013ms
POST /payments -> 201 pay_Ab3dE9fG succeeded (replayed) 4210ms
```

## Tradeoffs

- **Stubbed wallet SDKs.** The sheets mimic the real interaction shape (capability check → sheet → authorization token) but aren't PassKit/Google Pay. The stub boundary is the same one a real integration would occupy: swap the sheet, keep the token-shaped contract.
- **Expo Go constraint** — JS-only dependencies, no custom native modules. That rules out real wallet APIs and Face ID, but bought fast iteration and a Maestro-drivable app with zero build steps for a reviewer.
- **No navigation library.** Checkout is a single screen; the result renders as a layer over the form. That kills the back-gesture-mid-payment class of bugs outright and keeps Try Again landing exactly where the fan left off — right for this scope, not a stance against navigation generally.
- **In-memory server.** Restart forgets payments and idempotency keys. Acceptable for a demo; a real backend persists both. It also means a server restart mid-recovery can mislabel a card payment: the replay arrives under an unknown key, processes as a new card-less attempt, declines `incorrect_number`, and reads as "not charged" even if the original charge went through.
- **A failed snapshot read unlocks checkout.** If AsyncStorage can't be read at launch, checkout starts idle rather than locking the fan out, and a new attempt (with a fresh key) overwrites any pending record. If the killed attempt had in fact charged and the fan pays again, that is a double charge. It needs a storage-read failure on top of a mid-charge kill; we chose that risk over locking the fan out of checkout on a storage failure.
- **Card recovery without the PAN** (above): the `replayed` flag, not resubmitted credentials, decides the outcome. Real systems tokenize the card first so the retry carries a token, same as express here.
- **Quantity stepper** is a demo affordance — the PDF starts after seat selection — kept because it makes "total changed, Affirm reacted" a one-tap demonstration.
- **Dark mode only** (per project pragmatics); light mode is unhandled.
- **Android runs the suite on an emulator only** (no physical device). One Android-only accommodation: Expo Go draws edge-to-edge and `automaticallyAdjustKeyboardInsets` is iOS-only, so on Android checkout pads its scroll content by the keyboard height to keep the card fields and Pay button above the keyboard. Android reports an animator duration scale of 0 (common on emulators and CI) to apps as reduce-motion, so animations deliberately jump-cut there; on devices with default settings they play.
- **No drag-to-dismiss on the wallet sheet.** Cancellation is the ✕, the scrim, or hardware back; a real sheet gesture was polish the budget didn't justify.

## With more time

- Real PassKit / Google Pay integration behind the same `EligibilityInput` + token contract (requires a dev build instead of Expo Go), and the real Affirm SDK behind the existing redirect shape.
- Server persistence (SQLite) and auth, so idempotency survives restarts and payments belong to a user.
- CI: Jest + the Maestro suite against a headless iOS simulator and Android emulator.
- Accessibility audit beyond the current reduced-motion support — VoiceOver labels/ordering on the sheets and form errors as announcements.
- Card-number tokenization before persistence, closing the recovery wrinkle properly.
