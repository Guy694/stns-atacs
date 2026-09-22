import type { AssetListFilter } from "@/lib/assets";
import { parseAssetClass } from "@/lib/asset-policy";

/** Shared read/export filters. Facility authorization is always resolved by the caller. */
export function parseAssetListQuery(params: URLSearchParams): AssetListFilter {
  const text = (name: string, alias?: string) => (params.get(name) ?? (alias ? params.get(alias) : null))?.trim() || undefined;
  const positive = (name: string, alias?: string) => {
    const value = text(name, alias);
    if (!value) return undefined;
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`${name} ต้องเป็นจำนวนเต็มบวก`);
    return number;
  };
  const group = text("group");
  if (group !== undefined && group !== "Hardware" && group !== "Software") throw new Error("group ไม่ถูกต้อง");
  const assetClass = text("assetClass");
  const sort = text("sort");
  if (sort && !["updated_desc", "updated_asc", "name_asc", "name_desc", "ma_soon"].includes(sort)) throw new Error("sort ไม่ถูกต้อง");
  return {
    search: text("q", "search"),
    status: text("status"),
    assetClass: assetClass ? parseAssetClass(assetClass) : undefined,
    assetGroup: group,
    subtypeId: positive("subtype"),
    district: text("district"),
    deviceType: text("deviceType"),
    workGroupId: positive("workGroupId", "workGroup"),
    maExpiringDays: positive("maExpiringDays", "maDays"),
    sort: sort as AssetListFilter["sort"],
  };
}
