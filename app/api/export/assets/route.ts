import { toCsv } from "@/lib/csv";
import { IMPORT_COLUMNS, IMPORT_HEADERS, importSampleRow, REQUIREMENT_LABELS } from "@/lib/asset-import-columns";
import { writeWorkbook, type Cell } from "@/lib/xlsx-writer";
import { DETAIL_COLUMNS } from "@/lib/asset-details";
import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { listAssets } from "@/lib/assets";
import { parseAssetListQuery } from "@/lib/asset-list-query";
import { isItAsset } from "@/lib/asset-policy";
import { canSeeSensitiveAssetNetwork } from "@/lib/permissions";
import { resolveFacilityFilter } from "@/lib/facility-scope";
import { hasPermission } from "@/lib/role-permissions";
import { readRequestIp, recordSecurityEvent } from "@/lib/security";



function csvResponse(rows: unknown[][], filename: string) {
  // SEC-12: toCsv เติม ' นำหน้าค่าที่ Excel จะตีความเป็นสูตร
  const csv = toCsv(rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}


/** แถวตัวอย่างในไฟล์ต้นแบบ — ใช้ค่า example จากคำอธิบายคอลัมน์ เพื่อให้เอกสารกับไฟล์ตรงกันเสมอ */
const IMPORT_SAMPLE_ROWS = [
  importSampleRow({
    ...Object.fromEntries(IMPORT_COLUMNS.map((column) => [column.column, column.example])),
    // รหัสกลุ่มงานต่างกันในแต่ละหน่วยงาน จึงเว้นว่างในแถวตัวอย่าง (ดูรหัสจริงได้ที่หน้าจอนำเข้าข้อมูล)
    work_group_id: "",
    work_group_name: "",
  }),
];

/**
 * ไฟล์ Excel ต้นแบบ 2 ชีต
 *   1) "ข้อมูล"           หัวคอลัมน์ + แถวตัวอย่าง (ลบแถวตัวอย่างออกก่อนนำเข้าจริง)
 *   2) "คำอธิบายคอลัมน์"  ความหมาย ความจำเป็น รูปแบบ ค่าที่อนุญาต และตัวอย่างของทุกคอลัมน์
 */
function templateWorkbookResponse() {
  const header = { bold: true, size: 10, border: true, fill: "D9E1F2", h: "center" as const, wrap: true };
  const text = { size: 10, border: true, v: "top" as const };
  const wrap = { ...text, wrap: true };

  const dataSheet: Cell[][] = [
    IMPORT_HEADERS.map((column) => ({ v: column, s: header })),
    IMPORT_SAMPLE_ROWS[0].map((value) => ({ v: value, s: text })),
  ];

  const docRows: Cell[][] = [
    [{ v: "คำอธิบายคอลัมน์ไฟล์นำเข้าทรัพย์สิน (ATACS)", s: { bold: true, size: 13 } }],
    [{ v: "กรอกข้อมูลในชีต “ข้อมูล” · ห้ามแก้ชื่อหัวคอลัมน์ · ลบแถวตัวอย่างออกก่อนนำเข้าจริง · วันที่ทุกช่องใช้ ค.ศ. รูปแบบ YYYY-MM-DD", s: { size: 10 } }],
    [{ v: "ตอนแก้ไขข้อมูลเดิม ให้ส่งออกข้อมูลปัจจุบันจากระบบมาแก้แล้วนำเข้ากลับ (คอลัมน์ id จะถูกใช้ระบุรายการ)", s: { size: 10 } }],
    [null],
    [
      { v: "คอลัมน์", s: header },
      { v: "ความหมาย", s: header },
      { v: "ความจำเป็น", s: header },
      { v: "รูปแบบ", s: header },
      { v: "ค่าที่อนุญาต", s: header },
      { v: "ตัวอย่าง", s: header },
      { v: "หมายเหตุ", s: header },
    ],
    ...IMPORT_COLUMNS.map((column) => [
      { v: column.column, s: text },
      { v: column.label, s: wrap },
      { v: REQUIREMENT_LABELS[column.requirement], s: text },
      { v: column.format, s: wrap },
      { v: column.allowed ?? "", s: wrap },
      { v: column.example, s: wrap },
      { v: column.note ?? "", s: wrap },
    ]),
  ];

  const buffer = writeWorkbook([
    { name: "ข้อมูล", rows: dataSheet, freezeRows: 1, cols: IMPORT_HEADERS.map(() => 22) },
    {
      name: "คำอธิบายคอลัมน์",
      rows: docRows,
      freezeRows: 5,
      cols: [26, 30, 14, 24, 52, 24, 60],
      merges: ["A1:G1", "A2:G2", "A3:G3"],
    },
  ]);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="atacs-assets-import-template.xlsx"',
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
  if (template === "xlsx") {
    return templateWorkbookResponse();
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
    asset.extensions?.[asset.assetClass]?.subtypeId ?? "",
    ...DETAIL_COLUMNS.map(key => asset.extensions?.[asset.assetClass]?.details[key] ?? ""),
    asset.usefulLifeYears ?? "",
    asset.assetCodePrefix,
    asset.assetAccountingCode,
    asset.fundingSource,
    asset.acquisitionMethod,
    asset.vendorName,
    asset.warrantyEndDate,
    asset.unitName,
    asset.workGroupName ?? "",
  ]);

  const today = new Date().toISOString().slice(0, 10);
  return csvResponse([IMPORT_HEADERS, ...rows], `atacs-assets-${today}.csv`);
}
