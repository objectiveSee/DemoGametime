/* global http, DELAY_MS */
// Maestro GraalJS script (not app code): `http` and env vars are injected as globals.
// Sets the mock server's processing-delay override so kill-mid-flight timing is deterministic.
// DELAY_MS comes from the flow's env: a number of ms, or "null" to restore the default delay.
const response = http.post('http://localhost:4000/debug/delay', {
  body: JSON.stringify({ ms: Number(DELAY_MS) }),
  headers: { 'Content-Type': 'application/json' },
});
if (!response.ok) throw new Error('failed to set mock delay: HTTP ' + response.status);
