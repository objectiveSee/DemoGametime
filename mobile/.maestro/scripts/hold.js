/* global HOLD_MS */
// Maestro GraalJS script (not app code). Maestro has no sleep command, and waitForAnimationToEnd
// returns at once on a still screen, so spin on the clock to hold the final state on camera.
const until = Date.now() + Number(HOLD_MS);
while (Date.now() < until) {
  // hold
}
