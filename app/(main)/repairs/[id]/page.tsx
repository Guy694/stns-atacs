import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { StatusBadge } from "@/app/_components/ui/status-badge";
import { getRepair, listRepairLogs } from "@/lib/asset-repairs";
import { assetStatusLabel, assetStatusTone } from "@/lib/asset-status";
import { getCurrentUser } from "@/lib/auth";
import { formatThaiDateTime } from "@/lib/date-format";
import { canAccessAssetFacility, canManageAssetRecord, canMutateAssets } from "@/lib/permissions";
import { isOpenRepairStatus, REPAIR_PRIORITY_LABELS, REPAIR_PRIORITY_TONES, REPAIR_STATUS_LABELS, REPAIR_STATUS_TONES } from "@/lib/repair-options";
import { hasPermission } from "@/lib/role-permissions";
import { isMissingSchemaError } from "@/lib/schema-errors";
import { UpdateRepairForm } from "../_components/repair-forms";

type Props = { params: Promise<{ id: string }> };

function Item({ label, value }: { label: string; value?: string | null }) {
  return <div><dt className="text-xs text-[var(--muted)]">{label}</dt><dd className="mt-0.5 whitespace-pre-line text-sm">{value || "-"}</dd></div>;
}

export default async function RepairDetailPage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(await hasPermission(user.role, "repairs.view"))) redirect("/dashboard");
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();

  let repair;
  try {
    repair = await getRepair(id);
  } catch (error) {
    if (isMissingSchemaError(error)) return <p className="mx-auto max-w-2xl py-20 text-center text-amber-700">ยังไม่ได้เปิดใช้งานซ่อมบำรุง (ต้องรัน database/add_asset_lifecycle.sql)</p>;
    throw error;
  }
  if (!repair) notFound();
  if (!canAccessAssetFacility(user, repair.facilityId)) redirect("/repairs");
  const logs = await listRepairLogs(id);
  const canManage = canMutateAssets(user) && canManageAssetRecord(user, repair.facilityId) && (await hasPermission(user.role, "repairs.manage"));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6">
      <div>
        <nav className="mb-3 flex items-center gap-2 text-xs text-[var(--muted)]"><Link href="/repairs" className="hover:text-[var(--foreground)]">งานซ่อมบำรุง</Link><span>/</span><span>#{repair.id}</span></nav>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="section-title text-3xl font-semibold">งานซ่อม #{repair.id}</h1>
          <StatusBadge tone={REPAIR_STATUS_TONES[repair.status]}>{REPAIR_STATUS_LABELS[repair.status]}</StatusBadge>
          <StatusBadge tone={REPAIR_PRIORITY_TONES[repair.priority]}>ความเร่งด่วน: {REPAIR_PRIORITY_LABELS[repair.priority]}</StatusBadge>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(260px,2fr)]">
        <div className="space-y-6">
          <section className="glass-panel rounded-2xl p-6">
            <h2 className="mb-4 font-semibold">รายละเอียด</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><dt className="text-xs text-[var(--muted)]">ทรัพย์สิน</dt><dd className="mt-0.5 text-sm"><Link href={`/assets/${repair.assetId}`} className="font-semibold hover:underline">{repair.assetName}</Link> <span className="font-mono text-xs text-[var(--muted)]">{repair.assetRegistrationNo}</span> <StatusBadge tone={assetStatusTone(repair.assetStatus)}>{assetStatusLabel(repair.assetStatus)}</StatusBadge></dd></div>
              <Item label="หน่วยงาน" value={repair.facilityName} />
              <Item label="แจ้งโดย" value={`${repair.reportedBy} · ${formatThaiDateTime(repair.reportedAt)}`} />
              <div className="sm:col-span-2"><Item label="อาการเสีย / ปัญหา" value={repair.problem} /></div>
              <Item label="ผู้ติดต่อ" value={repair.contact} />
              <Item label="ผู้รับผิดชอบ / ช่าง" value={repair.assignedTo} />
              <Item label="ร้าน / บริษัท" value={repair.vendorName} />
              <Item label="ค่าใช้จ่าย (บาท)" value={repair.cost === null ? null : repair.cost.toLocaleString("th-TH", { minimumFractionDigits: 2 })} />
              <Item label="ผลการตรวจสอบ / สาเหตุ" value={repair.diagnosis} />
              <Item label="ผลการซ่อม" value={repair.resolution} />
              <Item label="เริ่มดำเนินการ" value={repair.startedAt ? formatThaiDateTime(repair.startedAt) : null} />
              <Item label="ปิดงาน" value={repair.completedAt ? formatThaiDateTime(repair.completedAt) : null} />
            </dl>
          </section>
          {canManage && isOpenRepairStatus(repair.status) && (
            <section className="glass-panel rounded-2xl p-6">
              <h2 className="mb-4 font-semibold">อัปเดตงานซ่อม</h2>
              <UpdateRepairForm repair={repair} />
            </section>
          )}
        </div>
        <section className="glass-panel h-fit rounded-2xl p-6">
          <h2 className="mb-4 font-semibold">ไทม์ไลน์</h2>
          <ol className="space-y-4 border-l border-[var(--line)] pl-4">
            {logs.map((log) => (
              <li key={log.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--primary)]" aria-hidden />
                <p className="text-sm font-medium">{log.fromStatus && log.fromStatus !== log.toStatus ? `${REPAIR_STATUS_LABELS[log.fromStatus]} → ` : ""}{REPAIR_STATUS_LABELS[log.toStatus]}</p>
                <p className="text-xs text-[var(--muted)]">{formatThaiDateTime(log.changedAt)} · {log.changedBy || "system"}</p>
                {log.note && <p className="mt-1 whitespace-pre-line text-xs">{log.note}</p>}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
