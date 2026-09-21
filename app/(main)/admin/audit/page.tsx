import { redirect } from "next/navigation";

import { StatusBadge } from "@/app/_components/ui/status-badge";
import { getCurrentUser } from "@/lib/auth";
import { paginateAuditLogs } from "@/lib/audit";
import { formatThaiDateTime } from "@/lib/date-format";
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
  if (user.role !== "admin") redirect("/dashboard");

  const params = await searchParams;
  const actionFilter = readParam(params, "action") as "create" | "update" | "delete" | "transfer" | "dispose" | "inspect";
  const entityFilter = readParam(params, "entity");
  const actorFilter = readParam(params, "actor");
  const search = readParam(params, "search");
  const dateFrom = readParam(params, "dateFrom");
  const dateTo = readParam(params, "dateTo");

  const { logs, total, totalPages, page, pageSize } = await paginateAuditLogs({
    action: ACTION_LABEL[actionFilter] ? actionFilter : undefined,
    entity: entityFilter || undefined,
    actor: actorFilter || undefined,
    search: search || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }, Number(readParam(params, "page")));

  function pageHref(targetPage: number) {
    const query = new URLSearchParams();
    for (const key of ["search", "actor", "entity", "action", "dateFrom", "dateTo"]) {
      const value = readParam(params, key);
      if (value) query.set(key, value);
    }
    query.set("page", String(targetPage));
    return `/admin/audit?${query.toString()}`;
  }
  const visiblePages = [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b);

  const countsByAction = logs.reduce<Record<string, number>>((acc, log) => {
    acc[log.action] = (acc[log.action] ?? 0) + 1;
    return acc;
  }, {});
  const uniqueUsers = new Set(logs.map((log) => log.userName).filter(Boolean)).size;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-[0.12em] text-[var(--accent-strong)]">ADMIN · SECURITY &amp; TRACKING</p>
        <h1 className="section-title mt-1 text-3xl font-semibold">ประวัติการใช้งาน (Audit Log)</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          บันทึกการดำเนินการล่าสุด พร้อมค้นหาและกรองเชิงลึก
        </p>
      </div>

      <p className="text-sm text-[var(--muted)]">สรุปรายการในหน้านี้</p>
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
        <a
          href={`/api/export/audit?search=${encodeURIComponent(search)}&actor=${encodeURIComponent(actorFilter)}&entity=${encodeURIComponent(entityFilter)}&action=${encodeURIComponent(actionFilter)}&dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`}
          className="secondary-action"
        >
          Export CSV
        </a>
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
      <nav aria-label="แบ่งหน้าประวัติการใช้งาน" className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--muted)]" aria-live="polite">
          แสดง {total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} จาก {total.toLocaleString("th-TH")} รายการ · หน้า {page} จาก {totalPages}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="rounded-xl border border-black/10 px-3 py-2 text-sm hover:bg-white">ก่อนหน้า</Link>
          ) : (
            <span aria-disabled="true" className="rounded-xl border border-black/10 px-3 py-2 text-sm text-[var(--muted)]">ก่อนหน้า</span>
          )}
          {visiblePages.map((value, index) => (
            <span key={value} className="flex items-center gap-2">
              {index > 0 && value - visiblePages[index - 1] > 1 && <span aria-hidden="true">…</span>}
              <Link href={pageHref(value)} aria-label={`หน้า ${value}`} aria-current={value === page ? "page" : undefined}
                className={`rounded-xl border px-3 py-2 text-sm ${value === page ? "border-transparent bg-[var(--accent-strong)] text-white" : "border-black/10 hover:bg-white"}`}>
                {value}
              </Link>
            </span>
          ))}
          {page < totalPages ? (
            <Link href={pageHref(page + 1)} className="rounded-xl border border-black/10 px-3 py-2 text-sm hover:bg-white">ถัดไป</Link>
          ) : (
            <span aria-disabled="true" className="rounded-xl border border-black/10 px-3 py-2 text-sm text-[var(--muted)]">ถัดไป</span>
          )}
        </div>
      </nav>
    </div>
  );
}
