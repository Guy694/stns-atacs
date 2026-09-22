import { validateAssetDetails, type AssetExtensions } from "@/lib/asset-details";
import type { AssetInput } from "@/lib/assets";
import { isItAsset, parseAssetClass, requiresWindowsLicense } from "@/lib/asset-policy";
import { ASSET_ACCOUNTING_CODE_MAX, ASSET_CODE_PREFIX_MAX } from "@/lib/asset-number";
import { isTerminalAssetStatus, OPERATIONAL_ASSET_STATUSES } from "@/lib/asset-status";
import { WINDOWS_LICENSE_STATUS_VALUES, type WindowsLicenseStatus } from "@/lib/windows-license";

export type AssetFields = Record<string, string | undefined>;
export type ExistingAssetFields = Partial<Omit<AssetInput, "rowNo">> & { extensions?: AssetExtensions };

const IT_FIELDS = ["deviceType", "assetGroup", "operatingSystem", "operatingSystemVersion", "privateIp", "publicIp"] as const;
const COMMON_TEXT_FIELDS = ["usageDescription", "ownerName", "locationDetail", "manufacturerBrand", "manufacturerModel", "manufacturerSpecification", "serialNumber", "purchaseOrderNo"] as const;
const DATE_FIELDS = ["purchaseDate", "maintenanceStartDate", "maintenanceEndDate", "installedAt"] as const;

/** Forms send empty strings to clear fields. CSV adapters omit blank cells to preserve existing data. */
export function parseAssetFields(fields: AssetFields, existing?: ExistingAssetFields): Omit<AssetInput, "surveyId"> {
  const assetClass = parseAssetClass(fields.assetClass, existing?.assetClass);
  const isIt = isItAsset({ assetClass });
  const assetName = fields.assetName?.trim() ?? existing?.assetName ?? "";
  if (!assetName) throw new Error("กรุณาระบุชื่อทรัพย์สิน (asset_name)");
  let assetCategory = existing?.assetCategory ?? "Hardware";
  if (isIt) {
    if (fields.assetCategory !== undefined && !["Hardware", "Software"].includes(fields.assetCategory)) {
      throw new Error("asset_category ต้องเป็น Hardware หรือ Software");
    }
    assetCategory = (fields.assetCategory as typeof assetCategory | undefined) ?? assetCategory;
  } else {
    // The old enum remains intact; Hardware is only a storage compatibility value.
    assetCategory = "Hardware";
  }
  const result: Omit<AssetInput, "surveyId"> = {
    assetName,
    assetClass,
    assetCategory,
    assetRegistrationNo: fields.assetRegistrationNo === undefined
      ? existing?.assetRegistrationNo ?? null : fields.assetRegistrationNo || null,
  };
  for (const key of COMMON_TEXT_FIELDS) if (fields[key] !== undefined) result[key] = fields[key];
  if (fields.assetCodePrefix !== undefined) {
    const prefix = fields.assetCodePrefix.trim();
    if (prefix.length > ASSET_CODE_PREFIX_MAX) throw new Error(`รหัสหน่วยงานของเลขครุภัณฑ์ต้องไม่เกิน ${ASSET_CODE_PREFIX_MAX} ตัวอักษร`);
    result.assetCodePrefix = prefix;
  }
  if (fields.assetAccountingCode !== undefined) {
    const code = fields.assetAccountingCode.trim();
    if (code.length > ASSET_ACCOUNTING_CODE_MAX) throw new Error(`รหัสสินทรัพย์ต้องไม่เกิน ${ASSET_ACCOUNTING_CODE_MAX} ตัวอักษร`);
    result.assetAccountingCode = code;
  }
  // Hidden IT fields are never cleared or overwritten while editing a non-IT record.
  if (isIt) for (const key of IT_FIELDS) if (fields[key] !== undefined) result[key] = fields[key];

  const deviceType = result.deviceType ?? existing?.deviceType;
  const license = fields.windowsLicenseStatus ?? existing?.windowsLicenseStatus;
  if (isIt && fields.windowsLicenseStatus && !WINDOWS_LICENSE_STATUS_VALUES.includes(fields.windowsLicenseStatus as WindowsLicenseStatus)) {
    throw new Error("windows_license_status ต้องเป็น Genuine หรือ Pirated");
  }
  if (requiresWindowsLicense({ assetClass, assetCategory, deviceType }) && !license) {
    throw new Error("ครุภัณฑ์คอมพิวเตอร์ต้องระบุ windows_license_status เป็น Genuine หรือ Pirated");
  }
  if (isIt && fields.windowsLicenseStatus !== undefined) result.windowsLicenseStatus = (fields.windowsLicenseStatus || null) as WindowsLicenseStatus | null;

  if (isIt && result.publicIp && !/^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(result.publicIp)) {
    throw new Error("Public IP ไม่ถูกต้อง");
  }
  if (fields.purchasePrice !== undefined) {
    result.purchasePrice = fields.purchasePrice === "" ? null : Number(fields.purchasePrice.replace(/,/g, ""));
    if (result.purchasePrice !== null && (!Number.isFinite(result.purchasePrice) || result.purchasePrice < 0)) {
      throw new Error("ราคาที่ซื้อต้องเป็นตัวเลขที่ไม่ติดลบ");
    }
  }
  for (const key of DATE_FIELDS) {
    const value = fields[key];
    if (value === undefined) continue;
    if (value) {
      const date = new Date(`${value}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        throw new Error(`${key} ต้องเป็นวันที่จริงในรูปแบบ YYYY-MM-DD`);
      }
    }
    result[key] = value;
  }
  if (result.purchaseDate && result.purchaseDate > new Date().toISOString().slice(0, 10)) throw new Error("วันที่ซื้อห้ามเกินวันที่ปัจจุบัน");
  const start = result.maintenanceStartDate ?? existing?.maintenanceStartDate;
  const end = result.maintenanceEndDate ?? existing?.maintenanceEndDate;
  if (start && end && end < start) throw new Error("วันสิ้นสุดสัญญาต้องไม่ก่อนวันเริ่มสัญญา");
  if (fields.currentStatus !== undefined) {
    const priorStatus = existing?.currentStatus;
    if (isTerminalAssetStatus(priorStatus)) {
      // Disposed/Lost are set only by an approved request and cannot be reverted by a form or import.
      if (fields.currentStatus && fields.currentStatus !== priorStatus) throw new Error("ทรัพย์สินที่จำหน่ายหรือสูญหายแล้วเปลี่ยนสถานะผ่านการแก้ไขข้อมูลไม่ได้");
    } else {
      if (!(OPERATIONAL_ASSET_STATUSES as readonly string[]).includes(fields.currentStatus)) {
        throw new Error(isTerminalAssetStatus(fields.currentStatus) ? "สถานะจำหน่าย/สูญหายต้องบันทึกผ่านคำขอจำหน่ายที่ได้รับอนุมัติ" : "สถานะทรัพย์สินไม่ถูกต้อง");
      }
      result.currentStatus = fields.currentStatus;
    }
  } else if (!existing) result.currentStatus = "Active";
  if (fields.usefulLifeYears !== undefined) {
    const raw = fields.usefulLifeYears.trim();
    result.usefulLifeYears = raw === "" ? null : Number(raw);
    if (result.usefulLifeYears !== null && (!Number.isInteger(result.usefulLifeYears) || result.usefulLifeYears < 1 || result.usefulLifeYears > 100)) {
      throw new Error("อายุการใช้งานต้องเป็นจำนวนเต็ม 1–100 ปี");
    }
  }
  if (fields.subtypeId !== undefined) {
    result.subtypeId = fields.subtypeId === "" ? null : Number(fields.subtypeId);
    if (isIt || (result.subtypeId !== null && (!Number.isSafeInteger(result.subtypeId) || result.subtypeId <= 0))) throw new Error("ประเภทย่อยไม่ถูกต้อง");
  }
  const detailPatch: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!key.startsWith("detail_") || value === undefined) continue;
    detailPatch[key.slice(7)] = value;
  }
  if (Object.keys(detailPatch).length) {
    validateAssetDetails(assetClass, detailPatch);
    const prior = existing?.extensions?.[assetClass]?.details ?? {};
    validateAssetDetails(assetClass, { ...prior, ...detailPatch });
    result.details = detailPatch;
  }
  return result;
}
