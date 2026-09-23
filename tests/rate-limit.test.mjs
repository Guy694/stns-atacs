import assert from "node:assert/strict";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const { consumeRateLimit, resetRateLimits } = loadTs("lib/rate-limit.ts");

test("allows up to the limit inside the window, then blocks", () => {
  resetRateLimits();
  const now = 1_000_000;
  for (let i = 0; i < 5; i += 1) {
    assert.equal(consumeRateLimit("ip:1", 5, 60_000, now + i).allowed, true);
  }
  const blocked = consumeRateLimit("ip:1", 5, 60_000, now + 10);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0 && blocked.retryAfterSeconds <= 60);
});

test("counts each key separately and frees the window as it slides", () => {
  resetRateLimits();
  const now = 2_000_000;
  assert.equal(consumeRateLimit("ip:a", 1, 60_000, now).allowed, true);
  assert.equal(consumeRateLimit("ip:b", 1, 60_000, now).allowed, true);
  assert.equal(consumeRateLimit("ip:a", 1, 60_000, now + 1).allowed, false);
  assert.equal(consumeRateLimit("ip:a", 1, 60_000, now + 60_001).allowed, true);
});
