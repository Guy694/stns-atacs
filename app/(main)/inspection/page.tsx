import Link from "next/link";
import { redirect } from "next/navigation";

import { AppIcon } from "@/app/_components/ui/icon";
import { getCurrentUser } from "@/lib/auth";
import { listInspections } from "@/lib/inspection";
import { listFacilities } from "@/lib/assets";
import { getFacilityScopeId } from "@/lib/facility-scope";
import { canManageFacility } from "@/lib/permissions";
import { hasPermission } from "@/lib/role-permissions";
import NewInspectionForm from "./_components/new-inspection-form";

export default async function InspectionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const canViewInspection = await hasPermission(user.role, "inspection.view");
  if (!canViewInspection) redirect("/dashboard");
  const canMutate = user.role !== "viewer" && (await hasPermission(user.role, "inspection.create"));

  const params = await searchParams;
  const view = canMutate && params["view"] === "new" ? "new" : "list";
  const facilityScopeId = getFacilityScopeId(user);
  if (facilityScopeId === null) redirect("/profile");

  const [inspections, facilities] = await Promise.all([
    listInspections(facilityScopeId),
    listFacilities(facilityScopeId ? { facilityId: facilityScopeId } : undefined),
  ]);
  const facilitiesForForm = facilityScopeId
    ? facilities.filter((facility) => canManageFacility(user, facility.id))
    : facilities;

  return (
    <main className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold" style={{ color: "var(--foreground)" }}>
            <AppIcon name="clipboard-check" className="h-6 w-6 text-[var(--primary)]" /> ตรวจนับทรัพย์สิน
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            บันทึกรอบการตรวจนับสินทรัพย์สารสนเทศประจำหน่วยบริการ
          </p>
        </div>
        {canMutate && view !== "new" && (
          <Link
            href="/inspection?view=new"
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "var(--accent)" }}
          >
            + เริ่มรอบตรวจนับใหม่
          </Link>
        )}
      </div>

      {!canMutate && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          บัญชี Viewer เข้าดูผลการตรวจนับได้ แต่ไม่สามารถเริ่มรอบตรวจนับใหม่
        </div>
      )}

      {/* New form */}
      {view === "new" && (
        <div className="glass-panel rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-4" style={{ color: "var(--foreground)" }}>
            เริ่มรอบตรวจนับใหม่
          </h2>
          <NewInspectionForm facilities={facilitiesForForm} />
        </div>
      )}

      {/* List */}
      {view !== "new" && (
        <div className="glass-panel rounded-2xl overflow-hidden">
          {inspections.length === 0 ? (
            <div className="text-center py-16" style={{ color: "var(--muted)" }}>
	              <AppIcon name="clipboard-check" className="mx-auto mb-3 h-10 w-10 text-[var(--primary)]" />
              <p className="font-semibold">ยังไม่มีรอบการตรวจนับ</p>
              <p className="text-sm mt-1">คลิก &quot;เริ่มรอบตรวจนับใหม่&quot; เพื่อบันทึกครั้งแรก</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
	                <tr style={{ borderBottom: "1px solid var(--line)", background: "var(--neutral-bg)" }}>
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
	                      className="hover:bg-[var(--neutral-bg)] transition-colors"
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
	                          <div className="flex-1 h-2 rounded-full bg-[var(--primary-soft)] overflow-hidden w-20">
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
                        <Link
                          href={"/inspection/" + ins.id}
                          className="text-xs font-semibold"
                          style={{ color: "var(--accent)" }}
                        >
                          ดูรายละเอียด →
                        </Link>
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
