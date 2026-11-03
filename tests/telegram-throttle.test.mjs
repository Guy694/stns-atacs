import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

test("alerts without an eventKey are throttled per title and IP so unauthenticated floods cannot spam the chat", async () => {
  const sent = [];
  const telegram = loadTs("lib/telegram.ts", {
    "@/lib/mysql": { executeStatement: async () => ({ affectedRows: 1 }) },
  }, {
    process: { env: { TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "c" } },
    fetch: async (url, init) => { sent.push(JSON.parse(init.body).text); return { ok: true }; },
    AbortController, setTimeout, clearTimeout, Number, Math, JSON, Object, String, Array, Intl, Map,
  });
  for (let i = 0; i < 20; i += 1) {
    await telegram.notifyTelegramSafe({ category: "security", title: "bad agent key", details: { IP: "1.2.3.4" } });
  }
  assert.equal(sent.length, 5);
  // Another source is still reported.
  await telegram.notifyTelegramSafe({ category: "security", title: "bad agent key", details: { IP: "5.6.7.8" } });
  assert.equal(sent.length, 6);
  // Explicit eventKey alerts keep their own DB de-duplication and are not throttled here.
  await telegram.notifyTelegramSafe({ category: "security", title: "bad agent key", details: { IP: "1.2.3.4" }, eventKey: "k1" });
  assert.equal(sent.length, 7);
});
