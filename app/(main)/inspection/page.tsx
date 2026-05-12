import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { listInspections } from "@/lib/inspection";
import { listFacilities } from "@/lib/assets";
import NewInspectionForm from "./_components/new-inspection-form";

export default async function InspectionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const view = params["view"] === "new" ? "new" : "list";

  const [inspections, facilities] = await Promise.all([
    listInspections(),
    listFacilities(),
  ]);

  return (
    <main className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
            ✔ ตรวจนับทรัพย์สิน
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            บันทึกรอบการตรวจนับสินทรัพย์สารสนเทศประจำหน่วยบริการ
          </p>
        </div>
        {view !== "new" && (
          <a
            href="/inspection?view=new"
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "var(--accent)" }}
          >
            + เริ่มรอบตรวจนับใหม่
          </a>
        )}
      </div>

      {/* New form */}
      {view === "new" && (
        <div className="glass-panel rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-4" style={{ color: "var(--foreground)" }}>
            เริ่มรอบตรวจนับใหม่
          </h2>
          <NewInspectionForm facilities={facilities} />
        </div>
      )}

      {/* List */}
      {view !== "new" && (
        <div className="glass-panel rounded-2xl overflow-hidden">
          {inspections.length === 0 ? (
            <div className="text-center py-16" style={{ color: "var(--muted)" }}>
              <p className="text-4xl mb-3">📋</p>
              <p className="font-semibold">ยังไม่มีรอบการตรวจนับ</p>
              <p className="text-sm mt-1">คลิก &quot;เริ่มรอบตรวจนับใหม่&quot; เพื่อบันทึกครั้งแรก</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)", background: "rgba(99,102,241,0.04)" }}>
                  {["รอบการตรวจนับ", "หน่วยบริการ", "อำเภอ", "ผู้ตรวจ", "วันที่", "พบ/ทั้งหมด", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold" style={{ color: "var(--muted)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inspections.map((ins) => {
                  const pct = ins.totalItems > 0 ? Math.round((ins.foundItems / ins.totalItems) * 100) : 0;
                  return (
                    <tr
                      key={ins.id}
                      style={{ borderBottom: "1px solid var(--line)" }}
                      className="hover:bg-indigo-50/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium" style={{ color: "var(--foreground)" }}>
                        {ins.roundName}
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--foreground)" }}>
                        {ins.facilityName}
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--muted)" }}>
                        {ins.districtName}
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--muted)" }}>
                        {ins.inspectedBy}
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--muted)" }}>
                        {ins.inspectedAt}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-indigo-100 overflow-hidden w-20">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: pct + "%",
                                background: pct >= 90 ? "var(--accent)" : pct >= 70 ? "var(--warning)" : "var(--danger)",
                              }}
                            />
                          </div>
                          <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                            {ins.foundItems}/{ins.totalItems}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={"/inspection/" + ins.id}
                          className="text-xs font-semibold"
                          style={{ color: "var(--accent)" }}
                        >
                          ดูรายละเอียด →
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </main>
  );
}
