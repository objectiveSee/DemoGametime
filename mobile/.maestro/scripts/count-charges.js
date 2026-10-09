/* global http, output, PHASE */
// Maestro GraalJS script (not app code). Proves "exactly one charge" from the server's side:
// PHASE "before" records the mock server's distinct-charge count; PHASE "after" fails the flow
// unless exactly one new charge (one idempotency key) appeared since. Replays don't count, so a
// recovery that re-sent the same key passes and one that charged with a fresh key fails.
const response = http.get('http://localhost:4000/debug/charges');
if (!response.ok) throw new Error('failed to read charge count: HTTP ' + response.status);
const count = JSON.parse(response.body).count;
if (PHASE === 'before') {
  output.chargesBefore = count;
} else {
  const created = count - output.chargesBefore;
  if (created !== 1) throw new Error('expected exactly 1 charge, server created ' + created);
}
