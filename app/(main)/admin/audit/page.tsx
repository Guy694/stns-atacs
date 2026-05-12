import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { listAuditLogs } from "@/lib/audit";

const ACTION_LABEL: Record<string, string> = {
  create: "สร้าง",
  update: "แก้ไข",
  delete: "ลบ",
  transfer: "โอนย้าย",
  dispose: "จำหน่าย/ชำรุด",
  inspect: "ตรวจนับ",
};

const ACTION_COLOR: Record<string, string> = {
  create: "bg-green-100 text-green-700",
  update: "bg-blue-100 text-blue-700",
  delete: "bg-red-100 text-red-700",
  transfer: "bg-purple-100 text-purple-700",
  dispose: "bg-orange-100 text-orange-700",
  inspect: "bg-indigo-100 text-indigo-700",
};

export default async function AuditLogPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/");

  const logs = await listAuditLogs(200);

  return (
    <main className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          📋 ประวัติการใช้งาน (Audit Log)
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          บันทึกการดำเนินการล่าสุด 200 รายการ
        </p>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        {logs.length === 0 ? (
          <div className="text-center py-16" style={{ color: "var(--muted)" }}>
            <p className="text-4xl mb-3">📭</p>
            <p>ยังไม่มีประวัติการใช้งาน</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "rgba(99,102,241,0.04)", borderBottom: "1px solid var(--line)" }}>
                {["วันที่/เวลา", "ผู้ใช้", "การดำเนินการ", "ข้อมูล", "รายละเอียด"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold" style={{ color: "var(--muted)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: "1px solid var(--line)" }} className="hover:bg-indigo-50/30">
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--muted)" }}>
                    {log.createdAt}
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--foreground)" }}>
                    {log.userName || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${ACTION_COLOR[log.action] ?? "bg-gray-100 text-gray-600"}`}>
                      {ACTION_LABEL[log.action] ?? log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>
                    {log.entity}{log.entityId ? ` #${log.entityId}` : ""}
                  </td>
                  <td className="px-4 py-3 text-xs max-w-xs truncate" style={{ color: "var(--foreground)" }}>
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
