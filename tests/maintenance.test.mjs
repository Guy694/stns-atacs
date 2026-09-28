import assert from "node:assert/strict";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

function load(initial = {}) {
  const store = { ...initial };
  const maintenance = loadTs("lib/maintenance.ts", {
    "@/lib/app-settings": {
      getAppSetting: async (key) => store[key] ?? null,
      listAppSettingsByPrefix: async (prefix) =>
        Object.fromEntries(Object.entries(store).filter(([key]) => key.startsWith(prefix))),
      setAppSetting: async (key, value) => { store[key] = value; },
    },
  }, { Date });
  return { maintenance, store };
}

test("ค่าเริ่มต้นคือเปิดใช้งานปกติ และใช้ข้อความมาตรฐาน", async () => {
  const { maintenance } = load();
  const state = await maintenance.getMaintenanceState();
  assert.equal(state.enabled, false);
  assert.equal(state.message, maintenance.DEFAULT_MAINTENANCE_MESSAGE);
  assert.equal(await maintenance.isMaintenanceEnabled(), false);
});

test("เปิดโหมดปิดปรับปรุงแล้วบันทึกข้อความ เวลา และผู้เปิด", async () => {
  const { maintenance, store } = load();
  await maintenance.setMaintenanceState({
    enabled: true,
    message: "ปรับปรุงฐานข้อมูล",
    expectedBack: "18:00 น. วันนี้",
    actorName: "ผู้ดูแลระบบ",
  });
  const state = await maintenance.getMaintenanceState();
  assert.equal(state.enabled, true);
  assert.equal(state.message, "ปรับปรุงฐานข้อมูล");
  assert.equal(state.expectedBack, "18:00 น. วันนี้");
  assert.equal(state.startedBy, "ผู้ดูแลระบบ");
  assert.ok(state.startedAt, "ต้องบันทึกเวลาที่เริ่ม");
  assert.equal(await maintenance.isMaintenanceEnabled(), true);
  assert.equal(store["maintenance.enabled"], "true");
});

test("ปิดโหมดแล้วล้างเวลาและผู้เปิด", async () => {
  const { maintenance } = load();
  await maintenance.setMaintenanceState({ enabled: true, actorName: "แอดมิน" });
  await maintenance.setMaintenanceState({ enabled: false });
  const state = await maintenance.getMaintenanceState();
  assert.equal(state.enabled, false);
  assert.equal(state.startedAt, "");
  assert.equal(state.startedBy, "");
});

test("ข้อความว่างใช้ข้อความมาตรฐาน และตัดความยาวตามขนาดคอลัมน์", async () => {
  const { maintenance, store } = load();
  await maintenance.setMaintenanceState({ enabled: true, message: "   " });
  assert.equal((await maintenance.getMaintenanceState()).message, maintenance.DEFAULT_MAINTENANCE_MESSAGE);

  await maintenance.setMaintenanceState({ enabled: true, message: "ก".repeat(400) });
  assert.equal(store["maintenance.message"].length, maintenance.MAINTENANCE_MESSAGE_MAX);
});

test("อ่านค่าที่บันทึกไว้หลายรูปแบบได้ถูกต้อง", async () => {
  for (const [value, expected] of [["true", true], ["1", true], ["on", true], ["false", false], ["0", false], ["", false]]) {
    const { maintenance } = load({ "maintenance.enabled": value });
    assert.equal(await maintenance.isMaintenanceEnabled(), expected, `ค่า ${JSON.stringify(value)}`);
  }
});

test("เฉพาะผู้ดูแลระบบที่ข้ามโหมดปิดปรับปรุงได้", () => {
  const { maintenance } = load();
  assert.equal(maintenance.canBypassMaintenance({ role: "admin" }), true);
  assert.equal(maintenance.canBypassMaintenance({ role: "officer" }), false);
  assert.equal(maintenance.canBypassMaintenance({ role: "viewer" }), false);
  assert.equal(maintenance.canBypassMaintenance(null), false);
  assert.equal(maintenance.canBypassMaintenance(undefined), false);
});
