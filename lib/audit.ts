import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { executeStatement, selectRows } from "@/lib/mysql";
import { notifyTelegramSafe } from "@/lib/telegram";

export type AuditAction = "create" | "update" | "delete" | "transfer" | "dispose" | "inspect";

export type AuditLogFilter = {
  limit?: number;
  offset?: number;
  dateFrom?: string;
  dateTo?: string;
  action?: AuditAction;
  entity?: string;
  actor?: string;
  search?: string;
};

export type AuditLog = {
  id: number;
  userId: number | null;
  userName: string;
  action: AuditAction;
  entity: string;
  entityId: number | null;
  summary: string;
  createdAt: string;
};

type AuditRow = RowDataPacket & {
  id: number;
  user_id: number | null;
  user_name: string | null;
  action: AuditAction;
  entity: string;
  entity_id: number | null;
  summary: string | null;
  created_at: Date | string;
};

const ENTITY_LABELS: Record<string, string> = {
  information_assets: "ทะเบียนทรัพย์สิน",
  asset_inspections: "รอบตรวจนับทรัพย์สิน",
  health_facilities: "ข้อมูลหน่วยงาน",
  users: "ผู้ใช้งานระบบ",
  role_permissions: "สิทธิ์การใช้งาน",
};

export async function writeAuditLog(input: {
  userId?: number | null;
  userName?: string;
  action: AuditAction;
  entity: string;
  entityId?: number | null;
  summary?: string;
  // Import routes send one summary after processing all rows.
  skipDataAlert?: boolean;
}) {
  await executeStatement(
    `INSERT INTO audit_logs (user_id, user_name, action, entity, entity_id, summary)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.userId ?? null,
      input.userName ?? null,
      input.action,
      input.entity,
      input.entityId ?? null,
      input.summary ?? null,
    ]
  );

  if (input.action !== "create" || input.skipDataAlert) return;

  const positiveInteger = (value: string | undefined, fallback: number) => {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
  };
  const threshold = positiveInteger(process.env.TELEGRAM_DATA_ALERT_THRESHOLD, 50);
  const windowMinutes = positiveInteger(process.env.TELEGRAM_DATA_ALERT_WINDOW_MINUTES, 10);

  // Alert failures must not turn a successfully saved record into a failed save.
  try {
    const [row] = await selectRows<RowDataPacket & { total: number }>(
      `SELECT COUNT(*) AS total FROM audit_logs
       WHERE action = 'create' AND entity = ? AND user_id <=> ?
         AND created_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
      [input.entity, input.userId ?? null, windowMinutes]
    );
    const total = Number(row?.total ?? 0);
    if (total < threshold) return;

    const bucket = Math.floor(Date.now() / (windowMinutes * 60 * 1000));
    await notifyTelegramSafe({
      category: "data",
      title: "มีการเพิ่มข้อมูลจำนวนมากผิดปกติ",
      eventKey: `data-burst:${input.entity}:${input.userId ?? "system"}:${bucket}`,
      details: {
        ผู้ดำเนินการ: input.userName ?? "system",
        ประเภทข้อมูล: ENTITY_LABELS[input.entity] ?? input.entity,
        จำนวนข้อมูล: `${total} record ภายใน ${windowMinutes} นาที`,
        เกณฑ์แจ้งเตือน: `${threshold} record`,
      },
    });
  } catch (error) {
    console.error(`Data alert failed (${error instanceof Error ? error.name : "unknown"})`);
  }
}

function auditWhere(filter: AuditLogFilter) {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filter.action) {
    conditions.push("action = ?");
    values.push(filter.action);
  }

  if (filter.entity) {
    conditions.push("entity = ?");
    values.push(filter.entity);
  }

  if (filter.actor) {
    conditions.push("user_name LIKE ?");
    values.push(`%${filter.actor}%`);
  }

  if (filter.search) {
    conditions.push("(summary LIKE ? OR entity LIKE ? OR COALESCE(user_name, '') LIKE ?)");
    const like = `%${filter.search}%`;
    values.push(like, like, like);
  }

  if (filter.dateFrom) {
    conditions.push("created_at >= ?");
    values.push(filter.dateFrom);
  }
  if (filter.dateTo) {
    conditions.push("created_at < DATE_ADD(?, INTERVAL 1 DAY)");
    values.push(filter.dateTo);
  }

  return { where: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "", values };
}

export async function paginateAuditLogs(filter: AuditLogFilter, requestedPage = 1) {
  const pageSize = 25;
  const { where, values } = auditWhere(filter);
  const [count] = await selectRows<RowDataPacket & { total: number }>(
    `SELECT COUNT(*) AS total FROM audit_logs ${where}`, values
  );
  const total = Number(count.total);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(totalPages, Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1);
  const logs = await listAuditLogs({ ...filter, limit: pageSize, offset: (page - 1) * pageSize });
  return { logs, total, totalPages, page, pageSize };
}

export async function listAuditLogs(limitOrFilter: number | AuditLogFilter = 100): Promise<AuditLog[]> {
  const filter = typeof limitOrFilter === "number" ? { limit: limitOrFilter } : limitOrFilter;
  const limit = Number.isSafeInteger(filter.limit) ? Math.max(1, Math.min(500, filter.limit!)) : 100;
  const offset = Number.isSafeInteger(filter.offset) ? Math.max(0, filter.offset!) : 0;
  const { where, values } = auditWhere(filter);

  const rows = await selectRows<AuditRow>(
    `SELECT id, user_id, user_name, action, entity, entity_id, summary, created_at
     FROM audit_logs
     ${where}
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    userName: r.user_name ?? "",
    action: r.action,
    entity: r.entity,
    entityId: r.entity_id,
    summary: r.summary ?? "",
    createdAt: (r.created_at instanceof Date
      ? r.created_at.toISOString()
      : String(r.created_at)
    ).slice(0, 19).replace("T", " "),
  }));
}
