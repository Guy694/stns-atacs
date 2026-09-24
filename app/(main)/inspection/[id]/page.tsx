import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppIcon } from "@/app/_components/ui/icon";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { updateInspectionItemAction } from "@/app/(main)/inspection/actions";
import { DeleteInspectionButton } from "@/app/(main)/inspection/_components/delete-inspection-button";
import { CommitteeForm } from "@/app/(main)/inspection/_components/committee-form";
import { inspectionDeadline, INSPECTION_REPORT_WORKING_DAYS } from "@/lib/inspection-progress";
import { RoundStatusControl } from "@/app/(main)/inspection/_components/round-status-control";
import { ScanCheckIn } from "@/app/(main)/inspection/_components/scan-check-in";
import { BulkDisposalForm } from "@/app/(main)/inspection/_components/bulk-disposal-form";
import { listDisposalRequests } from "@/lib/asset-disposals";
import { assetStatusLabel, assetStatusTone, isTerminalAssetStatus } from "@/lib/asset-status";
import { getCurrentUser } from "@/lib/auth";
import { formatThaiDate, formatThaiDateTime } from "@/lib/date-format";
import { canAccessFacility } from "@/lib/facility-scope";
import { getInspectionById, getInspectionCommittee, getInspectionItems, type InspectionItem } from "@/lib/inspection";
import { itemOutcome, OUTCOME_LABELS, OUTCOMES, summarizeInspection } from "@/lib/inspection-report";
import { committeeOrderText, foundLocationText, isFoundElsewhere, registeredLocation, filterInspectionItems, inspectionFilterOptions, itemCategory, itemLocation, readInspectionItemFilters, RESULT_OPTIONS } from "@/lib/inspection-sheet";
import { canManageFacility, canMutateAssets } from "@/lib/permissions";
import { listFacilityWorkGroups } from "@/lib/facility-work-groups";
import { hasPermission } from "@/lib/role-permissions";

type InspectionDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const filterControl = "mt-1 min-h-11 w-full min-w-0 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

const ASSET_STATUS_OPTIONS = [
  { value: "Active", label: "พร้อมใช้งาน" },
  { value: "Inactive", label: "ไม่ใช้งาน" },
  { value: "Broken", label: "ชำรุด" },
] as const;
// Loss/disposal are recorded through an approval request, not directly from an inspection.

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

function InspectionItemForm({ item, canMutate, workGroups }: { item: InspectionItem; canMutate: boolean; workGroups: Array<{ id: number; workGroupName: string }> }) {
  const registeredGroupId = item.registeredWorkGroupId ?? item.workGroupId;
  const groups = item.workGroupId && !workGroups.some((group) => group.id === item.workGroupId)
    ? [{ id: item.workGroupId, workGroupName: item.workGroupName || `กลุ่มงาน #${item.workGroupId}` }, ...workGroups]
    : workGroups;
  const defaultInspectionStatus = item.inspectionStatus === "Pending" ? "Found" : item.inspectionStatus;
  const terminal = isTerminalAssetStatus(item.currentStatus);
  const defaultAssetStatus = terminal ? item.currentStatus : (item.assetStatus && !isTerminalAssetStatus(item.assetStatus) ? item.assetStatus : item.currentStatus || "Active");

  if (!canMutate || terminal) {
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
      <form action={updateInspectionItemAction} className="grid min-w-[560px] gap-2 sm:grid-cols-[100px_120px_minmax(140px,1fr)_minmax(140px,1fr)_auto]">
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
        <select
          name="foundWorkGroupId"
          defaultValue={String(item.foundWorkGroupId ?? registeredGroupId ?? "")}
          aria-label="พบที่กลุ่มงาน"
          title="พบที่กลุ่มงาน (ค่าเริ่มต้นตามทะเบียน)"
          className="min-h-10 min-w-0 rounded-xl border border-black/10 bg-white/85 px-3 py-2 text-xs outline-none focus:border-[var(--accent)]"
        >
          <option value="">ไม่ระบุกลุ่มงาน</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>{group.workGroupName}{group.id === item.workGroupId ? " (ทะเบียน)" : ""}</option>
          ))}
        </select>
        <input type="hidden" name="foundLocation" value={item.foundLocation} />
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
      {item.inspectionStatus === "Missing" && (
        <Link href={`/disposal?assetId=${item.assetId}&type=Lost`} className="mt-1 inline-block text-xs font-medium text-rose-700 hover:underline">
          ไม่พบครุภัณฑ์ → เสนอบันทึกสูญหาย
        </Link>
      )}
      {item.checkedAt && (
        <p className="mt-1 text-xs text-[var(--muted)]">
          ตรวจล่าสุด {formatThaiDateTime(item.checkedAt)}{item.checkedBy ? ` โดย ${item.checkedBy}` : ""}
        </p>
      )}
    </td>
  );
}

export default async function InspectionDetailPage({ params, searchParams }: InspectionDetailPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(await hasPermission(user.role, "inspection.view"))) redirect("/dashboard");

  const { id } = await params;
  const inspectionId = Number(id);
  const [inspection, items, committee] = await Promise.all([
    getInspectionById(inspectionId),
    getInspectionItems(inspectionId),
    getInspectionCommittee(inspectionId),
  ]);

  if (!inspection) notFound();
  const facilityWorkGroups = (await listFacilityWorkGroups(inspection.facilityId)).map((group) => ({ id: group.id, workGroupName: group.workGroupName }));
  if (!canAccessFacility(user, inspection.facilityId)) {
    redirect("/inspection");
  }

  const canMutate =
    canMutateAssets(user) &&
    (await hasPermission(user.role, "inspection.create")) &&
    canManageFacility(user, inspection.facilityId);
  const closed = inspection.roundStatus === "Closed";
  const canEditResults = canMutate && !closed;
  const pct = inspection.totalItems > 0
    ? Math.round((inspection.checkedItems / inspection.totalItems) * 100)
    : 0;
  const query = await searchParams;
  const itemFilters = readInspectionItemFilters(query);
  const openDelete = query.delete === "1";
  const filterOptions = inspectionFilterOptions(items);
  const visibleItems = filterInspectionItems(items, itemFilters);
  const activeFilterCount = Object.values(itemFilters).filter(Boolean).length;
  const exportQuery = new URLSearchParams(Object.entries(itemFilters).filter(([, value]) => value));
  const exportHref = `/api/export/inspection/${inspection.id}${exportQuery.size ? `?${exportQuery}` : ""}`;
  const report = summarizeInspection(items.map((item) => ({ ...item, inspectionAssetStatus: item.assetStatus })));
  const canProposeDisposal = canMutate && (await hasPermission(user.role, "disposal.manage"));
  const pendingRequests = canProposeDisposal && report.proposed.length
    ? await listDisposalRequests({ facilityIds: [inspection.facilityId], status: "Pending", limit: 1000 })
    : { rows: [], schemaReady: true };
  const pendingByAsset = new Map(pendingRequests.rows.map((request) => [request.assetId, request.id]));
  const proposalRows = report.proposed
    .filter((item) => item.currentStatus !== "Disposed" && item.currentStatus !== "Lost")
    .map((item) => {
      const outcome = itemOutcome(item) as "broken" | "unused" | "missing";
      return { assetId: item.assetId, number: item.assetNumber || item.assetRegistrationNo, name: item.assetName, outcome, outcomeLabel: OUTCOME_LABELS[outcome], pendingRequestId: pendingByAsset.get(item.assetId) ?? null };
    });
  const deadline = inspectionDeadline({ startDate: inspection.startDate || inspection.inspectedAt, roundStatus: inspection.roundStatus });
  const orderLabel = committeeOrderText(inspection);
  const remaining = items.filter((item) => item.inspectionStatus === "Pending");
  const missing = items.filter((item) => item.inspectionStatus === "Missing");

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">
      <nav className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
        <Link href="/inspection" className="text-[var(--accent)] hover:underline">ตรวจนับทรัพย์สิน</Link>
        <span>/</span>
        <span className="text-[var(--foreground)]">{inspection.roundName}</span>
      </nav>

      <div className="glass-panel rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {closed && <StatusBadge tone="neutral">ปิดรอบแล้ว</StatusBadge>}
              {inspection.remainingItems === 0 ? (
                <StatusBadge tone="success">ตรวจครบแล้ว</StatusBadge>
              ) : (
                <StatusBadge tone="warning">คงเหลือ {inspection.remainingItems.toLocaleString("th-TH")} รายการ</StatusBadge>
              )}
              <StatusBadge tone="neutral">
                {inspection.startDate ? formatThaiDate(inspection.startDate) : "-"} - {inspection.endDate ? formatThaiDate(inspection.endDate) : "-"}
              </StatusBadge>
              {deadline.dueDate && deadline.state !== "closed" && (
                <StatusBadge tone={deadline.state === "overdue" ? "danger" : deadline.state === "due-soon" ? "warning" : "info"}>
                  กำหนดส่งรายงาน {formatThaiDate(deadline.dueDate)} ({deadline.daysLeft < 0 ? `เกิน ${(-deadline.daysLeft).toLocaleString("th-TH")} วัน` : `อีก ${deadline.daysLeft.toLocaleString("th-TH")} วัน`})
                </StatusBadge>
              )}
            </div>
            <h1 className="section-title mt-2 break-words text-2xl font-semibold text-[var(--foreground)]">
              {inspection.roundName}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {inspection.facilityName} · อ.{inspection.districtName}
              {inspection.workGroupName ? <> · <span className="font-medium text-[var(--foreground)]">{inspection.workGroupName}</span></> : " · ทุกกลุ่มงาน"}
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
        {canMutate ? (
          <div className="mt-5 flex flex-col gap-3 border-t border-black/6 pt-4 sm:flex-row sm:items-start sm:justify-between">
            <RoundStatusControl inspectionId={inspection.id} status={inspection.roundStatus} remainingItems={inspection.remainingItems} closedBy={inspection.closedBy} closedAtLabel={inspection.closedAt ? formatThaiDateTime(inspection.closedAt) : ""} />
            {!closed && <DeleteInspectionButton inspectionId={inspection.id} roundName={inspection.roundName} totalItems={inspection.totalItems} checkedItems={inspection.checkedItems} defaultOpen={openDelete} />}
          </div>
        ) : (
          <p className="mt-5 border-t border-black/6 pt-4 text-xs text-[var(--muted)]">
            การยกเลิกและลบรอบตรวจนับทำได้เฉพาะผู้มีสิทธิ์ “สร้างรอบตรวจนับ” ของหน่วยงานนี้
          </p>
        )}
      </div>

      {query.locked === "1" && (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">รอบนี้ปิดแล้ว ผลตรวจไม่ถูกบันทึก เปิดรอบอีกครั้งก่อนแก้ไข</p>
      )}

      {canEditResults && inspection.totalItems > 0 && (
        <ScanCheckIn
          inspectionId={inspection.id}
          workGroups={facilityWorkGroups}
          items={items
            .filter((item) => !isTerminalAssetStatus(item.currentStatus))
            .map((item) => ({ itemId: item.id, assetId: item.assetId, number: item.assetNumber, name: item.assetName, status: item.inspectionStatus, currentStatus: item.currentStatus }))}
        />
      )}

      <section className="glass-panel overflow-hidden rounded-2xl" aria-labelledby="report-heading">
        <div className="flex flex-col gap-3 border-b border-black/6 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="report-heading" className="font-semibold text-[var(--foreground)]">รายงานผลการตรวจสอบพัสดุ</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {closed ? "ข้อมูล ณ เวลาปิดรอบ" : "ฉบับร่าง — ปิดรอบก่อนพิมพ์รายงานฉบับจริง"} · สรุปตามประเภทและผลตรวจ พร้อมรายการที่เสนอจำหน่าย/สอบข้อเท็จจริง และช่องลงนามคณะกรรมการ{report.moved.length ? <span className="font-semibold text-amber-800"> · พบต่างจากกลุ่มงาน/ที่ตั้งในทะเบียน {report.moved.length.toLocaleString("th-TH")} รายการ</span> : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`/api/export/inspection/${inspection.id}?type=report`} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-[var(--primary-soft-strong)] bg-[var(--primary-soft)] px-4 text-sm font-semibold text-[var(--primary-text)] hover:bg-[var(--primary-soft-strong)]">
              <AppIcon name="download" className="h-4 w-4" /> รายงานผล Excel{closed ? "" : " (ร่าง)"}
            </a>
            {/* ใบตรวจสอบพัสดุประจำปี (A4 แนวนอน) พร้อมช่องลงนามจากคณะกรรมการของรอบนี้ */}
            <a
              href={`/print/assets/audit?facility=${inspection.facilityId}${inspection.workGroupId ? `&workGroup=${inspection.workGroupId}` : ""}&inspection=${inspection.id}`}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--primary-soft)]"
            >
              <AppIcon name="printer" className="h-4 w-4" /> ใบตรวจสอบพัสดุประจำปี (PDF)
            </a>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-stone-50/60 text-xs text-[var(--muted)]">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-left font-medium">ประเภทครุภัณฑ์</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">จำนวน</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">มูลค่า (บาท)</th>
                {OUTCOMES.map((outcome) => <th key={outcome} scope="col" className="px-3 py-2.5 text-right font-medium">{OUTCOME_LABELS[outcome]}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/4">
              {[...report.rows, report.totals].map((row) => (
                <tr key={row.key} className={row.key === "total" ? "font-semibold" : undefined}>
                  <th scope="row" className="px-4 py-2 text-left font-medium">{row.label}</th>
                  <td className="px-3 py-2 text-right tabular-nums">{row.total.toLocaleString("th-TH")}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.value.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                  {OUTCOMES.map((outcome) => (
                    <td key={outcome} className={`px-3 py-2 text-right tabular-nums ${row.counts[outcome] && (outcome === "broken" || outcome === "missing") ? "text-rose-700" : ""}`}>{row.counts[outcome].toLocaleString("th-TH")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {canProposeDisposal && proposalRows.length > 0 && (
        <section className="glass-panel rounded-2xl p-5" aria-labelledby="bulk-disposal-heading">
          <h2 id="bulk-disposal-heading" className="font-semibold text-[var(--foreground)]">เสนอจำหน่าย / สูญหายจากผลตรวจ</h2>
          <p className="mb-3 mt-1 text-xs text-[var(--muted)]">รายการที่ตรวจพบว่าชำรุด เสื่อมสภาพ/ไม่ใช้งาน หรือไม่พบ เลือกแล้วสร้างคำขอได้ในครั้งเดียว (1 คำขอต่อรายการ)</p>
          {pendingRequests.schemaReady
            ? <BulkDisposalForm inspectionId={inspection.id} roundName={inspection.roundName} rows={proposalRows} />
            : <p className="text-sm text-amber-700">ยังไม่ได้เปิดใช้คำขอจำหน่าย (ต้องรัน database/add_asset_lifecycle.sql)</p>}
        </section>
      )}

      <section className="glass-panel rounded-2xl p-5" aria-labelledby="committee-heading">
        <h2 id="committee-heading" className="mb-1 font-semibold text-[var(--foreground)]">คณะกรรมการตรวจนับ</h2>
        <p className="mb-3 text-xs text-[var(--muted)]">พิมพ์เป็นช่องลงนามท้ายใบตรวจนับและรายงานผล · คณะกรรมการรายงานผลต่อหัวหน้าหน่วยงานภายใน {INSPECTION_REPORT_WORKING_DAYS} วันทำการนับจากวันเริ่มตรวจ (ระบบนับเฉพาะวันจันทร์–ศุกร์ ไม่รวมวันหยุดราชการ)</p>
        {committee.schemaReady
          ? <CommitteeForm inspectionId={inspection.id} members={committee.members} canEdit={canEditResults} orderNo={inspection.committeeOrderNo} orderDate={inspection.committeeOrderDate} orderLabel={orderLabel} />
          : <p className="text-sm text-amber-700">ยังไม่ได้เปิดใช้ (ต้องรัน database/add_asset_codes_and_inspection_committee.sql)</p>}
      </section>

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
                {item.assetNumber || item.assetName}
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
                <p className="mt-0.5 font-mono text-xs text-rose-500">{item.assetNumber || "-"}</p>
                {item.conditionNote && <p className="mt-1 text-xs text-rose-700">{item.conditionNote}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div id="items" className="glass-panel overflow-hidden rounded-2xl">
        <div className="flex flex-col gap-3 border-b border-black/6 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-semibold text-[var(--foreground)]">
              รายการครุภัณฑ์ในรอบตรวจ ({activeFilterCount ? `${visibleItems.length.toLocaleString("th-TH")} จาก ` : ""}{items.length.toLocaleString("th-TH")})
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              บันทึกผลตรวจรายรายการ และเลือกสถานะครุภัณฑ์ล่าสุดเพื่ออัปเดตข้อมูลอุปกรณ์
            </p>
          </div>
          <a href={exportHref} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)]">
            <AppIcon name="download" className="h-4 w-4" /> ใบตรวจนับ Excel{activeFilterCount ? " (ตามตัวกรอง)" : ""}
          </a>
        </div>
        <form method="GET" action="#items" className="grid gap-3 border-b border-black/6 bg-white/60 px-4 py-4 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto] lg:items-end" aria-label="กรองรายการในรอบตรวจ">
          <label className="min-w-0 text-xs font-medium">ประเภทครุภัณฑ์
            <select name="category" defaultValue={itemFilters.category} className={filterControl}>
              <option value="">ทุกประเภท</option>
              {filterOptions.categories.map((option) => <option key={option.key} value={option.key}>{option.label} ({option.count})</option>)}
            </select>
          </label>
          <label className="min-w-0 text-xs font-medium">ใช้ประจำที่ (กลุ่มงาน)
            <select name="location" defaultValue={itemFilters.location} className={filterControl}>
              <option value="">ทุกกลุ่มงาน</option>
              {filterOptions.locations.map((option) => <option key={option.value} value={option.value}>{option.label} ({option.count})</option>)}
            </select>
          </label>
          <label className="min-w-0 text-xs font-medium">ผลตรวจ
            <select name="result" defaultValue={itemFilters.result} className={filterControl}>
              <option value="">ทุกผลตรวจ</option>
              {RESULT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <div className="flex min-h-9 items-center gap-3">
            <button type="submit" className="min-h-9 rounded-lg bg-[var(--accent-strong)] px-4 text-xs font-semibold text-white hover:opacity-90">กรอง</button>
            {activeFilterCount > 0 && <Link href={`/inspection/${inspection.id}#items`} className="text-xs text-[var(--primary-text)] underline underline-offset-4">ล้าง</Link>}
          </div>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead>
              <tr className="border-b border-black/6 bg-stone-50/60 text-xs text-[var(--muted)]">
                <th className="px-4 py-3 text-left font-medium">ทะเบียน</th>
                <th className="px-4 py-3 text-left font-medium">ชื่อครุภัณฑ์</th>
                <th className="px-4 py-3 text-left font-medium">ประเภท / ใช้ประจำที่</th>
                <th className="px-4 py-3 text-left font-medium">ผลตรวจ / อัปเดตสถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/4">
              {visibleItems.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-[var(--muted)]">ไม่มีรายการตามตัวกรอง</td></tr>
              )}
              {visibleItems.map((item) => (
                <tr key={item.id} className={item.inspectionStatus === "Pending" ? "bg-amber-50/35" : "hover:bg-white/50"}>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">
                    {item.assetNumber || "-"}
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
                    <p className="text-[var(--foreground)]">{itemCategory(item).label}</p>
                    <p className="mt-0.5">{isFoundElsewhere(item) ? <>ทะเบียน: {registeredLocation(item)}</> : itemLocation(item)}</p>
                    {isFoundElsewhere(item) && <p className="mt-0.5 font-semibold text-amber-800">พบที่: {foundLocationText(item)}</p>}
                  </td>
                  <InspectionItemForm item={item} canMutate={canEditResults} workGroups={facilityWorkGroups} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
