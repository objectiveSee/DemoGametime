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
- **The blue floating gear at the top-right is Expo Go dev tooling ("Tools button"), not app UI** — ignore it when reviewing screenshots. Hide it for clean screenshots: tap it (`id: "gearshape.fill"`), scroll the dev menu to the **Tools button** toggle, switch it off, close with `id: "xmark"`. The setting persists in Expo Go.
- **`tapOn: point:` percentages must be whole numbers** — `85%, 65.6%` fails with `For input string: "65.6"`.
- **Scrolling a long screen:** `swipe` with `start: 50%, 85%` / `end: 50%, 15%` and `duration: 800`+ moves about 70% of a screen with no fling, so consecutive screenshots overlap cleanly. Short durations fling and skip content.
- **Saving screenshots to a known path:** `take_screenshot` only returns the image inline (stored under Claude's tool-results). To write a PNG where you want it, use `xcrun simctl io <UDID> screenshot <path>.png`. That capture also includes the Dynamic Island, which Maestro's doesn't.
- **Hot reload keeps scroll position** — after an edit, re-screenshot in place. No relaunch needed.
- **`scrollUntilVisible` by `id` can miss plain RN `View`s** (testID on a non-text container) even when they're on screen — it reports "No visible element found". Target visible text instead.
- **Text matching uses the source string, not the rendered casing.** A label styled with `textTransform: 'uppercase'` shows as "OVERLAY" on screen but must be matched as written in code ("Overlay").
- `scrollUntilVisible` with `centerElement: true` can overshoot on long lists; follow up with a short swipe and re-screenshot.
- **Never run the `maestro` CLI while the Maestro MCP is in use.** Only one XCUITest driver can hold the simulator: `maestro test` starts its own runner (port 7001) and kills the MCP's (port 22087). After that, MCP flows fail with `Failed to connect to /127.0.0.1:22087` and the CLI fails mid-flow too. To recover, kill the orphaned `xcodebuild test-without-building … maestro-driver-ios` process (`ps aux | grep xcodebuild`), and the next MCP call restarts its driver. `take_screenshot` keeps working while the driver is dead, so a screenshot that works doesn't prove the driver is healthy.
- **`run_flow_files` resolves relative paths against the MCP server's cwd** (the workspace parent), not the repo, and mangles absolute paths by prefixing that cwd. Pass a path relative to the parent (e.g. `DemoGametime/mobile/.maestro/01-x.yaml`). Inside `run_flow`, `runFlow:` takes absolute paths fine.
- **Cold-start a fresh session:** `stopApp` + `openLink: exp://127.0.0.1:8081` restarts Expo Go straight into the project (no dev-menu sheet after the first-run onboarding). Use it as a shared `_launch.yaml` subflow so each flow starts from clean in-memory state. `clearState` would wipe Expo Go itself, so don't use it.
- **Transient UI shorter than ~2 s can't be asserted.** Each Maestro command on a deep RN tree takes over a second (hierarchy snapshot plus settle wait), so a 1.5 s spinner is gone before the next `assertVisible`. `waitToSettleTimeoutMs` and `retryTapIfNoChange: false` don't help enough. Assert the outcome instead, and capture the transient state by running a background `xcrun simctl io <UDID> screenshot` loop (every ~0.2 s) while Maestro taps.
- **`eraseText` deletes backwards from the cursor, and tapping a field can land the cursor mid-text,** so editing a formatted field in place is unreliable. Write flows that only append (`inputText` into a fresh field) and relaunch between cases.
- **A pressable (`accessible`) container merges its child texts into one label** ("Title, subtitle"), so `assertVisible: "Title"` fails on it. Match the container by `id`. `enabled: true|false` on `assertVisible`/`tapOn` does read RN's `accessibilityState.disabled` (verified both ways).
- `$` and `.` in assertion text are regex, but Maestro falls back to an exact-string match, so `"$135.90"` works. Regexes like `"GT-[A-Z0-9]{6}"` work for dynamic values.
- `maestro test <dir>` runs every yaml in the folder, subflows included. Add a `config.yaml` with `flows: ["0*.yaml"]` (or similar) to pick only the top-level flows.
- **Web content is invisible on iOS.** Pages inside ASWebAuthenticationSession / SFSafariViewController (e.g. `expo-web-browser`) never appear in the view hierarchy — not even the browser's own "localhost" chrome. `assertVisible`/`tapOn` by text can't touch them; tap by `point:` against a page whose layout you control, assert the app-side outcome after the redirect, and treat screenshots as the ground truth.
- **Racing short auto-advancing UI:** default settle waits can eat a 3–4 s window (a sheet that auto-proceeds was repeatedly gone before the next command). Put `waitToSettleTimeoutMs: 150` on the taps, and prefer a `point:` tap over an `id:` tap for the follow-up — the id lookup costs a hierarchy fetch. Tapping the point twice is cheap insurance when the first tap may land before the overlay renders.
- **Backgrounding without killing:** `launchApp` with `stopApp: false` foregrounds a running app via activate. Launching `com.apple.Preferences` first is an easy way to background Expo Go mid-flow, then re-activate and assert the flow resumed.
- **`runScript` + `http.post` works for test hooks** (e.g. telling the mock server to slow down): env vars from the flow arrive as plain globals, `http.post(url, { body, headers })`. Inline `evalScript` with JSON braces trips the YAML parser — use a script file.
- `query_docs` can 404 (hosted docs endpoint down); fall back to `cheat_sheet` and what's written here.
- **`run_flow` can return a bare `Internal error`** (seen on the first call of a session, a flow with a `runFlow:` subflow) while the app is fine. Screenshot to check, then retry — the same steps passed on the next call.
- **RN `Switch` taps fine by `id`** (its `testID`), and a native `Modal` with `presentationStyle="pageSheet"` is fully visible to the hierarchy. Assert the toggle's *effect* on the screen underneath rather than the switch's on/off value.
- `config.yaml` `flows:` globs are literal: `"0*.yaml"` silently skips a `10-…yaml`. Add a pattern per leading digit when the suite grows past 09.
- **Entrance animations that start at opacity 0 race assertions.** iOS drops alpha-0 views from the accessibility tree, so after `extendedWaitUntil` finds the first element of a staggered entrance, an `assertVisible` on a later sibling can fail while that sibling is still fully transparent (seen as an intermittent failure on a confirmation-code assert). Keep asserted content at a small non-zero opacity (e.g. 0.05) during entrances, or wait on the element you actually assert.
- **Recording motion for review:** `xcrun simctl io <UDID> recordVideo --codec=h264 --force out.mp4` in the background (stop with `pkill -INT -f recordVideo`, then wait ~2 s for the file to finalize), drive the app with `run_flow`, then `ffmpeg -vf "fps=30,crop=…"` into PNGs and `tile=` them into a contact sheet to read the frames. `md5 -q f*.png | uniq -c` finds where the screen changes. The recorder writes frames only on screen change and can drop the tail at SIGINT, so the last frame isn't proof of the settled state — take a screenshot for that.
- **Reduce Motion on the simulator:** `xcrun simctl spawn <UDID> defaults write com.apple.Accessibility ReduceMotionEnabled -bool true`, then cold-start the app (`_launch`), and RN's `AccessibilityInfo.isReduceMotionEnabled()` reports it. Write `false` to restore.
- **Test text input with the software keyboard on screen.** If the simulator has *I/O → Keyboard → Connect Hardware Keyboard* on, iOS hides the on-screen keyboard, and Maestro's `inputText` still types fine. Flows pass while keyboard-avoidance bugs (a Pay button or error hidden under the keyboard, fields jumping as focus moves) stay invisible. Toggle it from the Simulator menu (⇧⌘K), or set `defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool false` with the Simulator app quit. If the key is unset, the keyboard is software. Confirm with a screenshot after focusing a field: the keypad should be visible.
