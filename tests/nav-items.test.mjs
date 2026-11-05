import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const nav = loadTs("app/_components/nav-items.ts", {}, { Array, Object, String });
const { APP_MENU_ITEMS } = loadTs("lib/menu.ts");

const allVisible = Object.fromEntries(APP_MENU_ITEMS.map((item) => [item.key, true]));
const allPermissions = APP_MENU_ITEMS.flatMap((item) => (item.permissionKey ? [item.permissionKey] : []));

function build(user, menuVisibility = allVisible, grantedPermissions = allPermissions) {
  return nav.buildNavItems({ user: { fullName: "x", ...user }, grantedPermissions, menuVisibility });
}

test("activeHrefFor matches trailing-slash pathnames (trailingSlash: true)", () => {
  const items = build({ role: "admin" });
  assert.equal(nav.activeHrefFor(items, "/dashboard/"), "/dashboard");
  assert.equal(nav.activeHrefFor(items, "/dashboard"), "/dashboard");
  assert.equal(nav.activeHrefFor(items, "/assets/"), "/assets");
  assert.equal(nav.activeHrefFor(items, "/assets/12/"), "/assets");
  assert.equal(nav.activeHrefFor(items, "/admin/settings/work-groups/"), "/admin/settings/work-groups");
  assert.equal(nav.activeHrefFor(items, "/admin/settings/menus/"), "/admin/settings");
  assert.equal(nav.activeHrefFor(items, "/dashboard/extra/"), null, "exact items do not match children");
  assert.equal(nav.activeHrefFor(items, "/assetsx/"), null);
});

test("pathMatches normalises trailing slashes on both sides", () => {
  assert.equal(nav.pathMatches("/admin/settings/", "/admin/settings"), true);
  assert.equal(nav.pathMatches("/admin/settings/menus/", "/admin/settings/"), true);
  assert.equal(nav.pathMatches("/admin/settingsx/", "/admin/settings"), false);
  assert.equal(nav.pathMatches("/", "/"), true);
});

test("officer assets entry does not depend on the dashboard item and follows the assets toggle", () => {
  const noDashboard = build({ role: "officer", facilityId: 7 }, { ...allVisible, dashboard: false });
  const entry = noDashboard.find((item) => item.key === "officer-assets");
  assert.ok(entry);
  assert.equal(entry.href, "/facilities/7");
  assert.equal(noDashboard.some((item) => item.key === "assets"), false);

  const assetsHidden = build({ role: "officer", facilityId: 7 }, { ...allVisible, assets: false });
  assert.equal(assetsHidden.some((item) => item.key === "officer-assets"), false);
});

test("officer assets entry targets the facility list, own facility or the single managed facility", () => {
  const href = (user) => build({ role: "officer", ...user }).find((item) => item.key === "officer-assets").href;
  assert.equal(href({ facilityId: 3, managedAssetFacilityIds: [3, 4] }), "/facilities");
  assert.equal(href({ facilityId: 3, managedAssetFacilityIds: [3] }), "/facilities/3");
  assert.equal(href({ facilityId: null, managedAssetFacilityIds: [9] }), "/facilities/9");
  assert.equal(href({ facilityId: null, managedAssetFacilityIds: [] }), "/profile");
});

test("scan entry is offered to anyone who may view assets and follows its menu toggle", () => {
  const admin = build({ role: "admin" });
  assert.equal(admin.find((item) => item.key === "scan")?.href, "/scan");
  const officer = build({ role: "officer", facilityId: 7 });
  assert.ok(officer.some((item) => item.key === "scan"));
  const hidden = build({ role: "admin" }, { ...allVisible, scan: false });
  assert.equal(hidden.some((item) => item.key === "scan"), false);
  const noView = build({ role: "officer", facilityId: 7 }, allVisible, allPermissions.filter((key) => key !== "assets.view"));
  assert.equal(noView.some((item) => item.key === "scan"), false);
});
