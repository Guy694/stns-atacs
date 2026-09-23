import assert from "node:assert/strict";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const { announcedApiBaseUrl } = loadTs("lib/agent-api-base.ts");

const env = (url, hosts) => ({ AGENT_API_BASE_URL: url, AGENT_API_BASE_ALLOWED_HOSTS: hosts });

test("SEC-06: announces only an https address on an allow-listed host", () => {
  assert.equal(
    announcedApiBaseUrl(env("https://atacs.satun.moph.go.th", "atacs.satun.moph.go.th")),
    "https://atacs.satun.moph.go.th"
  );
  assert.equal(announcedApiBaseUrl(env("https://atacs.satun.moph.go.th/", "*.moph.go.th")), "https://atacs.satun.moph.go.th");
});

test("SEC-06: never announces plain http, even on an allow-listed host", () => {
  assert.equal(announcedApiBaseUrl(env("http://atacs.satun.moph.go.th", "*.moph.go.th")), undefined);
});

test("SEC-06: rejects a host outside the allowlist", () => {
  assert.equal(announcedApiBaseUrl(env("https://evil.example.com", "*.moph.go.th")), undefined);
  // a suffix that only looks like the allowed domain must not pass
  assert.equal(announcedApiBaseUrl(env("https://notmoph.go.th", "*.moph.go.th")), undefined);
  assert.equal(announcedApiBaseUrl(env("https://atacs.satun.moph.go.th.evil.com", "*.moph.go.th")), undefined);
});

test("SEC-06: announces nothing when the allowlist or the address is empty or invalid", () => {
  assert.equal(announcedApiBaseUrl(env("https://atacs.satun.moph.go.th", "")), undefined);
  assert.equal(announcedApiBaseUrl(env("", "*.moph.go.th")), undefined);
  assert.equal(announcedApiBaseUrl(env("not-a-url", "*.moph.go.th")), undefined);
  assert.equal(announcedApiBaseUrl({}), undefined);
});
