import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { getAssetById, listAllFacilitiesForSelect } from "@/lib/assets";
import { AssetFormModal } from "@/app/(main)/assets/_components/asset-form-modal";
import { DeleteAssetButton } from "@/app/(main)/assets/_components/delete-asset-button";
import { PrintButton } from "@/app/(main)/assets/_components/print-button";
import { canManageAsset, canSeeSensitiveAssetNetwork } from "@/lib/permissions";
import { hasPermission } from "@/lib/role-permissions";

type Props = { params: Promise<{ id: string }> };

function statusBadge(status: string) {
  if (status === "Active") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "Broken") return "bg-rose-100 text-rose-700 border-rose-200";
  return "bg-amber-100 text-amber-700 border-amber-200";
}

function statusLabel(status: string) {
  if (status === "Active") return "ใช้งานอยู่";
  if (status === "Broken") return "ชำรุด";
  return "ไม่ใช้งาน";
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-[var(--foreground)]">{value || "–"}</p>
    </div>
  );
}

export default async function AssetDetailPage({ params }: Props) {
  const { id } = await params;
  const numId = Number(id);
  if (isNaN(numId)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [asset, facilitiesForSelect] = await Promise.all([getAssetById(numId), listAllFacilitiesForSelect()]);
  if (!asset) notFound();

  const canMutateThisAsset = (await hasPermission(user.role, "assets.update")) && canManageAsset(user, asset.facilityId);
  const canDeleteThisAsset = (await hasPermission(user.role, "assets.delete")) && canManageAsset(user, asset.facilityId);
  const canViewNetwork = (await hasPermission(user.role, "assets.network.view")) && canSeeSensitiveAssetNetwork(user, asset.facilityId);

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
      <nav className="flex items-center gap-2 text-xs text-[var(--muted)]">
        <Link href="/" className="hover:text-[var(--foreground)]">หน้าหลัก</Link>
        <span>/</span>
        <Link href="/assets" className="hover:text-[var(--foreground)]">ทรัพย์สินทั้งหมด</Link>
        <span>/</span>
        <span className="text-[var(--foreground)]">{asset.assetRegistrationNo}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadge(asset.currentStatus)}`}>
              {statusLabel(asset.currentStatus)}
            </span>
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
              {asset.assetGroup}
            </span>
            {asset.deviceType && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">{asset.deviceType}</span>
            )}
          </div>
          <h1 className="section-title mt-2 text-2xl font-semibold sm:text-3xl">{asset.assetName}</h1>
          <p className="mt-1 font-mono text-sm text-[var(--muted)]">{asset.assetRegistrationNo}</p>
        </div>
        {canMutateThisAsset && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <AssetFormModal facilities={facilitiesForSelect} updaterName={user.fullName} mode="edit" asset={asset}>
              <span className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100">
                แก้ไข
              </span>
            </AssetFormModal>
            {canDeleteThisAsset && <DeleteAssetButton assetId={asset.id} assetName={asset.assetName} />}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">

        {/* Main details */}
        <div className="space-y-4 lg:col-span-2">

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

          {/* ข้อมูลอุปกรณ์ */}
          <div className="glass-panel rounded-2xl p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">ข้อมูลอุปกรณ์</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="ยี่ห้อ (Brand)" value={asset.manufacturerBrand} />
              <Field label="Serial Number" value={asset.serialNumber} />
              <Field label="ระบบปฏิบัติการ" value={asset.operatingSystem} />
              <Field label="Private IP" value={canViewNetwork ? (asset.privateIp || "–") : "ซ่อนข้อมูล"} />
              <Field label="Public IP" value={canViewNetwork ? (asset.publicIp || "–") : "ซ่อนข้อมูล"} />
            </div>
          </div>

          {/* สัญญา MA */}
          <div className="glass-panel rounded-2xl p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">สัญญาบำรุงรักษา (MA)</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="วันสิ้นสุด MA" value={asset.maintenanceEndDate || "–"} />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--muted)]">สถานะ MA</p>
                <div className="mt-1">
                  {daysLeft === null ? (
                    <span className="text-sm text-[var(--muted)]">ไม่มีข้อมูล</span>
                  ) : daysLeft < 0 ? (
                    <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">หมดอายุแล้ว</span>
                  ) : daysLeft <= 30 ? (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">ใกล้หมดอายุ ({daysLeft} วัน)</span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">ยังใช้ได้ ({daysLeft} วัน)</span>
                  )}
                </div>
              </div>
            </div>
          </div>

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
              <Field label="วันที่ซื้อ / ได้รับมอบ" value={asset.purchaseDate || undefined} />
              <Field label="เลขที่สัญญา / PO" value={asset.purchaseOrderNo || undefined} />
            </div>
          </div>

          {/* การดำเนินการด่วน */}
          <div className="glass-panel rounded-2xl p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">การดำเนินการ</h2>
            {canMutateThisAsset ? (
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/transfer?assetId=${asset.id}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100"
                >
                  📦 โอนย้ายทรัพย์สิน
                </Link>
                <Link
                  href={`/disposal?assetId=${asset.id}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  📋 จำหน่าย/ชำรุด
                </Link>
              </div>
            ) : (
              <div className="rounded-xl border border-stone-300 bg-stone-100 px-4 py-3 text-sm text-stone-600">
                คุณสามารถดูข้อมูลได้อย่างเดียว เนื่องจากไม่มีสิทธิ์จัดการทรัพย์สินของหน่วยงานนี้
              </div>
            )}
          </div>

        </div>

        {/* Sidebar panel */}
        <div className="space-y-4">

          {/* QR Code */}
          <div className="glass-panel rounded-2xl p-5 text-center print:shadow-none">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--muted)]">QR Code ทรัพย์สิน</p>
            <div className="mx-auto mt-3 flex h-36 w-36 items-center justify-center overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=144x144&data=${encodeURIComponent(asset.assetRegistrationNo)}&color=3730a3&bgcolor=ffffff&qzone=1`}
                alt={`QR Code: ${asset.assetRegistrationNo}`}
                width={144}
                height={144}
                className="h-full w-full object-contain"
              />
            </div>
            <p className="mt-2 font-mono text-xs text-[var(--muted)]">{asset.assetRegistrationNo}</p>
            <PrintButton />
          </div>

          {/* สถานะ + ข้อมูลย่อ */}
          <div className="glass-panel rounded-2xl p-5">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--muted)]">ข้อมูลย่อ</p>
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted)]">สถานะ</span>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusBadge(asset.currentStatus)}`}>
                  {statusLabel(asset.currentStatus)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted)]">หมวด</span>
                <span className="text-[var(--foreground)]">{asset.assetGroup}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted)]">ประเภท</span>
                <span className="text-[var(--foreground)]">{asset.deviceType || "–"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted)]">อัปเดตล่าสุด</span>
                <span className="font-mono text-xs text-[var(--foreground)]">{asset.updatedAt || "–"}</span>
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
