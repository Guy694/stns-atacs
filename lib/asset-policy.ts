import { ASSET_CLASS_VALUE_SET, assetClassLabel } from "@/lib/asset-classes";
import { isComputerDeviceType } from "@/lib/windows-license";

export type AssetClassification = {
  assetClass?: string | null;
  assetCategory?: string | null;
  assetGroup?: string | null;
  deviceType?: string | null;
};

/** Only missing legacy classes mean IT; an unknown explicit class never does. */
export function isItAsset(asset: Pick<AssetClassification, "assetClass">) {
  return !asset.assetClass?.trim() || asset.assetClass.trim() === "IT";
}

export function parseAssetClass(value?: string | null, current?: string | null) {
  const result = value === undefined ? current?.trim() || "IT" : value?.trim();
  if (!result || !ASSET_CLASS_VALUE_SET.has(result)) throw new Error("กลุ่มทรัพย์สิน (asset_class) ไม่ถูกต้อง");
  return result;
}

export function requiresWindowsLicense(asset: AssetClassification) {
  return isItAsset(asset) && (asset.assetCategory ?? asset.assetGroup) === "Hardware" && isComputerDeviceType(asset.deviceType);
}

export function supportsAgentAsset(asset: AssetClassification) {
  if (!isItAsset(asset) || (asset.assetCategory ?? asset.assetGroup) !== "Hardware") return false;
  const type = asset.deviceType?.trim().toLowerCase() ?? "";
  return isComputerDeviceType(type) || /\b(server|tablet|mac|macbook|imac)\b/.test(type) || type.includes("เซิร์ฟเวอร์") || type.includes("แท็บเล็ต");
}

export function assetTypeLabel(asset: AssetClassification) {
  return isItAsset(asset) ? asset.deviceType || asset.assetCategory || asset.assetGroup || "IT" : assetClassLabel(asset.assetClass);
}

export function summarizeAssetClasses(assets: AssetClassification[]) {
  return assets.reduce((summary, asset) => {
    if (!isItAsset(asset)) summary.nonIt += 1;
    else if ((asset.assetCategory ?? asset.assetGroup) === "Software") summary.software += 1;
    else summary.hardware += 1;
    return summary;
  }, { hardware: 0, software: 0, nonIt: 0 });
}
