import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { listAssets } from "@/lib/assets";
import { hasPermission } from "@/lib/role-permissions";

function escapeCsv(val: string | undefined | null) {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canExportAssets = await hasPermission(user.role, "assets.view");
  if (!canExportAssets) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const facilityId = searchParams.get("facilityId") ? Number(searchParams.get("facilityId")) : undefined;
  const status = searchParams.get("status") ?? undefined;
  const search = searchParams.get("q") ?? undefined;

  const assets = await listAssets({ facilityId, status, search });

  const isAdmin = user.role === "admin";

  const headers = [
    "ลำดับ",
    "เลขครุภัณฑ์",
    "ชื่อทรัพย์สิน",
    "หมวด",
    "ประเภท",
    "หน่วยงาน",
    "อำเภอ",
    "สถานะ",
    "ยี่ห้อ",
    "ระบบปฏิบัติการ",
    "วันหมดอายุ MA",
    "ราคาที่ซื้อ (บาท)",
    "วันที่ซื้อ",
    "เลขที่สัญญา / PO",
    "ผู้รับผิดชอบ",
    "ตำแหน่งติดตั้ง",
    ...(isAdmin ? ["Private IP", "Public IP", "Serial Number"] : []),
    "อัปเดตล่าสุด",
    "อัปเดตโดย",
  ];

  const statusLabel: Record<string, string> = {
    Active: "ใช้งานอยู่",
    Inactive: "ไม่ใช้งาน",
    Broken: "ชำรุด",
  };

  const rows = assets.map((a, i) => [
    i + 1,
    a.assetRegistrationNo,
    a.assetName,
    a.assetGroup,
    a.deviceType || a.assetGroup,
    a.facilityName,
    a.districtName,
    statusLabel[a.currentStatus] ?? a.currentStatus,
    a.manufacturerBrand,
    a.operatingSystem,
    a.maintenanceEndDate,
    a.purchasePrice != null ? a.purchasePrice.toString() : "",
    a.purchaseDate,
    a.purchaseOrderNo,
    a.ownerName,
    a.locationDetail,
    ...(isAdmin ? [a.privateIp, a.publicIp, a.serialNumber] : []),
    a.updatedAt,
    a.updatedBy,
  ]);

  const csvLines = [
    headers.map(escapeCsv).join(","),
    ...rows.map((r) => r.map((v) => escapeCsv(String(v ?? ""))).join(",")),
  ];
  const csv = "\ufeff" + csvLines.join("\r\n"); // BOM for Thai characters in Excel

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="atacs-assets-${today}.csv"`,
    },
  });
}
