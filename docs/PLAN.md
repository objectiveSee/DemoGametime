# High-Level Plan — Checkout & Payments Take-Home

Very high level. Details live in `docs/MOCK_PLAN.md` (API contract) and `docs/REQUIREMENTS.md` (full distillation). This is the map.

## What they're asking us to build

Gametime's **checkout screen** (post-seat-selection) in React Native. Four graded pillars:

1. **Eligibility-gated payment methods** — Apple Pay (iOS + card provisioned), Google Pay (Android + set up), Affirm (total > $100), credit card (always). Eligibility is computed **on-device** and must react when the total changes.
2. **Real card validation** — formatting-as-you-type, card-brand detection, Luhn, future expiry, native keyboards; submit gated on validity.
3. **Express flows done right** — one interaction completes payment; flow survives backgrounding mid-request and kill-and-relaunch with **no double charge** (idempotency key persisted before POST).
4. **A self-designed mock payment API** — the contract itself is evaluated; ≥1 failure path (declined card / cancelled Apple Pay sheet) handled gracefully.

Plus a required **environment simulator** (dev menu forcing iOS / Android / no-provisioned-cards; real detection by default). ~3-hour budget. Eligibility logic, lifecycle handling, and form UX are weighted over visuals.

## Caveats — where the time actually goes

- **Kill-and-relaunch recovery.** Persist `{idempotencyKey, orderId}` *before* the POST, clear on terminal response, resolve leftovers on launch. This is the single most graded behavior; get the ordering right.
- **Eligibility matrix × environment simulator.** The dev-menu overrides and real detection share one code path or they will drift. Design the eligibility function pure (inputs: platform, wallet capability, total) so it's trivially spec-testable.
- **One-interaction express flow.** Apple Pay must not bounce through a confirm screen; sheet-cancel is a client-side outcome, not a server error.
- **Card form UX.** Formatting/caret/keyboard details eat time; timebox polish, keep validation logic in pure functions.
- **Affirm threshold flip.** Quantity stepper 1→2 crosses $100 ($69.20 → $135.90 by design) — the demo moment; make sure the UI visibly reacts.

## Mockups needed first (before coding)

Static mockups (per STYLE_GUIDE.md: dark only, system font, no component libs):

1. **Checkout screen** — order summary + fee breakdown, quantity stepper, payment-method list (all methods visible vs. gated variants), pay CTA.
2. **Card entry** — empty / invalid / valid states inline on checkout.
3. **Processing state** — overlay blocking double-submit.
4. **Result states** — success confirmation; declined with retry.
5. **Dev menu** — environment simulator sheet.

## Component & screen inventory

**Screens (4):**
| Screen | Purpose |
|---|---|
| Checkout | The main event: summary, stepper, methods, card form, CTA |
| Processing → Result | Spinner overlay, then success or declined (+retry) |
| Dev Menu | Environment simulator (iOS / Android / no-cards / reset) |
| (Entry stub) | Minimal "view order" entry point into checkout |

**UI components (~9):**
- `OrderSummaryCard` — event/seat info, fee rows, total
- `QuantityStepper`
- `PaymentMethodRow` + list — radio select, eligibility-gated
- `CardNumberInput` — format + brand detect
- `ExpiryInput`, `CvvInput`
- `PayButton` — method-aware label/style, validity-gated
- `ProcessingOverlay`
- `ResultView` — success / declined
- `DevMenuSheet`

**Logic modules (pure, spec-tested — ~5):**
- `eligibility.ts` — the matrix (platform, wallet, total)
- `cardValidation.ts` — Luhn, brand, expiry, formatting
- `paymentsApi.ts` — client for the mock server (`API_BASE_URL`)
- `pendingPayment.ts` — AsyncStorage persist/recover idempotency key
- `checkoutState.ts` — state machine: idle → processing → succeeded/declined/recovering

## Testing philosophy

- **Spec tests (Jest) liberally** on all pure logic: eligibility matrix, Luhn/brand/expiry, state machine, recovery ordering. Not Maestro test suites.
- **Maestro MCP is the primary driver** for exercising the real app on the iOS simulator (tap through flows, screenshot, verify visually).
- The local **maestro skill** (`.claude/skills/maestro/`) is a living doc — operational tips/gotchas only, no code specifics.

## Sequencing

1. Mockups (static screens, dark theme) ← **first**
2. Pure logic + spec tests (eligibility, validation, state machine)
3. Wire checkout to mock server (order fetch, happy-path pay)
4. Express flow + lifecycle (persist/recover idempotency, declines)
5. Dev menu / environment simulator
6. Polish only if time remains; Android at the very end
