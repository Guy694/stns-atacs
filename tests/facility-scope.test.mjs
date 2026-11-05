import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const scope = loadTs("lib/facility-scope.ts");
const officer = { role: "officer", facilityId: 10, managedAssetFacilityIds: [20, 30] };

test("an officer gets a requested facility that is inside their asset scope", () => {
  for (const id of [10, 20, 30]) assert.deepEqual({ ...scope.resolveRequestedAssetFacility(officer, id) }, { ok: true, facilityId: id });
});

test("a facility outside the scope is refused instead of silently falling back to the own facility", () => {
  const result = scope.resolveRequestedAssetFacility(officer, 99);
  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
});

test("without a request a non-admin keeps their own facility; admins see everything or the requested one", () => {
  assert.deepEqual({ ...scope.resolveRequestedAssetFacility(officer, undefined) }, { ok: true, facilityId: 10 });
  assert.deepEqual({ ...scope.resolveRequestedAssetFacility({ role: "admin" }, undefined) }, { ok: true, facilityId: undefined });
  assert.deepEqual({ ...scope.resolveRequestedAssetFacility({ role: "admin" }, 99) }, { ok: true, facilityId: 99 });
});

test("viewers only reach their own facility; users without a facility have no scope", () => {
  const viewer = { role: "viewer", facilityId: 10, managedAssetFacilityIds: [20] };
  assert.equal(scope.resolveRequestedAssetFacility(viewer, 10).facilityId, 10);
  assert.equal(scope.resolveRequestedAssetFacility(viewer, 20).ok, false);
  assert.equal(scope.resolveRequestedAssetFacility({ role: "officer", facilityId: null }, undefined).ok, false);
  assert.equal(scope.resolveRequestedAssetFacility(null, 10).ok, false);
});

test("a malformed facility id counts as no request", () => {
  for (const value of [Number.NaN, 0, -3, 1.5]) assert.equal(scope.resolveRequestedAssetFacility(officer, value).facilityId, 10);
});
