import { toCsv } from "@/lib/csv";
import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { selectRows } from "@/lib/mysql";
import type { RowDataPacket } from "mysql2/promise";
import { readRequestIp, recordSecurityEvent } from "@/lib/security";

type AuditExportRow = RowDataPacket & {
  id: number;
  created_at: Date | string;
  user_name: string | null;
  action: string;
  entity: string;
  entity_id: number | null;
  summary: string | null;
};


export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    await recordSecurityEvent({
      eventType: "api_unauthorized",
      ipAddress: readRequestIp(req.headers),
      path: req.nextUrl.pathname,
      detail: "พยายาม export audit log โดยไม่มี session",
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "admin") {
    await recordSecurityEvent({
      eventType: "api_forbidden",
      ipAddress: readRequestIp(req.headers),
      identity: user.fullName,
      path: req.nextUrl.pathname,
      detail: "ไม่มีสิทธิ์ export audit log",
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const action = (searchParams.get("action") ?? "").trim();
  const entity = (searchParams.get("entity") ?? "").trim();
  const actor = (searchParams.get("actor") ?? "").trim();
  const search = (searchParams.get("search") ?? "").trim();
  const dateFrom = (searchParams.get("dateFrom") ?? "").trim();
  const dateTo = (searchParams.get("dateTo") ?? "").trim();

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (action) {
    conditions.push("action = ?");
    values.push(action);
  }
  if (entity) {
    conditions.push("entity = ?");
    values.push(entity);
  }
  if (actor) {
    conditions.push("user_name LIKE ?");
    values.push(`%${actor}%`);
  }
  if (search) {
    conditions.push("(summary LIKE ? OR entity LIKE ? OR COALESCE(user_name, '') LIKE ?)");
    const like = `%${search}%`;
    values.push(like, like, like);
  }
  if (dateFrom) {
    conditions.push("DATE(created_at) >= ?");
    values.push(dateFrom);
  }
  if (dateTo) {
    conditions.push("DATE(created_at) <= ?");
    values.push(dateTo);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await selectRows<AuditExportRow>(
    `SELECT id, created_at, user_name, action, entity, entity_id, summary
     FROM audit_logs
     ${where}
     ORDER BY created_at DESC
     LIMIT 5000`,
    values
  );

  const csvRows = rows.map((row) => [
    row.id,
    row.created_at instanceof Date
      ? row.created_at.toISOString().slice(0, 19).replace("T", " ")
      : String(row.created_at).slice(0, 19).replace("T", " "),
    row.user_name ?? "",
    row.action,
    row.entity,
    row.entity_id ?? "",
    row.summary ?? "",
  ]);

  // SEC-12: toCsv เติม ' นำหน้าค่าที่ Excel จะตีความเป็นสูตร
  const csv = toCsv([["id", "created_at", "user_name", "action", "entity", "entity_id", "summary"], ...csvRows], { bom: false });

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse("\ufeff" + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"atacs-audit-${today}.csv\"`,
    },
  });
}
