import { redirect } from "next/navigation";

import { StatusBadge } from "@/app/_components/ui/status-badge";
import { getCurrentUser } from "@/lib/auth";
import { listAuditLogs } from "@/lib/audit";
import { formatThaiDateTime } from "@/lib/date-format";
import { hasPermission } from "@/lib/role-permissions";
import Link from "next/link";

type AuditPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(p: Record<string, string | string[] | undefined>, key: string) {
  const value = p[key];
  return Array.isArray(value) ? value[0] : (value ?? "");
}

const ACTION_LABEL: Record<string, string> = {
  create: "สร้าง",
  update: "แก้ไข",
  delete: "ลบ",
  transfer: "โอนย้าย",
  dispose: "จำหน่าย/ชำรุด",
  inspect: "ตรวจนับ",
};

const ACTION_TONE = {
  create: "success",
  update: "info",
  delete: "danger",
  transfer: "primary",
  dispose: "warning",
  inspect: "neutral",
} as const;

export default async function AuditLogPage({ searchParams }: AuditPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const canViewAudit = user.role === "admin" || (await hasPermission(user.role, "audit.view"));
  if (!canViewAudit) redirect("/");
  const canExportAudit = user.role === "admin" || (await hasPermission(user.role, "audit.export"));

  const params = await searchParams;
  const actionFilter = readParam(params, "action") as "create" | "update" | "delete" | "transfer" | "dispose" | "inspect";
  const entityFilter = readParam(params, "entity");
  const actorFilter = readParam(params, "actor");
  const search = readParam(params, "search");
  const dateFrom = readParam(params, "dateFrom");
  const dateTo = readParam(params, "dateTo");

  const logs = await listAuditLogs({
    limit: 300,
    action: ACTION_LABEL[actionFilter] ? actionFilter : undefined,
    entity: entityFilter || undefined,
    actor: actorFilter || undefined,
    search: search || undefined,
  });

  const countsByAction = logs.reduce<Record<string, number>>((acc, log) => {
    acc[log.action] = (acc[log.action] ?? 0) + 1;
    return acc;
  }, {});
  const uniqueUsers = new Set(logs.map((log) => log.userName).filter(Boolean)).size;

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--muted)]">Admin · Security & Tracking</p>
        <h1 className="section-title mt-1 text-3xl font-semibold">ประวัติการใช้งาน (Audit Log)</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          บันทึกการดำเนินการล่าสุด พร้อมค้นหาและกรองเชิงลึก
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="glass-panel rounded-2xl p-4">
          <p className="text-xs text-[var(--muted)]">รายการที่แสดง</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--foreground)]">{logs.length}</p>
        </div>
        <div className="glass-panel rounded-2xl p-4">
          <p className="text-xs text-[var(--muted)]">ผู้ใช้งานที่เคลื่อนไหว</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--foreground)]">{uniqueUsers}</p>
        </div>
        {(["create", "update", "delete", "transfer"] as const).map((key) => (
          <div key={key} className="glass-panel rounded-2xl p-4">
            <p className="text-xs text-[var(--muted)]">{ACTION_LABEL[key]}</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--foreground)]">{countsByAction[key] ?? 0}</p>
          </div>
        ))}
      </div>

      <form method="GET" className="glass-panel flex flex-wrap gap-3 rounded-2xl p-4">
        <input
          name="search"
          defaultValue={search}
          placeholder="ค้นหาจากรายละเอียด / entity / ผู้ใช้"
          className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white/80 px-4 py-2 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
        />
        <input
          name="actor"
          defaultValue={actorFilter}
          placeholder="ชื่อผู้ใช้"
          className="rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
        <input
          name="entity"
          defaultValue={entityFilter}
          placeholder="entity เช่น users"
          className="rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
        <input
          name="dateFrom"
          type="date"
          defaultValue={dateFrom}
          className="rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
        <input
          name="dateTo"
          type="date"
          defaultValue={dateTo}
          className="rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
        <select
          name="action"
          defaultValue={actionFilter}
          className="rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        >
          <option value="">ทุกการดำเนินการ</option>
          {Object.entries(ACTION_LABEL).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <button type="submit" className="rounded-xl bg-[var(--accent-strong)] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90">
          ค้นหา
        </button>
        {canExportAudit && (
          <a
            href={`/api/export/audit?search=${encodeURIComponent(search)}&actor=${encodeURIComponent(actorFilter)}&entity=${encodeURIComponent(entityFilter)}&action=${encodeURIComponent(actionFilter)}&dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`}
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
          >
            Export CSV
          </a>
        )}
        {(search || actorFilter || entityFilter || actionFilter || dateFrom || dateTo) && (
          <Link href="/admin/audit" className="rounded-xl border border-black/10 bg-white/80 px-4 py-2 text-sm text-[var(--muted)] hover:bg-white">
            ล้างตัวกรอง
          </Link>
        )}
      </form>

      <div className="glass-panel rounded-2xl overflow-hidden">
        {logs.length === 0 ? (
          <div className="text-center py-16" style={{ color: "var(--muted)" }}>
            <p>ยังไม่มีประวัติการใช้งาน</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--neutral-bg)", borderBottom: "1px solid var(--line)" }}>
                {["วันที่/เวลา", "ผู้ใช้", "การดำเนินการ", "ข้อมูล", "รายละเอียด"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold" style={{ color: "var(--muted)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: "1px solid var(--line)" }} className="hover:bg-[var(--neutral-bg)]">
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--muted)" }}>
                    {formatThaiDateTime(log.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--foreground)" }}>
                    {log.userName || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={ACTION_TONE[log.action as keyof typeof ACTION_TONE] ?? "neutral"}>
                      {ACTION_LABEL[log.action] ?? log.action}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>
                    {log.entity}{log.entityId ? ` #${log.entityId}` : ""}
                  </td>
                  <td className="max-w-xl px-4 py-3 text-xs" style={{ color: "var(--foreground)" }}>
                    {log.summary}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
