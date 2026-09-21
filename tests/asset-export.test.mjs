import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import { loadTs } from "./helpers/load-ts.mjs";

test("export and template carry every specific column and only current class details", async () => {
  const assets = [{ id: 1, facilityId: 10, assetName: "Car", assetClass: "Vehicle", extensions: { Vehicle: { subtypeId: 8, details: { license_plate: 'กข,123"4', odometer_km: "10" } }, Office: { details: { material: "hidden old class" } } } }];
  const { GET } = loadTs("app/api/export/assets/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/auth": { getCurrentUser: async () => ({ role: "admin" }) },
    "@/lib/assets": { listAssets: async () => assets },
    "@/lib/facility-scope": { resolveFacilityFilter: () => 10 },
    "@/lib/permissions": { canSeeSensitiveAssetNetwork: () => true },
    "@/lib/role-permissions": { hasPermission: async () => true },
    "@/lib/security": { readRequestIp: () => "test", recordSecurityEvent: async () => {} },
  });
  for (const query of ["", "?template=csv"]) {
    const response = await GET({ nextUrl: new URL(`http://localhost/api/export/assets${query}`) });
    const book = XLSX.read(await response.text(), { type: "string", raw: true });
    const [row] = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: "" });
    assert.ok(Object.hasOwn(row, "license_plate"));
    assert.ok(Object.hasOwn(row, "subtype_id"));
    assert.equal(row.material, "");
    if (!query) { assert.equal(row.license_plate, 'กข,123"4'); assert.equal(String(row.subtype_id), "8"); }
  }
});
