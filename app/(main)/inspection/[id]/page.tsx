import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { getInspectionById, getInspectionItems } from "@/lib/inspection";
import { canManageFacility } from "@/lib/permissions";
import { hasPermission } from "@/lib/role-permissions";

export default async function InspectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(await hasPermission(user.role, "inspection.view"))) redirect("/");

  const { id } = await params;
  const [inspection, items] = await Promise.all([
    getInspectionById(Number(id)),
    getInspectionItems(Number(id)),
  ]);

  if (!inspection) notFound();
  if (user.role === "officer" && !canManageFacility(user, inspection.facilityId)) {
    redirect("/inspection");
  }

  const pct = inspection.totalItems > 0
    ? Math.round((inspection.foundItems / inspection.totalItems) * 100)
    : 0;
  const missing = items.filter((i) => !i.found);

  return (
    <main className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <nav className="text-sm" style={{ color: "var(--muted)" }}>
        <Link href="/inspection" style={{ color: "var(--accent)" }}>ตรวจนับทรัพย์สิน</Link>
        <span className="mx-2">›</span>
        <span>{inspection.roundName}</span>
      </nav>

      {/* Header */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
              {inspection.roundName}
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              {inspection.facilityName} · อ.{inspection.districtName}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
              ผู้ตรวจ: {inspection.inspectedBy} · วันที่: {inspection.inspectedAt}
            </p>
            {inspection.note && (
              <p className="text-sm mt-2 p-2 rounded-lg bg-indigo-50" style={{ color: "var(--foreground)" }}>
                📝 {inspection.note}
              </p>
            )}
          </div>

          {/* Summary ring */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center">
              <div
                className="relative w-20 h-20 rounded-full flex items-center justify-center"
                style={{
                  background: `conic-gradient(var(--accent) ${pct * 3.6}deg, #e0e7ff ${pct * 3.6}deg)`,
                }}
              >
                <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center">
                  <span className="text-sm font-bold" style={{ color: "var(--accent)" }}>{pct}%</span>
                </div>
              </div>
              <span className="text-xs mt-1" style={{ color: "var(--muted)" }}>อัตราพบ</span>
            </div>
            <div className="space-y-1">
              <div className="text-sm"><span className="font-bold text-indigo-600">{inspection.foundItems}</span> <span style={{ color: "var(--muted)" }}>พบ</span></div>
              <div className="text-sm"><span className="font-bold text-red-500">{inspection.totalItems - inspection.foundItems}</span> <span style={{ color: "var(--muted)" }}>ไม่พบ</span></div>
              <div className="text-sm"><span className="font-bold" style={{ color: "var(--foreground)" }}>{inspection.totalItems}</span> <span style={{ color: "var(--muted)" }}>ทั้งหมด</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Missing items alert */}
      {missing.length > 0 && (
        <div className="glass-panel rounded-2xl p-5">
          <h2 className="text-base font-bold text-red-600 mb-3">⚠ รายการที่ไม่พบ ({missing.length})</h2>
          <div className="space-y-2">
            {missing.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg px-3 py-2 bg-red-50 border border-red-100"
              >
                <div>
                  <span className="font-medium text-sm text-red-800">{item.assetName}</span>
                  <span className="text-xs text-red-400 ml-2">{item.assetRegistrationNo}</span>
                </div>
                {item.conditionNote && (
                  <span className="text-xs text-red-600">{item.conditionNote}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All items table */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--line)" }}>
          <h2 className="font-bold" style={{ color: "var(--foreground)" }}>
            รายการทรัพย์สินทั้งหมด ({items.length})
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "rgba(99,102,241,0.04)", borderBottom: "1px solid var(--line)" }}>
              {["ทะเบียน", "ชื่อทรัพย์สิน", "ประเภท", "ผล", "หมายเหตุ"].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-semibold" style={{ color: "var(--muted)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} style={{ borderBottom: "1px solid var(--line)" }}>
                <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--muted)" }}>
                  {item.assetRegistrationNo}
                </td>
                <td className="px-4 py-3" style={{ color: "var(--foreground)" }}>
                  <Link href={`/assets/${item.assetId}`} style={{ color: "var(--accent)" }} className="hover:underline">
                    {item.assetName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>
                  {item.deviceType}
                </td>
                <td className="px-4 py-3">
                  {item.found ? (
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                      ✓ พบ
                    </span>
                  ) : (
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                      ✗ ไม่พบ
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>
                  {item.conditionNote}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
