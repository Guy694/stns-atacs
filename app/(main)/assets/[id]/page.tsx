import { ASSET_DETAIL_FIELDS } from "@/lib/asset-details";
import { listLoans } from "@/lib/asset-loans";
import { findSerialTwins } from "@/lib/data-quality-db";
import { acquisitionMethodLabel, fundingSourceLabel } from "@/lib/acquisition-options";
import { isItAsset, supportsAgentAsset } from "@/lib/asset-policy";
import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AppIcon } from "@/app/_components/ui/icon";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { assetClassLabel } from "@/lib/asset-classes";
import { assetStatusLabel, assetStatusTone } from "@/lib/asset-status";
import { getCurrentUser } from "@/lib/auth";
import { getAssetById, listAllFacilitiesForSelect } from "@/lib/assets";
import { listFacilityWorkGroups } from "@/lib/facility-work-groups";
import { listActiveDeviceTypes } from "@/lib/device-types";
import { AssetFormModal } from "@/app/(main)/assets/_components/asset-form-modal";
import { DeleteAssetButton } from "@/app/(main)/assets/_components/delete-asset-button";
import { QrDownloadButton } from "@/app/(main)/assets/_components/print-button";
import { getAgentDeviceByLinkedAssetId, type AgentDevice } from "@/lib/agent";
import { listAssetStatusHistory } from "@/lib/asset-status-history";
import { canAccessAssetFacility, canManageAssetRecord, canManageFacility, canSeeSensitiveAssetNetwork } from "@/lib/permissions";
import { formatThaiDate, formatThaiDateTime } from "@/lib/date-format";
import { hasPermission } from "@/lib/role-permissions";
import { windowsLicenseStatusLabel } from "@/lib/windows-license";
import { listDisposalRequests } from "@/lib/asset-disposals";
import { listRepairs } from "@/lib/asset-repairs";
import { isTerminalAssetStatus } from "@/lib/asset-status";
import { listAssetTransfers } from "@/lib/asset-transfers";
import { depreciationSchedule, fiscalYearOf, valueAsset } from "@/lib/asset-valuation";
import { DISPOSAL_REQUEST_TYPE_LABELS } from "@/lib/disposal-options";
import { DisposalHistorySection, RepairHistorySection, TransferHistorySection, ValuationSection } from "./_components/lifecycle-sections";
import { InspectionCheckIn } from "./_components/inspection-check-in";
import { listOpenInspectionsForAsset } from "@/lib/inspection";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 break-words text-sm font-medium text-[var(--foreground)]">{value || "–"}</p>
    </div>
  );
}

function AssetImageGallery({ images, assetName }: { images: string[]; assetName: string }) {
  if (images.length === 0) {
    return (
      <div className="mb-4 flex min-h-36 items-center justify-center rounded-xl border border-dashed border-black/15 bg-[var(--neutral-bg)] px-4 py-6 text-center text-sm text-[var(--muted)]">
        ยังไม่มีรูปภาพทรัพย์สิน
      </div>
    );
  }

  return (
    <div className={`mb-5 grid gap-3 ${images.length === 1 ? "sm:grid-cols-1" : "sm:grid-cols-2"}`}>
      {images.map((src, index) => (
        <div key={src} className="relative aspect-[4/3] min-h-44 overflow-hidden rounded-xl border border-black/10 bg-[var(--neutral-bg)]">
          <Image
            src={src}
            alt={`${assetName} ภาพที่ ${index + 1}`}
            fill
            sizes={images.length === 1 ? "(max-width: 1024px) 100vw, 720px" : "(max-width: 640px) 100vw, 360px"}
            // Served by an authenticated route; the optimizer's internal fetch has no session cookie.
            unoptimized
            className="object-cover"
          />
        </div>
      ))}
    </div>
  );
}

function sanitizeDownloadName(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 100);
}

function formatRam(mb?: number | null) {
  if (!mb || !Number.isFinite(mb)) return "–";
  if (mb >= 1024) {
    return `${(mb / 1024).toLocaleString("th-TH", { maximumFractionDigits: 1 })} GB`;
  }
  return `${mb.toLocaleString("th-TH")} MB`;
}

function formatStorage(gb?: number | null) {
  if (gb === null || gb === undefined || !Number.isFinite(gb)) return "–";
  return `${gb.toLocaleString("th-TH")} GB`;
}

function ComputerSpecPanel({ device }: { device: AgentDevice | null }) {
  if (!device) {
    return (
      <div className="mb-5 rounded-xl border border-[var(--state-info-border)] bg-[var(--state-info-bg)] px-4 py-3 text-sm text-[var(--state-info-fg)]">
        ยังไม่มีข้อมูล RAM/Storage จาก Agent สำหรับอุปกรณ์คอมพิวเตอร์นี้
      </div>
    );
  }

  const storageTotal = device.diskTotalGb;
  const storageUsed = device.diskUsedGb;
  const storageFree = device.diskFreeGb;
  const hasSpec =
    device.ramMb !== null ||
    storageTotal !== null ||
    storageUsed !== null ||
    storageFree !== null ||
    device.cpuModel;

  if (!hasSpec) return null;

  return (
    <div className="mb-5 rounded-xl border border-[var(--primary-soft-strong)] bg-[var(--primary-soft)]/55 p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--primary-text)]">สเปคคอมพิวเตอร์จาก Agent</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            รายงานล่าสุด {device.lastReportedAt ?? device.lastSeenAt ?? "–"}
          </p>
        </div>
        <StatusBadge tone={device.status === "offline" ? "danger" : "success"}>
          {device.status === "offline" ? "offline" : "online"}
        </StatusBadge>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="RAM" value={formatRam(device.ramMb)} />
        <Field label="Storage รวม" value={formatStorage(storageTotal)} />
        <Field label="Storage ใช้ไป" value={formatStorage(storageUsed)} />
        <Field label="Storage คงเหลือ" value={formatStorage(storageFree)} />
      </div>
      {device.cpuModel && (
        <div className="mt-3">
          <Field label="CPU" value={device.cpuModel} />
        </div>
      )}
    </div>
  );
}

export default async function AssetDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const numId = Number(id);
  if (isNaN(numId)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [asset, facilitiesForSelect, statusHistory, workGroups, deviceTypes, agentDevice] = await Promise.all([
    getAssetById(numId),
    listAllFacilitiesForSelect(),
    listAssetStatusHistory(numId),
    listFacilityWorkGroups(),
    listActiveDeviceTypes(),
    getAgentDeviceByLinkedAssetId(numId),
  ]);
  if (!asset) notFound();
  if (!canAccessAssetFacility(user, asset.facilityId)) {
    redirect(user.facilityId ? "/facilities" : "/profile");
  }
  const isIt = isItAsset(asset);
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const assetScanUrl = host ? `${protocol}://${host}/scan/assets/${asset.id}` : `/scan/assets/${asset.id}`;

  const canMutateThisAsset = (await hasPermission(user.role, "assets.update")) && canManageAssetRecord(user, asset.facilityId);
  const canDeleteThisAsset = (await hasPermission(user.role, "assets.delete")) && canManageAssetRecord(user, asset.facilityId);
  const canViewNetwork = (await hasPermission(user.role, "assets.network.view")) && canSeeSensitiveAssetNetwork(user, asset.facilityId);
  const [canViewRepairs, canManageRepairs, canTransfer, canDispose] = await Promise.all([
    hasPermission(user.role, "repairs.view"),
    hasPermission(user.role, "repairs.manage"),
    hasPermission(user.role, "transfer.manage"),
    hasPermission(user.role, "disposal.manage"),
  ]);
  const [transfers, repairs, disposals] = await Promise.all([
    listAssetTransfers(asset.id),
    canViewRepairs ? listRepairs({ assetId: asset.id, limit: 100 }) : Promise.resolve({ rows: [], schemaReady: true }),
    listDisposalRequests({ assetId: asset.id, limit: 50 }),
  ]);
  const terminal = isTerminalAssetStatus(asset.currentStatus);
  const canInspect = !terminal && canManageFacility(user, asset.facilityId) && user.role !== "viewer" && (await hasPermission(user.role, "inspection.create"));
  const openRounds = canInspect ? await listOpenInspectionsForAsset(asset.id) : [];
  const checkedParam = Number((await searchParams)?.checked);
  const serialTwins = asset.serialNumber ? await findSerialTwins(asset.id, asset.serialNumber) : [];
  const [canViewLoans, canManageLoans] = await Promise.all([hasPermission(user.role, "loans.view"), hasPermission(user.role, "loans.manage")]);
  const activeLoan = canViewLoans ? (await listLoans({ assetId: asset.id, status: "OnLoan", limit: 1 })).rows[0] : undefined;
  const pendingDisposal = disposals.rows.find((row) => row.status === "Pending");
  const openRepair = repairs.rows.find((row) => row.status === "Reported" || row.status === "InProgress" || row.status === "SentToVendor");
  const today = new Date().toISOString().slice(0, 10);
  const valuationInput = { ...asset, subtypeName: asset.extensions[asset.assetClass]?.subtypeName };
  const valuation = valueAsset(valuationInput, today);
  const schedule = depreciationSchedule(valuationInput);

  const maStart = asset.maintenanceEndDate
    ? (() => {
        const d = new Date(asset.maintenanceEndDate);
        return isNaN(d.getTime()) ? null : d;
      })()
    : null;

  const now = new Date();

  const daysLeft = maStart
    ? Math.ceil((maStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6">

      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
        <Link href="/dashboard" className="hover:text-[var(--foreground)]">หน้าหลัก</Link>
        <span>/</span>
        {user.role === "officer" ? (
          <Link href={`/facilities/${asset.facilityId}`} className="hover:text-[var(--foreground)]">รายการทรัพย์สิน</Link>
        ) : (
          <Link href="/assets" className="hover:text-[var(--foreground)]">ทรัพย์สินทั้งหมด</Link>
        )}
        <span>/</span>
        <span className="text-[var(--foreground)]">{asset.assetNumber}</span>
      </nav>

      {activeLoan && (
        <div role="note" className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          ถูกยืมอยู่โดย <b>{activeLoan.borrowerName}</b>{activeLoan.borrowerUnit ? ` (${activeLoan.borrowerUnit})` : ""} ตั้งแต่ {formatThaiDate(activeLoan.loanedOn)} กำหนดคืน {formatThaiDate(activeLoan.dueOn)}
          {activeLoan.dueOn < today ? <span className="ml-1 font-semibold text-rose-700">· เกินกำหนดคืน</span> : null}
          {" "}<Link href="/loans" className="font-medium underline">ไปที่ยืม-คืน</Link>
        </div>
      )}

      {serialTwins.length > 0 && (
        <div role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Serial Number <span className="font-mono">{asset.serialNumber}</span> ซ้ำกับครุภัณฑ์อื่นในทะเบียน อาจเป็นรายการเดียวกันที่ลงทะเบียนซ้ำ:{" "}
          {serialTwins.map((twin, index) => (
            <span key={twin.id}>{index ? ", " : ""}<Link href={`/assets/${twin.id}`} className="font-medium underline">{twin.assetName}</Link> ({twin.facilityName})</span>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={assetStatusTone(asset.currentStatus)}>
              {assetStatusLabel(asset.currentStatus)}
            </StatusBadge>
            <StatusBadge tone="primary">
              {assetClassLabel(asset.assetClass)}
            </StatusBadge>
            {isIt && <StatusBadge tone="neutral">{asset.assetGroup}</StatusBadge>}
            {isIt && asset.deviceType && (
              <StatusBadge tone="neutral">{asset.deviceType}</StatusBadge>
            )}
          </div>
          <h1 className="section-title mt-2 break-words text-2xl font-semibold leading-tight sm:text-3xl">{asset.assetName}</h1>
          <p className="mt-1 break-all font-mono text-sm text-[var(--muted)]">{asset.assetNumber}</p>
          <Link href={`/print/assets/${asset.id}`} className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-3 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--primary-soft)]">
            <AppIcon name="printer" className="h-3.5 w-3.5" /> พิมพ์ทะเบียนคุมทรัพย์สิน
          </Link>{" "}
          <Link href={`/print/stickers?ids=${asset.id}&size=mini`} className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-3 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--primary-soft)]">
            <AppIcon name="printer" className="h-3.5 w-3.5" /> พิมพ์สติ๊กเกอร์ QR (A4)
          </Link>
        </div>
        {canMutateThisAsset && (
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <AssetFormModal
              facilities={user.role === "admin" ? facilitiesForSelect : facilitiesForSelect.filter((facility) => facility.id === asset.facilityId)}
              deviceTypes={deviceTypes}
              workGroups={user.role === "admin" ? workGroups : workGroups.filter((group) => group.facilityId === asset.facilityId)}
              updaterName={user.fullName}
              mode="edit"
              asset={asset}
            >
              <span className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--primary-soft-strong)] bg-[var(--primary-soft)] px-4 py-2 text-sm font-medium text-[var(--primary-text)] transition hover:bg-[var(--primary-soft-strong)]">
                แก้ไข
              </span>
            </AssetFormModal>
            {canDeleteThisAsset && <DeleteAssetButton assetId={asset.id} assetName={asset.assetName} />}
          </div>
        )}
      </div>

      {openRounds.length > 0 && (
        <InspectionCheckIn
          assetId={asset.id}
          rounds={openRounds}
          justChecked={Number.isFinite(checkedParam) ? checkedParam : undefined}
          placement={{
            facilityName: asset.facilityName,
            workGroupId: asset.workGroupId,
            workGroupName: asset.workGroupName ?? "",
            locationDetail: asset.locationDetail,
            workGroups: workGroups.filter((group) => group.facilityId === asset.facilityId).map((group) => ({ id: group.id, workGroupName: group.workGroupName })),
          }}
        />
      )}

      {(pendingDisposal || openRepair) && (
        <div className="flex flex-col gap-2">
          {pendingDisposal && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              มีคำขอ{DISPOSAL_REQUEST_TYPE_LABELS[pendingDisposal.requestType]}รออนุมัติ{" "}
              <Link href={`/disposal?requestId=${pendingDisposal.id}`} className="font-semibold underline">#{pendingDisposal.id}</Link>
            </p>
          )}
          {openRepair && (
            <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
              อยู่ระหว่างงานซ่อม <Link href={`/repairs/${openRepair.id}`} className="font-semibold underline">#{openRepair.id}</Link>
            </p>
          )}
        </div>
      )}

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">

        {/* Main details */}
        <div className="min-w-0 space-y-4">

          {/* ข้อมูลหน่วยงาน */}
          <div className="glass-panel rounded-2xl p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">ข้อมูลหน่วยงาน</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="หน่วยงาน" value={asset.facilityName} />
              <Field label="อำเภอ" value={asset.districtName} />
              <Field label="ผู้รับผิดชอบ / ผู้ใช้งาน" value={asset.ownerName} />
              <Field label="ตำแหน่งติดตั้ง" value={asset.locationDetail} />
              <Field label="วัตถุประสงค์การใช้งาน" value={asset.usageDescription} />
            </div>
          </div>

          {/* ข้อมูลทรัพย์สิน */}
          <div className="glass-panel rounded-2xl p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">ข้อมูลทรัพย์สิน</h2>
            <AssetImageGallery images={asset.assetImages} assetName={asset.assetName} />
            {supportsAgentAsset(asset) && <ComputerSpecPanel device={agentDevice} />}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="กลุ่มครุภัณฑ์" value={assetClassLabel(asset.assetClass)} />
              {isIt && <Field label="ลักษณะทรัพย์สิน IT" value={asset.assetGroup} />}
              {isIt && <Field label="ประเภทอุปกรณ์ IT" value={asset.deviceType} />}
              <Field label="ยี่ห้อ (Brand)" value={asset.manufacturerBrand} />
              <Field label="รุ่น" value={asset.manufacturerModel} />
              <Field label="รายละเอียด / คุณลักษณะ" value={asset.manufacturerSpecification} />
              <Field label="Serial Number" value={asset.serialNumber} />
              {isIt && <Field label="ระบบปฏิบัติการ" value={asset.operatingSystem} />}
              {isIt && asset.windowsLicenseStatus && (
                <Field label="สถานะลิขสิทธิ์ Windows" value={windowsLicenseStatusLabel(asset.windowsLicenseStatus)} />
              )}
              {isIt && <Field label="Private IP" value={canViewNetwork ? (asset.privateIp || "–") : "ซ่อนข้อมูล"} />}
              {isIt && <Field label="Public IP" value={canViewNetwork ? (asset.publicIp || "–") : "ซ่อนข้อมูล"} />}
            </div>
          </div>

          {/* สัญญา MA */}
          <div className="glass-panel rounded-2xl p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">สัญญาบำรุงรักษา (MA)</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="วันเริ่มต้น MA" value={formatThaiDate(asset.maintenanceStartDate)} />
              <Field label="วันสิ้นสุด MA" value={formatThaiDate(asset.maintenanceEndDate)} />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--muted)]">สถานะ MA</p>
                <div className="mt-1">
                  {daysLeft === null ? (
                    <span className="text-sm text-[var(--muted)]">ไม่มีข้อมูล</span>
                  ) : daysLeft < 0 ? (
                    <StatusBadge tone="danger">หมดอายุแล้ว</StatusBadge>
                  ) : daysLeft <= 30 ? (
                    <StatusBadge tone="warning">ใกล้หมดอายุ ({daysLeft} วัน)</StatusBadge>
                  ) : (
                    <StatusBadge tone="success">ยังใช้ได้ ({daysLeft} วัน)</StatusBadge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ประวัติสถานะ */}
          <div className="glass-panel overflow-hidden rounded-2xl">
            <div className="border-b border-black/8 px-5 py-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">ประวัติสถานะอุปกรณ์</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">แสดงการอัปเดตข้อมูลของอุปกรณ์นี้จากการแก้ไข โอนย้าย หรือบันทึกจำหน่าย/ชำรุด</p>
            </div>
            {statusHistory.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-[var(--muted)]">
                ยังไม่มีประวัติการอัปเดตสถานะสำหรับอุปกรณ์นี้
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full text-left text-sm">
                  <thead className="border-b border-black/8 bg-[var(--neutral-bg)] text-xs text-[var(--muted)]">
                    <tr>
                      <th className="px-4 py-3 font-medium">วันที่/เวลา</th>
                      <th className="px-4 py-3 font-medium">สถานะเดิม</th>
                      <th className="px-4 py-3 font-medium">สถานะใหม่</th>
                      <th className="px-4 py-3 font-medium">ผู้บันทึก</th>
                      <th className="px-4 py-3 font-medium">รายละเอียด</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/6 bg-white/70">
                    {statusHistory.map((entry) => (
                      <tr key={entry.id} className="align-top hover:bg-[var(--primary-soft)]/30">
                        <td className="px-4 py-3 text-xs text-[var(--muted)]">{formatThaiDateTime(entry.changedAt)}</td>
                        <td className="px-4 py-3">
                          {entry.fromStatus ? (
                            <StatusBadge tone={assetStatusTone(entry.fromStatus)}>{assetStatusLabel(entry.fromStatus)}</StatusBadge>
                          ) : (
                            <span className="text-xs text-[var(--muted)]">เริ่มต้น</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge tone={assetStatusTone(entry.toStatus)}>{assetStatusLabel(entry.toStatus)}</StatusBadge>
                        </td>
                        <td className="px-4 py-3 text-[var(--foreground)]">{entry.changedBy || "system"}</td>
                        <td className="max-w-md px-4 py-3 text-xs leading-5 text-[var(--muted)]">{entry.note || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {!isIt && <section className="rounded-xl border border-black/10 p-5">
            <h2 className="mb-4 text-base font-semibold">รายละเอียด{assetClassLabel(asset.assetClass)}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="ประเภทย่อย" value={asset.extensions[asset.assetClass]?.subtypeName} />
              {(ASSET_DETAIL_FIELDS[asset.assetClass] ?? []).map(field => <Field key={field.key} label={field.label} value={asset.extensions[asset.assetClass]?.details[field.key]} />)}
            </div>
          </section>}
          {/* ข้อมูลการจัดซื้อ */}
          <div className="glass-panel rounded-2xl p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">ข้อมูลการจัดซื้อ</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="ราคาที่ซื้อ (บาท)"
                value={asset.purchasePrice != null
                  ? asset.purchasePrice.toLocaleString("th-TH", { minimumFractionDigits: 2 })
                  : undefined}
              />
              <Field label="วันที่ซื้อ / ได้รับมอบ" value={formatThaiDate(asset.purchaseDate)} />
              <Field label="เลขที่สัญญา / PO" value={asset.purchaseOrderNo || undefined} />
              <Field label="รหัสหน่วยงาน / เลขครุภัณฑ์" value={asset.assetNumber || undefined} />
              <Field label="รหัสสินทรัพย์" value={asset.assetAccountingCode || undefined} />
              <Field label="แหล่งเงิน" value={fundingSourceLabel(asset.fundingSource) || undefined} />
              <Field label="วิธีการได้มา" value={acquisitionMethodLabel(asset.acquisitionMethod) || undefined} />
              <Field label="ผู้ขาย / ผู้รับจ้าง / ผู้บริจาค" value={asset.vendorName || undefined} />
              <Field label="หน่วยนับ" value={asset.unitName || undefined} />
              <Field label="สิ้นสุดการรับประกัน" value={asset.warrantyEndDate ? `${formatThaiDate(asset.warrantyEndDate)}${asset.warrantyEndDate < today ? " (หมดประกันแล้ว)" : ""}` : undefined} />
            </div>
          </div>

          <ValuationSection valuation={valuation} schedule={schedule} currentFiscalYear={fiscalYearOf(today)} />
          <TransferHistorySection rows={transfers.rows} schemaReady={transfers.schemaReady} />
          {canViewRepairs && <RepairHistorySection rows={repairs.rows} schemaReady={repairs.schemaReady} />}
          <DisposalHistorySection rows={disposals.rows} />

          {/* การดำเนินการด่วน */}
          <div className="glass-panel rounded-2xl p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">การดำเนินการ</h2>
            {terminal ? (
              <div className="rounded-xl border border-stone-300 bg-stone-100 px-4 py-3 text-sm text-stone-600">
                ทรัพย์สินนี้{asset.currentStatus === "Lost" ? "บันทึกสูญหาย" : "จำหน่าย"}แล้วตามคำขอที่อนุมัติ จึงไม่มีการดำเนินการเพิ่มเติม
              </div>
            ) : canMutateThisAsset ? (
              <div className="flex flex-wrap gap-3">
                {canTransfer && (
                  <Link
                    href={`/transfer?assetId=${asset.id}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100"
                  >
                    <AppIcon name="package" className="h-4 w-4" /> โอนย้ายทรัพย์สิน
                  </Link>
                )}
                {canManageLoans && !activeLoan && asset.currentStatus !== "Broken" && (
                  <Link
                    href={`/loans/new?assetId=${asset.id}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--primary-soft)]"
                  >
                    <AppIcon name="repeat" className="h-4 w-4" /> ให้ยืม
                  </Link>
                )}
                {canManageRepairs && (
                  <Link
                    href={openRepair ? `/repairs/${openRepair.id}` : `/repairs/new?assetId=${asset.id}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
                  >
                    <AppIcon name="wrench" className="h-4 w-4" /> {openRepair ? "ดูงานซ่อมที่เปิดอยู่" : "แจ้งซ่อม"}
                  </Link>
                )}
                {canDispose && (
                  <Link
                    href={`/disposal?assetId=${asset.id}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                  >
                    <AppIcon name="clipboard-check" className="h-4 w-4" /> ชำรุด / เสนอจำหน่าย
                  </Link>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-stone-300 bg-stone-100 px-4 py-3 text-sm text-stone-600">
                คุณสามารถดูข้อมูลได้อย่างเดียว เนื่องจากไม่มีสิทธิ์จัดการทรัพย์สินของหน่วยงานนี้
              </div>
            )}
          </div>

        </div>

        {/* Sidebar panel */}
        <div className="min-w-0 space-y-4">

          {/* QR Code */}
          <div className="glass-panel rounded-2xl p-5 text-center print:shadow-none">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--muted)]">QR Code ทรัพย์สิน</p>
            <div className="mx-auto mt-3 flex w-56 max-w-full items-center justify-center overflow-hidden rounded-xl border border-[var(--primary-soft-strong)] bg-white shadow-sm">
              <Image
                src={`/api/qr/asset/${asset.id}`}
                alt={`QR Code: ${asset.facilityName} ${asset.assetNumber || asset.assetName}`}
                width={240}
                height={300}
                unoptimized
                className="h-auto w-full object-contain"
              />
            </div>
            <p className="mt-1 break-all text-[11px] leading-4 text-[var(--muted)]">{assetScanUrl}</p>
            <QrDownloadButton
              downloadUrl={`/api/qr/asset/${asset.id}`}
              filename={`${sanitizeDownloadName(`${asset.assetRegistrationNo || `asset-${asset.id}`} ${asset.assetName}`)}.svg`}
            />
          </div>

          {/* สถานะ + ข้อมูลย่อ */}
          <div className="glass-panel rounded-2xl p-5">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--muted)]">ข้อมูลย่อ</p>
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted)]">สถานะ</span>
                <StatusBadge tone={assetStatusTone(asset.currentStatus)}>
                  {assetStatusLabel(asset.currentStatus)}
                </StatusBadge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted)]">หมวด</span>
                <span className="text-[var(--foreground)]">{assetClassLabel(asset.assetClass)}</span>
              </div>
              {isIt && <><div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted)]">ลักษณะ IT</span>
                <span className="text-[var(--foreground)]">{asset.assetGroup}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[var(--muted)]">ประเภท</span>
                <span className="break-words text-right text-[var(--foreground)]">{asset.deviceType || "–"}</span>
              </div></>}
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted)]">อัปเดตล่าสุด</span>
                <span className="text-xs text-[var(--foreground)]">{formatThaiDate(asset.updatedAt)}</span>
              </div>
              {asset.updatedBy && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--muted)]">โดย</span>
                  <span className="text-[var(--foreground)]">{asset.updatedBy}</span>
                </div>
              )}
            </div>
          </div>

          {/* Back link */}
          <Link
            href="/assets"
            className="flex items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-white/60 px-4 py-2.5 text-sm text-[var(--muted)] transition hover:bg-white"
          >
            ← กลับรายการทรัพย์สิน
          </Link>

        </div>
      </div>
    </div>
  );
}
