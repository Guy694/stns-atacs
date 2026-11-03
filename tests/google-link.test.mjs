import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const { googleLinkForLogin } = loadTs("lib/google-link.ts");
const claim = { provider: "google", googleSub: "g-1", email: "a@moph.go.th", issuedAt: 0 };

test("a Google login never links an existing account by e-mail alone", () => {
  // The e-mail on a self-registered account was typed in and never verified.
  assert.equal(googleLinkForLogin({ provider: "thaid", cid: "1", issuedAt: 0 }, { email: "a@moph.go.th", google_sub: null }), null);
});

test("after the owner signs in with their own method, the pending Google identity is linked", () => {
  assert.equal(googleLinkForLogin(claim, { email: "A@moph.go.th", google_sub: null }), "g-1");
});

test("a pending claim for another e-mail or an already linked account is ignored", () => {
  assert.equal(googleLinkForLogin(claim, { email: "b@moph.go.th", google_sub: null }), null);
  assert.equal(googleLinkForLogin(claim, { email: "a@moph.go.th", google_sub: "g-2" }), null);
  assert.equal(googleLinkForLogin(null, { email: "a@moph.go.th", google_sub: null }), null);
});
