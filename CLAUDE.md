# DemoGametime

Quick take-home demo — favor working-and-simple over polished; don't get hung up on nitpicky stuff.

Development targets the **iOS simulator** (easiest to drive and iterate on). Android is deferred until the end.

Layout: `mobile/` (Expo app) · `server/` (mock payment API) · `docs/` (take-home PDF + REQUIREMENTS.md)

## Pragmatics

- Stick with out-of-the-box defaults: the most reasonable system font, no custom font installs.
- No custom component library yet — nothing fancy until actually needed.
- The app is **dark mode only**.

## Development philosophy

- **Commit often.** Every time a sub-task completes something, commit it. Everything goes straight to `main` — no pull requests, no code review. We're moving fast and that's the point.
- **Metro runs on the main worktree, main branch — always.** Anything we want to test or drive in the iOS simulator happens from the main worktree, so hot reload just works with no worktree switching.
- Subagents may do parallel code work in isolated git worktrees, but the top-level orchestrator decides per-agent: an agent in an isolated worktree does **not** use Maestro or touch the simulator; an agent given control of the simulator/Maestro works in the main worktree.

## Documentation

- **Go light on docs.** The code should document itself; the top-level orchestrator keeps the plan in its head. No plan files. Any doc that does exist must be kept current or deleted — stale docs are worse than none.

## Testing

- Write spec tests (Jest-style unit tests) liberally for logic — validation, eligibility, state. **Not** Maestro tests.
- Maestro (via the `mcp__maestro__*` tools) is the primary driver for actually exercising the app in the simulator — manual verification, not scripted test suites.
- `.claude/skills/maestro/SKILL.md` is a **living document**: whoever uses Maestro and hits tips, gotchas, or breakages folds them back into the skill. Keep it about the craft of running Maestro smoothly (device selection, flakiness, timing, common errors) — not app-code specifics.

## Linting

- ESLint (`eslint-config-expo` + `eslint-config-prettier`, `mobile/eslint.config.js`) and Prettier (root `.prettierrc`). Format-on-save is on via `.vscode/settings.json`.
- Run `npm run lint` in `mobile/` before committing app code. Don't mass-reformat; files get formatted as they're touched.
