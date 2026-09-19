import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { listAssets } from "@/lib/assets";
import { parseAssetListQuery } from "@/lib/asset-list-query";
import { isItAsset } from "@/lib/asset-policy";
import { canSeeSensitiveAssetNetwork } from "@/lib/permissions";
import { resolveFacilityFilter } from "@/lib/facility-scope";
import { hasPermission } from "@/lib/role-permissions";
import { readRequestIp, recordSecurityEvent } from "@/lib/security";

const IMPORT_HEADERS = [
  "id",
  "work_group_id",
  "asset_registration_no",
  "asset_name",
  "asset_class",
  "asset_category",
  "asset_group",
  "device_type",
  "manufacturer_brand",
  "manufacturer_model",
  "manufacturer_specification",
  "serial_number",
  "operating_system",
  "operating_system_version",
  "windows_license_status",
  "private_ip",
  "public_ip",
  "owner_name",
  "location_detail",
  "current_status",
  "purchase_price",
  "purchase_date",
  "purchase_order_no",
  "maintenance_start_date",
  "maintenance_end_date",
  "installed_at",
  "usage_description",
];

const IMPORT_SAMPLE_ROWS = [
  [
    "",
    "",
    "COM-2569-0001",
    "คอมพิวเตอร์ตั้งโต๊ะตัวอย่าง",
    "IT",
    "Hardware",
    "Computer",
    "Desktop",
    "Example Brand",
    "Example Model",
    "CPU i5 / RAM 16 GB / SSD 512 GB",
    "EXAMPLE-SN-001",
    "Windows",
    "11 Pro",
    "Genuine",
    "192.168.1.10",
    "",
    "นายตัวอย่าง เจ้าหน้าที่",
    "ห้องธุรการ ชั้น 1",
    "Active",
    "24500",
    "2026-01-15",
    "PO-2569-001",
    "2026-01-15",
    "2029-01-14",
    "2026-01-20",
    "สำหรับงานธุรการ",
  ],
];

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function csvResponse(rows: unknown[][], filename: string) {
  const csv = `\ufeff${rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n")}`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    await recordSecurityEvent({
      eventType: "api_unauthorized",
      ipAddress: readRequestIp(req.headers),
      path: req.nextUrl.pathname,
      detail: "พยายาม export ทรัพย์สินโดยไม่มี session",
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canExportAssets = await hasPermission(user.role, "assets.view");
  if (!canExportAssets) {
    await recordSecurityEvent({
      eventType: "api_forbidden",
      ipAddress: readRequestIp(req.headers),
      identity: user.fullName,
      path: req.nextUrl.pathname,
      detail: "ไม่มีสิทธิ์ export ทรัพย์สิน",
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const template = searchParams.get("template");
  if (template === "csv" || template === "1") {
    return csvResponse([IMPORT_HEADERS, ...IMPORT_SAMPLE_ROWS], "atacs-assets-import-example.csv");
  }

  const requestedFacilityId = searchParams.get("facilityId") ? Number(searchParams.get("facilityId")) : undefined;
  const facilityId = resolveFacilityFilter(user, requestedFacilityId);
  if (facilityId === null) {
    return NextResponse.json({ error: "No facility scope" }, { status: 403 });
  }

  let filter;
  try {
    filter = parseAssetListQuery(searchParams);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ตัวกรองไม่ถูกต้อง" }, { status: 400 });
  }
  const assets = await listAssets({ ...filter, facilityId });
  const canViewNetwork = await hasPermission(user.role, "assets.network.view");

  const rows = assets.map((asset) => [
    asset.id,
    asset.workGroupId ?? "",
    asset.assetRegistrationNo,
    asset.assetName,
    asset.assetClass,
    asset.assetCategory ?? asset.assetGroup,
    asset.assetGroupDetail ?? "",
    asset.deviceType,
    asset.manufacturerBrand,
    asset.manufacturerModel ?? "",
    asset.manufacturerSpecification ?? "",
    asset.serialNumber,
    asset.operatingSystem,
    asset.operatingSystemVersion ?? "",
    asset.windowsLicenseStatus ?? "",
    canViewNetwork && isItAsset(asset) && canSeeSensitiveAssetNetwork(user, asset.facilityId) ? asset.privateIp : "",
    canViewNetwork && isItAsset(asset) && canSeeSensitiveAssetNetwork(user, asset.facilityId) ? asset.publicIp : "",
    asset.ownerName,
    asset.locationDetail,
    asset.currentStatus,
    asset.purchasePrice ?? "",
    asset.purchaseDate,
    asset.purchaseOrderNo,
    asset.maintenanceStartDate,
    asset.maintenanceEndDate,
    asset.installedAt ?? "",
    asset.usageDescription,
  ]);

  const today = new Date().toISOString().slice(0, 10);
  return csvResponse([IMPORT_HEADERS, ...rows], `atacs-assets-${today}.csv`);
}
