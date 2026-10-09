# Take-Home Requirements — World-Class Mobile Checkout

Distilled from `Staff_Mobile_Take-Home_01_Checkout_Payments.pdf`.

## The Problem

Build Gametime's checkout screen from scratch in React Native. Seats are already picked and an order summary is on screen; the fan now needs to pay. Which payment methods appear depends on platform, device provisioning, and the purchase:

- **Apple Pay** — iOS only, and only if a card is actually provisioned in Wallet
- **Google Pay** — Android only, and only if Google Pay is set up on the device
- **Affirm** — only when the purchase total is over $100
- **Credit card** — always available; the fallback for everyone

## What to Build

1. **Eligibility-gated payment methods** — Apple Pay / Google Pay / Affirm appear only when their rules are met. The rules above are the spec; detection approach is up to us.
2. **Credit card form with real validation** — card number formatting, card-type detection, Luhn, expiry-in-the-future, CVC. Native inputs with sensible `keyboardType` / `textContentType`. The checkout button must not allow submission until the card is valid.
3. **Express checkout that is actually express** — tapping Apple Pay, Google Pay, or Affirm completes the purchase in one interaction (no second submit tap). Must survive the app being backgrounded mid-flow (biometric prompt, Affirm webview redirect, OS interruption) and resume cleanly.
4. **A mock payment API we design** — stub the payment SDKs; the API contract between checkout and the mock backend is itself evaluated. Must handle at least one failure path (declined card, cancelled Apple Pay sheet) with graceful UI recovery — including no double-charging if the app is killed and relaunched mid-request.

Scope beyond this is ours to define. Evaluation weighs reasoning about eligibility detection, payment state across app-lifecycle interruptions, and form UX — more than visual polish.

## Constraints and Notes

- React Native (Expo or bare), targeting iOS and Android.
- Stub the payment SDKs — no real Apple Pay / Google Pay / Affirm sandbox credentials. Stubs should mimic the real interaction shape (native sheet, capability check, authorization token).
- Build the mock payment API ourselves — in-process mocks, a local server, or a mock native module all fine, but there must be a real request/response boundary with a defensible contract.
- Include an **environment simulator** for review — a dev menu / hidden settings / feature flag that forces "iOS", "Android", "no provisioned cards", etc., so eligibility logic can be reviewed without four devices. Real detection logic must still exist and be the default.
- Use obviously fake card numbers (e.g., 4242 4242 4242 4242). Never real ones.
- Simulator/emulator testing is fine — no physical devices or paid Apple developer account needed.

## Questions the Design Should Answer

- What happens to checkout state when the OS backgrounds the app (AppState change) during a redirect or biometric prompt? What if the fan force-quits and relaunches?
- What states can checkout be in (idle, validating, processing, declined, succeeded) and what does the fan see in each — including "we don't know yet, we're checking"?
- When does card validation fire (keystroke, blur, submit), and how does that interact with keychain/Google autofill?
- If the order total changes (quantity, fees), how does Affirm's eligibility react?

## What They're Looking For (Evaluation Criteria)

- A working checkout where payment-method visibility matches the eligibility rules
- A credit card form with real validation and a submit button that enforces it
- Express flows that complete the purchase without a second submit and survive an app-lifecycle interruption mid-flow
- A mock API with a defensible contract, including at least one failure path handled in the UI
- Clean, idiomatic React Native code in a reviewable repo

## Time Expectation

Roughly 3 hours with modern dev tools. Prioritize eligibility logic, payment state across lifecycle events, and form validation over visual design.

## Submission / README Must Cover

- What was built and how to run it (Expo Go, simulator, emulator — which platforms were tested)
- How eligibility detection works and how to use the environment simulator
- The mock API contract and why it's shaped that way
- How payment state flows from "tap" to "confirmed" for express vs. card, and what happens across backgrounding / kill-and-relaunch mid-flow
- Tradeoffs made, and what we'd do differently with more time
