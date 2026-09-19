import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTs } from "./helpers/load-ts.mjs";

function renderForm(assetClass) {
  let stateCalls = 0;
  const { AssetFormModal } = loadTs("app/(main)/assets/_components/asset-form-modal.tsx", {
    react: {
      ...React,
      useState: initial => React.useState(stateCalls++ === 0 ? true : initial),
      useActionState: () => [null, "/test-save", false],
    },
    "react-dom": { createPortal: children => children },
    "@/app/(main)/assets/actions": { createAssetAction: async () => null, updateAssetAction: async () => null },
  }, { document: { body: {} } });
  return renderToStaticMarkup(React.createElement(AssetFormModal, {
    facilities: [], fixedFacilityId: 10, mode: "edit", updaterName: "Tester",
    asset: { id: 1, assetClass, assetGroup: "Hardware", deviceType: "Desktop", assetName: "Example", manufacturerBrand: "Brand", manufacturerModel: "Model", manufacturerSpecification: "Stored details", purchaseDate: "2025-01-01", windowsLicenseStatus: "Genuine" },
    children: "Edit",
  }));
}

test("IT form retains category, device, license, OS and purchase inputs", () => {
  const html = renderForm("IT");
  assert.match(html, /name="windowsLicenseStatus"/);
  assert.match(html, /name="operatingSystem"/);
  assert.match(html, /name="purchaseDate"[^>]*value="2025-01-01"/);
  assert.ok(!html.includes('<fieldset hidden="" disabled=""'));
});

test("non-IT forms disable hidden IT fields and keep common data and image controls", () => {
  for (const assetClass of ["Office", "Medical", "Vehicle", "Building", "Utility", "Other"]) {
    const html = renderForm(assetClass);
    assert.match(html, /<fieldset hidden="" disabled="">/);
    assert.match(html, /<fieldset disabled="" class="hidden">/);
    assert.ok(!html.includes('name="windowsLicenseStatus"'));
    assert.match(html, /name="manufacturerModel"[^>]*value="Model"/);
    assert.ok(html.includes("Stored details"));
    assert.match(html, /name="purchaseDate"[^>]*value="2025-01-01"/);
    assert.match(html, /name="assetImage1"/);
    assert.match(html, /name="assetImage2"/);
  }
});
