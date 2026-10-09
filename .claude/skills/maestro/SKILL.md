---
name: maestro
description: Drive this project's app on the iOS simulator using the Maestro MCP tools (mcp__maestro__*). Use when asked to screenshot the app, tap/type/assert in the running app, run a Maestro flow, or verify UI changes end-to-end. Triggers - "maestro", "screenshot the app", "tap on", "drive the app", "run a flow", "verify on the simulator".
---

# Maestro — driving the app on the iOS Simulator

> **Living document.** If you use Maestro and hit a tip, gotcha, or breakage, fold it back into this file. Keep the content about the craft of running Maestro smoothly (device selection, flakiness, timing, common errors) — not app-code specifics like particular testIDs or screen copy.

## Rules

- **iOS simulator ONLY.** Never start or touch Android emulators (e.g. `Pixel_9_API_35` shows up in `list_devices` — ignore it). Android is deferred until the end of the project.
- The app runs inside **Expo Go**, so the app id for launch/stop/flow headers is **`host.exp.Exponent`** — NOT the bundle id in `app.json` (that only applies after a prebuild/dev-client build, which we are not using).
- Maestro/simulator work happens from the **main worktree** only (see CLAUDE.md): Metro runs there, so agents in isolated worktrees must not drive the simulator.
- If the Maestro MCP tools are deferred, load them all in ONE ToolSearch call: `select:mcp__maestro__list_devices,mcp__maestro__take_screenshot,mcp__maestro__tap_on,...`

## Prerequisites (usually already running)

- Expo dev server: started detached from `mobile/` on the main worktree with `nohup npx expo start --ios > .expo/dev-server.log 2>&1 &`. Check with `curl -s http://localhost:8081/status` → `packager-status:running`. Log: `mobile/.expo/dev-server.log`.
- Simulator: **iPhone 17 Pro, iOS 26.1, UDID `E4FE3B90-0B7D-4710-8357-CB69FC312296`** — this UDID is the `device_id` for every Maestro call. If it's not booted: `xcrun simctl boot <UDID> && open -a Simulator`, or `mcp__maestro__start_device` with that device_id.
- If Expo Go isn't showing the app, relaunch with `mcp__maestro__launch_app` (appId `host.exp.Exponent`) or `xcrun simctl openurl booted exp://localhost:8081`.

## Finding the right device

`mcp__maestro__list_devices` returns every simulator on the machine; the booted/usable one has `"connected": true`. Don't guess — pick the connected iOS simulator.

## The tools

| Tool | What it does |
|---|---|
| `list_devices` | All devices; booted one has `connected: true` |
| `start_device` | Boot a simulator by device_id (or platform `ios`) |
| `launch_app` / `stop_app` | Launch/kill by appId (`host.exp.Exponent`) |
| `take_screenshot` | Returns a screenshot image — the ground truth for "did it render" |
| `inspect_view_hierarchy` | CSV of elements with bounds, text, resource-ids; coordinates are in points (402x874 on iPhone 17 Pro) |
| `tap_on` | Tap by `text`, or by `id` (a React Native `testID` surfaces as the element id/resource-id) |
| `input_text` | Types into the currently focused field — tap the field first |
| `back` | Back gesture |
| `run_flow` | Run ad-hoc Maestro YAML (asserts, taps, scrolls) — best for assertions |
| `run_flow_files` | Run saved .yaml flow files (use absolute paths) |
| `check_flow_syntax` | Validate YAML (run_flow already validates; rarely needed) |
| `query_docs` / `cheat_sheet` | Maestro syntax reference |

## Working patterns (verified)

- Prefer tapping by `id` (testID) over text — stable against copy changes. Find ids via `inspect_view_hierarchy`.
- To verify state after an interaction, use `run_flow` with an assertion rather than eyeballing:

```yaml
appId: host.exp.Exponent
---
- assertVisible: "<expected text>"
```

- Ad-hoc flow shape for tap + type:

```yaml
appId: host.exp.Exponent
---
- launchApp
- tapOn:
    id: "<some-testid>"
- inputText: "some text"   # only after tapping the target field
```

## Gotchas (actually hit during setup)

- **Expo Go's dev-menu sheet covers the app on first launch** (onboarding: "This is the developer menu"). Tapping `Continue` only advances to the regular dev menu — you must then tap the close button (`id: "xmark"`) to reveal the app. If a screenshot shows a grey overlay with a gear icon, that's the dev menu, not the app.
- **Don't trust tap success alone** — `tap_on` returns success even if an overlay swallowed the tap. Follow up with `take_screenshot` or an `assertVisible` flow.
- `inspect_view_hierarchy` on a React Native screen shows deep nesting of identical-bounds views; filter for rows with `accessibilityText`/`resource-id`.
- `disown` fails in non-interactive shells ("job not found") — harmless; `nohup ... &` alone is enough to keep the dev server alive.
- The simulator status bar may render in the host machine's locale (e.g. Spanish) — don't match on status-bar text.
