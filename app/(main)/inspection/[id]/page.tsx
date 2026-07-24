import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppIcon } from "@/app/_components/ui/icon";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { updateInspectionItemAction } from "@/app/(main)/inspection/actions";
import { assetStatusLabel, assetStatusTone } from "@/lib/asset-status";
import { getCurrentUser } from "@/lib/auth";
import { formatThaiDate, formatThaiDateTime } from "@/lib/date-format";
import { canAccessFacility } from "@/lib/facility-scope";
import { getInspectionById, getInspectionItems, type InspectionItem } from "@/lib/inspection";
import { canManageFacility, canMutateAssets } from "@/lib/permissions";
import { hasPermission } from "@/lib/role-permissions";

type InspectionDetailPageProps = {
  params: Promise<{ id: string }>;
};

const ASSET_STATUS_OPTIONS = [
  { value: "Active", label: "พร้อมใช้งาน" },
  { value: "Inactive", label: "ไม่ใช้งาน" },
  { value: "Broken", label: "ชำรุด" },
  { value: "Lost", label: "สูญหาย" },
  { value: "Disposed", label: "จำหน่ายแล้ว" },
] as const;

function inspectionStatusLabel(status: InspectionItem["inspectionStatus"]) {
  if (status === "Found") return "พบ";
  if (status === "Missing") return "ไม่พบ";
  return "รอตรวจ";
}

function inspectionStatusTone(status: InspectionItem["inspectionStatus"]) {
  if (status === "Found") return "success";
  if (status === "Missing") return "danger";
  return "warning";
}

function InspectionItemForm({ item, canMutate }: { item: InspectionItem; canMutate: boolean }) {
  const defaultInspectionStatus = item.inspectionStatus === "Pending" ? "Found" : item.inspectionStatus;
  const defaultAssetStatus = item.assetStatus || item.currentStatus || "Active";

  if (!canMutate) {
    return (
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={inspectionStatusTone(item.inspectionStatus)}>
            {inspectionStatusLabel(item.inspectionStatus)}
          </StatusBadge>
          <StatusBadge tone={assetStatusTone(defaultAssetStatus)}>
            {assetStatusLabel(defaultAssetStatus)}
          </StatusBadge>
        </div>
        {item.conditionNote && <p className="mt-1 text-xs text-[var(--muted)]">{item.conditionNote}</p>}
      </td>
    );
  }

  return (
    <td className="px-4 py-3">
      <form action={updateInspectionItemAction} className="grid min-w-[420px] gap-2 sm:grid-cols-[110px_130px_minmax(160px,1fr)_auto]">
        <input type="hidden" name="itemId" value={item.id} />
        <select
          name="inspectionStatus"
          defaultValue={defaultInspectionStatus}
          className="min-h-10 rounded-xl border border-black/10 bg-white/85 px-3 py-2 text-xs outline-none focus:border-[var(--accent)]"
        >
          <option value="Found">พบ</option>
          <option value="Missing">ไม่พบ</option>
        </select>
        <select
          name="assetStatus"
          defaultValue={defaultAssetStatus}
          className="min-h-10 rounded-xl border border-black/10 bg-white/85 px-3 py-2 text-xs outline-none focus:border-[var(--accent)]"
        >
          {ASSET_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <input
          name="conditionNote"
          defaultValue={item.conditionNote}
          placeholder="หมายเหตุ / สภาพครุภัณฑ์"
          className="min-h-10 min-w-0 rounded-xl border border-black/10 bg-white/85 px-3 py-2 text-xs outline-none focus:border-[var(--accent)]"
        />
        <button
          type="submit"
          className="min-h-10 rounded-xl bg-[var(--accent-strong)] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90"
        >
          บันทึก
        </button>
      </form>
      {item.checkedAt && (
        <p className="mt-1 text-xs text-[var(--muted)]">
          ตรวจล่าสุด {formatThaiDateTime(item.checkedAt)}{item.checkedBy ? ` โดย ${item.checkedBy}` : ""}
        </p>
      )}
    </td>
  );
}

export default async function InspectionDetailPage({ params }: InspectionDetailPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(await hasPermission(user.role, "inspection.view"))) redirect("/dashboard");

  const { id } = await params;
  const inspectionId = Number(id);
  const [inspection, items] = await Promise.all([
    getInspectionById(inspectionId),
    getInspectionItems(inspectionId),
  ]);

  if (!inspection) notFound();
  if (!canAccessFacility(user, inspection.facilityId)) {
    redirect("/inspection");
  }

  const canMutate =
    canMutateAssets(user) &&
    (await hasPermission(user.role, "inspection.create")) &&
    canManageFacility(user, inspection.facilityId);
  const pct = inspection.totalItems > 0
    ? Math.round((inspection.checkedItems / inspection.totalItems) * 100)
    : 0;
  const remaining = items.filter((item) => item.inspectionStatus === "Pending");
  const missing = items.filter((item) => item.inspectionStatus === "Missing");

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-6">
      <nav className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
        <Link href="/inspection" className="text-[var(--accent)] hover:underline">ตรวจนับทรัพย์สิน</Link>
        <span>/</span>
        <span className="text-[var(--foreground)]">{inspection.roundName}</span>
      </nav>

      <div className="glass-panel rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {inspection.remainingItems === 0 ? (
                <StatusBadge tone="success">ตรวจครบแล้ว</StatusBadge>
              ) : (
                <StatusBadge tone="warning">คงเหลือ {inspection.remainingItems.toLocaleString("th-TH")} รายการ</StatusBadge>
              )}
              <StatusBadge tone="neutral">
                {inspection.startDate ? formatThaiDate(inspection.startDate) : "-"} - {inspection.endDate ? formatThaiDate(inspection.endDate) : "-"}
              </StatusBadge>
            </div>
            <h1 className="section-title mt-2 break-words text-2xl font-semibold text-[var(--foreground)]">
              {inspection.roundName}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {inspection.facilityName} · อ.{inspection.districtName}
            </p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              เปิดรอบโดย {inspection.inspectedBy} · {formatThaiDate(inspection.inspectedAt)}
            </p>
            {inspection.note && (
              <p className="mt-3 flex max-w-3xl items-start gap-2 rounded-xl bg-[var(--primary-soft)] px-3 py-2 text-sm text-[var(--foreground)]">
                <AppIcon name="file-text" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" /> {inspection.note}
              </p>
            )}
          </div>

          <div className="grid min-w-[260px] grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
            {[
              { label: "ตรวจแล้ว", value: inspection.checkedItems, tone: "text-[var(--accent-strong)]" },
              { label: "คงเหลือ", value: inspection.remainingItems, tone: "text-amber-700" },
              { label: "พบ", value: inspection.foundItems, tone: "text-[var(--accent-strong)]" },
              { label: "ไม่พบ", value: inspection.missingItems, tone: "text-rose-600" },
            ].map((metric) => (
              <div key={metric.label} className="rounded-xl border border-black/10 bg-white/70 px-3 py-2">
                <p className="text-xs text-[var(--muted)]">{metric.label}</p>
                <p className={`mt-1 text-xl font-semibold ${metric.tone}`}>{metric.value.toLocaleString("th-TH")}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <div className="h-2 overflow-hidden rounded-full bg-[var(--primary-soft)]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-[width]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">ความคืบหน้า {pct}% จากรายการทั้งหมด {inspection.totalItems.toLocaleString("th-TH")} รายการ</p>
        </div>
      </div>

      {remaining.length > 0 && (
        <div className="glass-panel rounded-2xl p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--foreground)]">
            <AppIcon name="activity" className="h-4 w-4 text-amber-600" /> รายการคงเหลือ ({remaining.length.toLocaleString("th-TH")})
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {remaining.slice(0, 24).map((item) => (
              <Link
                key={item.id}
                href={`/assets/${item.assetId}`}
                className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
              >
                {item.assetRegistrationNo || item.assetName}
              </Link>
            ))}
            {remaining.length > 24 && (
              <span className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-xs text-[var(--muted)]">
                +{(remaining.length - 24).toLocaleString("th-TH")} รายการ
              </span>
            )}
          </div>
        </div>
      )}

      {missing.length > 0 && (
        <div className="glass-panel rounded-2xl p-5">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-rose-700">
            <AppIcon name="activity" className="h-4 w-4" /> รายการที่ไม่พบ ({missing.length.toLocaleString("th-TH")})
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {missing.map((item) => (
              <div key={item.id} className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2">
                <p className="font-medium text-sm text-rose-800">{item.assetName}</p>
                <p className="mt-0.5 font-mono text-xs text-rose-500">{item.assetRegistrationNo || "-"}</p>
                {item.conditionNote && <p className="mt-1 text-xs text-rose-700">{item.conditionNote}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass-panel overflow-hidden rounded-2xl">
        <div className="border-b border-black/6 px-5 py-4">
          <h2 className="font-semibold text-[var(--foreground)]">
            รายการครุภัณฑ์ในรอบตรวจ ({items.length.toLocaleString("th-TH")})
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            บันทึกผลตรวจรายรายการ และเลือกสถานะครุภัณฑ์ล่าสุดเพื่ออัปเดตข้อมูลอุปกรณ์
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead>
              <tr className="border-b border-black/6 bg-stone-50/60 text-xs text-[var(--muted)]">
                <th className="px-4 py-3 text-left font-medium">ทะเบียน</th>
                <th className="px-4 py-3 text-left font-medium">ชื่อครุภัณฑ์</th>
                <th className="px-4 py-3 text-left font-medium">ประเภท</th>
                <th className="px-4 py-3 text-left font-medium">ผลตรวจ / อัปเดตสถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/4">
              {items.map((item) => (
                <tr key={item.id} className={item.inspectionStatus === "Pending" ? "bg-amber-50/35" : "hover:bg-white/50"}>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">
                    {item.assetRegistrationNo || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/assets/${item.assetId}`} className="font-medium text-[var(--accent)] hover:underline">
                      {item.assetName}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <StatusBadge tone={inspectionStatusTone(item.inspectionStatus)}>
                        {inspectionStatusLabel(item.inspectionStatus)}
                      </StatusBadge>
                      <StatusBadge tone={assetStatusTone(item.currentStatus)}>
                        ปัจจุบัน {assetStatusLabel(item.currentStatus)}
                      </StatusBadge>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--muted)]">
                    {item.deviceType || "-"}
                  </td>
                  <InspectionItemForm item={item} canMutate={canMutate} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
