import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { executeStatement, selectRows } from "@/lib/mysql";

export type AuditAction = "create" | "update" | "delete" | "transfer" | "dispose" | "inspect";

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

export async function writeAuditLog(input: {
  userId?: number | null;
  userName?: string;
  action: AuditAction;
  entity: string;
  entityId?: number | null;
  summary?: string;
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
}

export async function listAuditLogs(limit = 100): Promise<AuditLog[]> {
  const rows = await selectRows<AuditRow>(
    `SELECT id, user_id, user_name, action, entity, entity_id, summary, created_at
     FROM audit_logs ORDER BY created_at DESC LIMIT ?`,
    [limit]
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
