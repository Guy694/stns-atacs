import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/role-permissions";
import { selectRows } from "@/lib/mysql";
import type { RowDataPacket } from "mysql2/promise";

type AuditExportRow = RowDataPacket & {
  id: number;
  created_at: Date | string;
  user_name: string | null;
  action: string;
  entity: string;
  entity_id: number | null;
  summary: string | null;
};

function escapeCsv(value: string | null | undefined) {
  const normalized = String(value ?? "");
  if (normalized.includes(",") || normalized.includes('"') || normalized.includes("\n")) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canExportAudit = user.role === "admin" || (await hasPermission(user.role, "audit.export"));
  if (!canExportAudit) {
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

  const csv = [
    ["id", "created_at", "user_name", "action", "entity", "entity_id", "summary"].join(","),
    ...csvRows.map((row) => row.map((value) => escapeCsv(String(value))).join(",")),
  ].join("\r\n");

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse("\ufeff" + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"atacs-audit-${today}.csv\"`,
    },
  });
}
