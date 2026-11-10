/**
 * Public (no sign-in) view of an asset reached by scanning its QR sticker — for transparency when
 * outside auditors inspect. Whitelist only: anything not copied here never reaches the browser.
 * Computers must not reveal network or machine identity (IP, MAC, hostname, logged-in user, OS,
 * Windows licence, agent data); serial numbers, owners, rooms and procurement details stay private too.
 */
import { assetClassLabel } from "@/lib/asset-classes";
import { formatAssetNumber } from "@/lib/asset-number";
import { assetStatusLabel } from "@/lib/asset-status";

export const PUBLIC_ASSET_FIELDS = [
  "id",
  "assetName",
  "registrationNo",
  "classLabel",
  "deviceType",
  "facilityName",
  "workGroupName",
  "brandModel",
  "status",
  "statusLabel",
  "acquiredYearBE",
  "purchasePrice",
  "value",
] as const;

export type PublicAssetValue = {
  status: string;
  bookValue: number | null;
  isFullyDepreciated: boolean;
  asOf: string;
};

export type PublicAssetView = {
  id: number;
  assetName: string;
  registrationNo: string | null;
  classLabel: string | null;
  deviceType: string | null;
  facilityName: string | null;
  workGroupName: string | null;
  brandModel: string | null;
  status: string | null;
  statusLabel: string;
  acquiredYearBE: number | null;
  purchasePrice: number | null;
  value: PublicAssetValue;
};

type SourceAsset = {
  id: number;
  assetName: string;
  assetRegistrationNo?: string | null;
  assetCodePrefix?: string | null;
  assetClass?: string | null;
  deviceType?: string | null;
  facilityName?: string | null;
  workGroupName?: string | null;
  manufacturerBrand?: string | null;
  manufacturerModel?: string | null;
  currentStatus?: string | null;
  purchaseDate?: string | null;
  purchasePrice?: number | null;
};

type NameSource = Pick<SourceAsset, "assetName" | "deviceType" | "manufacturerBrand" | "manufacturerModel">;

const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const IPV6 = /\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}\b/gi;
const MAC = /\b[0-9a-f]{2}(?:[:-][0-9a-f]{2}){5}\b/gi;
// Default Windows machine names (DESKTOP-ABC1234, LAPTOP-…, WIN-…).
const DEFAULT_HOSTNAME = /\b(?:DESKTOP|LAPTOP|WIN|PC)-[A-Z0-9]{3,15}\b/gi;
const SEPARATORS = /^[\s·|/,:;\-–—]+|[\s·|/,:;\-–—]+$/g;

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const clean = (value: string | null | undefined) => (value ?? "").trim() || null;

/** Asset name with machine identity removed; falls back to "type brand model" when nothing useful remains. */
export function publicAssetName(asset: NameSource, hidden: { hostname?: string | null } = {}) {
  let name = asset.assetName ?? "";
  const hostname = hidden.hostname?.trim();
  if (hostname) name = name.replace(new RegExp(escapeRegExp(hostname), "gi"), " ");
  name = name.replace(MAC, " ").replace(IPV6, " ").replace(IPV4, " ").replace(DEFAULT_HOSTNAME, " ");
  name = name.replace(/\s*[·|/]\s*(?=[·|/]|$)/g, " ").replace(/\s+/g, " ").replace(SEPARATORS, "").trim();
  if (name) return name;
  return [asset.deviceType, asset.manufacturerBrand, asset.manufacturerModel].map(clean).filter(Boolean).join(" ");
}

function buddhistYear(date: string | null | undefined) {
  const match = /^(\d{4})-\d{2}-\d{2}/.exec(date ?? "");
  return match ? Number(match[1]) + 543 : null;
}

export function toPublicAssetView(
  asset: SourceAsset,
  valuation: { status: string; bookValue: number | null; isFullyDepreciated: boolean },
  asOf: string,
  hidden: { hostname?: string | null } = {}
): PublicAssetView {
  const brandModel = [clean(asset.manufacturerBrand), clean(asset.manufacturerModel)].filter(Boolean).join(" ") || null;
  const price = typeof asset.purchasePrice === "number" && Number.isFinite(asset.purchasePrice) ? asset.purchasePrice : null;
  return {
    id: asset.id,
    assetName: publicAssetName(asset, hidden) || "ครุภัณฑ์",
    registrationNo: formatAssetNumber(asset.assetCodePrefix, asset.assetRegistrationNo) || null,
    classLabel: asset.assetClass ? assetClassLabel(asset.assetClass, "full") : null,
    deviceType: clean(asset.deviceType),
    facilityName: clean(asset.facilityName),
    workGroupName: clean(asset.workGroupName),
    brandModel,
    status: clean(asset.currentStatus),
    statusLabel: assetStatusLabel(asset.currentStatus),
    acquiredYearBE: buddhistYear(asset.purchaseDate),
    purchasePrice: price,
    value: {
      status: valuation.status,
      bookValue: valuation.status === "ok" ? valuation.bookValue : null,
      isFullyDepreciated: valuation.isFullyDepreciated,
      asOf,
    },
  };
}
