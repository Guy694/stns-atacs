import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

function setup({ current = {}, role = "officer", permitted = true, workGroups = [], auditFails = false, imageReferences = [], deleteError = null } = {}) {
  const writes = [], surveys = [], audits = [], createdWorkGroups = [], createOptions = [], updateOptions = [], deletes = [];
  const files = { written: [], removed: [] };
  const currentAsset = { id: 1, facilityId: 10, surveyId: 99, assetName: "Existing", assetClass: "Vehicle", assetCategory: "Hardware", currentStatus: "Broken", assetRegistrationNo: "CAR-1", purchaseDate: "2025-01-01", assetImage1Url: "/existing.webp", ...current };
  const actions = loadTs("app/(main)/assets/actions.ts", {
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect() { throw new Error("redirect"); } },
    "node:fs/promises": {
      mkdir: async () => {},
      writeFile: async (file) => { files.written.push(String(file)); },
      unlink: async (file) => { files.removed.push(String(file)); },
    },
    "@/lib/upload-storage": {
      ASSET_IMAGE_URL_PREFIX: "/uploads/assets/",
      assetImageDir: () => "/srv/uploads/assets",
      assetImageUrl: (name) => `/uploads/assets/${name}`,
      safeAssetImageName: (name) => (/^[A-Za-z0-9][A-Za-z0-9._-]*\.(jpg|png|webp)$/.test(name) ? name : null),
    },
    "@/lib/auth": { getCurrentUser: async () => ({ id: 1, role, fullName: "Officer", facilityId: 10, managedAssetFacilityIds: [] }) },
    "@/lib/role-permissions": { hasPermission: async () => permitted },
    "@/lib/assets": {
      getAssetById: async () => currentAsset,
      findOrCreateSurvey: async id => { surveys.push(id); return 1; },
      createAsset: async (input, options) => { writes.push(input); createOptions.push(options); return { insertId: 1 }; },
      updateAsset: async (_id, input, options) => { writes.push(input); updateOptions.push(options); },
      deleteAsset: async (id, actor) => { if (deleteError) throw new Error(deleteError); deletes.push({ id, actor }); },
    },
    "@/lib/asset-status-history": { recordAssetStatusHistory: async () => {} },
    "@/lib/audit": {
      writeAuditLog: async input => { if (auditFails) throw new Error("audit down"); audits.push(input); },
      writeAuditLogSafe: async input => { if (!auditFails) audits.push(input); },
    },
    "@/lib/mysql": {
      // กลุ่มงานที่ "เปิดใช้งานอยู่" ของหน่วยงาน — รวมกลุ่มที่เพิ่งถูกสร้างจากแบบฟอร์ม
      // (ในระบบจริง แถวถูก insert ก่อนขั้นตอนตรวจสอบ)
      selectRows: async (sql, values) => {
        if (String(sql).includes("facility_work_groups")) {
          return [...workGroups.map((group) => ({ id: group.id })), ...createdWorkGroups.map(() => ({ id: 77 }))];
        }
        if (String(sql).includes("asset_image_1_url = ?")) return imageReferences.includes(values[0]) ? [{ id: 2 }] : [];
        return [];
      },
    },
    "@/lib/facility-work-groups": {
      findActiveFacilityWorkGroup: async (facilityId, name) =>
        workGroups.find((group) => group.workGroupName === String(name).trim()) ?? null,
      findOrCreateFacilityWorkGroup: async (facilityId, name) => {
        createdWorkGroups.push({ facilityId, name: String(name).trim() });
        return 77;
      },
    },
  });
  const form = extra => {
    const fd = new FormData();
    for (const [key, value] of Object.entries({ assetId: "1", facilityId: "10", assetName: "Renamed", ...extra })) fd.set(key, value);
    return fd;
  };
  return { actions, writes, surveys, audits, createdWorkGroups, createOptions, updateOptions, deletes, files, form };
}

test("form edits preserve non-IT class, registration, images, dates, status and original survey", async () => {
  const ctx = setup();
  assert.equal(await ctx.actions.updateAssetAction(null, ctx.form()), null);
  const patch = ctx.writes[0];
  assert.equal(patch.assetClass, "Vehicle");
  assert.equal(patch.assetRegistrationNo, "CAR-1");
  assert.equal(patch.assetImage1Url, "/existing.webp");
  assert.equal(patch.purchaseDate, undefined);
  assert.equal(patch.currentStatus, undefined);
  assert.equal(patch.surveyId, 99);
  assert.equal(ctx.surveys.length, 0);
});

test("class changes require explicit confirmation and are audited", async () => {
  const ctx = setup();
  assert.match(await ctx.actions.updateAssetAction(null, ctx.form({ assetClass: "Office" })), /ยืนยัน/);
  assert.equal(ctx.writes.length, 0);
  assert.equal(await ctx.actions.updateAssetAction(null, ctx.form({ assetClass: "Office", confirmClassChange: "1" })), null);
  assert.match(ctx.audits[0].summary, /Vehicle → Office/);
});

test("form validation rejects invalid dates before survey or asset mutations", async () => {
  const ctx = setup();
  assert.match(await ctx.actions.createAssetAction(null, ctx.form({ assetClass: "Office", purchaseDate: "2025-02-30" })), /YYYY-MM-DD/);
  assert.equal(ctx.writes.length, 0);
  assert.equal(ctx.surveys.length, 0);
});

test("write permissions and facility boundaries remain enforced for non-IT", async () => {
  for (const options of [{ role: "viewer" }, { permitted: false }, { current: { facilityId: 20 } }]) {
    const ctx = setup(options);
    assert.ok(await ctx.actions.updateAssetAction(null, ctx.form()));
    assert.equal(ctx.writes.length, 0);
    assert.equal(ctx.surveys.length, 0);
  }
});

test("กลุ่มงาน: เลือกจากรายการเดิมใช้ id นั้น ไม่สร้างใหม่", async () => {
  const ctx = setup({ workGroups: [{ id: 5, workGroupName: "งานธุรการ" }] });
  assert.equal(await ctx.actions.updateAssetAction(null, ctx.form({ workGroupId: "5", workGroupName: "" })), null);
  assert.equal(ctx.writes.at(-1).workGroupId, 5);
  assert.equal(ctx.createdWorkGroups.length, 0);
});

test("กลุ่มงาน: พิมพ์ชื่อที่มีอยู่แล้ว ใช้ของเดิม ไม่สร้างซ้ำ", async () => {
  const ctx = setup({ workGroups: [{ id: 5, workGroupName: "งานธุรการ" }] });
  assert.equal(await ctx.actions.updateAssetAction(null, ctx.form({ workGroupId: "", workGroupName: " งานธุรการ " })), null);
  assert.equal(ctx.writes.at(-1).workGroupId, 5);
  assert.equal(ctx.createdWorkGroups.length, 0);
});

test("กลุ่มงาน: พิมพ์ชื่อใหม่ ระบบสร้างให้ในหน่วยงานนั้นแล้วผูกกับครุภัณฑ์", async () => {
  const ctx = setup();
  assert.equal(await ctx.actions.updateAssetAction(null, ctx.form({ workGroupId: "", workGroupName: "งานเทคโนโลยีสารสนเทศ" })), null);
  assert.equal(ctx.writes.at(-1).workGroupId, 77);
  assert.deepEqual({ ...ctx.createdWorkGroups[0] }, { facilityId: 10, name: "งานเทคโนโลยีสารสนเทศ" });
});

test("กลุ่มงาน: ไม่มีสิทธิ์จัดการกลุ่มงาน เพิ่มชื่อใหม่ไม่ได้ และไม่มีการสร้างข้อมูล", async () => {
  const ctx = setup({ permitted: false });
  const error = await ctx.actions.updateAssetAction(null, ctx.form({ workGroupId: "", workGroupName: "กลุ่มงานใหม่" }));
  assert.match(String(error), /ไม่มีสิทธิ์เพิ่มกลุ่มงานใหม่|สิทธิ์/);
  assert.equal(ctx.createdWorkGroups.length, 0);
});

test("B1: แก้ไขเปลี่ยนหน่วยงานไม่ได้ ต้องทำผ่านเมนูโอนย้าย", async () => {
  const ctx = setup({ role: "admin" });
  const error = await ctx.actions.updateAssetAction(null, ctx.form({ facilityId: "20" }));
  assert.equal(error, "การย้ายหน่วยงานต้องทำผ่านเมนูโอนย้ายทรัพย์สิน");
  assert.equal(ctx.writes.length, 0);
  assert.equal(ctx.surveys.length, 0);
});

test("B3: สร้างทรัพย์สินพร้อมประวัติสถานะแรกในธุรกรรมเดียว และ audit ล้มเหลวไม่ทำให้ผู้ใช้ต้องส่งซ้ำ", async () => {
  const ctx = setup({ auditFails: true });
  assert.equal(await ctx.actions.createAssetAction(null, ctx.form({ assetClass: "Office" })), null);
  assert.equal(ctx.writes.length, 1);
  assert.equal(ctx.createOptions[0].history.note, "สร้างทะเบียนทรัพย์สิน");
  assert.equal(ctx.createOptions[0].history.changedByUserId, 1);
});

test("B3: แก้ไขทรัพย์สินเขียนประวัติสถานะในธุรกรรมเดียวกับการแก้ไข", async () => {
  const ctx = setup();
  assert.equal(await ctx.actions.updateAssetAction(null, ctx.form()), null);
  assert.equal(ctx.updateOptions[0].history.note, "แก้ไขข้อมูลทรัพย์สิน");
  assert.equal(ctx.updateOptions[0].history.fromStatus, "Broken");
});

test("B10: รูปที่ไม่ใช่ภาพจริงถูกปฏิเสธแม้ Content-Type บอกว่าเป็นภาพ", async () => {
  const ctx = setup();
  const fd = ctx.form();
  fd.set("assetImage1", new File([new TextEncoder().encode("<script>alert(1)</script>")], "x.png", { type: "image/png" }));
  assert.match(await ctx.actions.updateAssetAction(null, fd), /JPG, PNG หรือ WebP/);
  assert.equal(ctx.files.written.length, 0);
  assert.equal(ctx.writes.length, 0);
});

test("B10: ภาพจริงใช้นามสกุลตามเนื้อไฟล์ และลบไฟล์เดิมที่ถูกแทนที่หลังบันทึกสำเร็จ", async () => {
  const ctx = setup({ current: { assetImage1Url: "/uploads/assets/old-1.webp", assetImage2Url: "/uploads/assets/old-2.png" } });
  const fd = ctx.form({ removeAssetImage2: "1" });
  fd.set("assetImage1", new File([PNG], "photo.jpg", { type: "image/jpeg" }));
  assert.equal(await ctx.actions.updateAssetAction(null, fd), null);
  assert.match(ctx.files.written[0], /^\/srv\/uploads\/assets\/asset-.*\.png$/);
  assert.match(ctx.writes[0].assetImage1Url, /\.png$/);
  assert.equal(ctx.writes[0].assetImage2Url, null);
  assert.deepEqual(ctx.files.removed.sort(), ["/srv/uploads/assets/old-1.webp", "/srv/uploads/assets/old-2.png"]);
});

test("B10: ไม่ลบไฟล์นอกโฟลเดอร์อัปโหลด หรือไฟล์ที่ทรัพย์สินอื่นยังใช้อยู่", async () => {
  const ctx = setup({
    current: { assetImage1Url: "/public/../etc/passwd", assetImage2Url: "/uploads/assets/shared.png" },
    imageReferences: ["/uploads/assets/shared.png"],
  });
  assert.equal(await ctx.actions.updateAssetAction(null, ctx.form({ removeAssetImage1: "1", removeAssetImage2: "1" })), null);
  assert.deepEqual(ctx.files.removed, []);
});

test("B2: ลบทรัพย์สินเป็น soft delete ส่งผู้ลบไปด้วย และบันทึก audit 'delete'", async () => {
  const ctx = setup();
  assert.equal(await ctx.actions.deleteAssetAction(1), null);
  assert.deepEqual(ctx.deletes.map((entry) => ({ id: entry.id, ...entry.actor })), [{ id: 1, userId: 1, userName: "Officer" }]);
  assert.equal(ctx.audits[0].action, "delete");
});

test("B2: ข้อความเมื่อลบไม่ได้เพราะยังมีงานค้างถูกส่งกลับไปให้ผู้ใช้", async () => {
  const ctx = setup({ deleteError: "ลบทรัพย์สินไม่ได้ เพราะยังมีงานซ่อมที่ยังไม่ปิด 1 รายการ กรุณาปิดงานเหล่านี้ก่อน" });
  assert.match(await ctx.actions.deleteAssetAction(1), /ลบทรัพย์สินไม่ได้/);
  assert.equal(ctx.audits.length, 0);
});
