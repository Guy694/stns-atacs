import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppIcon } from "@/app/_components/ui/icon";
import { PhotoBackdrop } from "@/app/_components/ui/photo-backdrop";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { getAgentDeviceByLinkedAssetId } from "@/lib/agent";
import { APP_NAME, APP_ORG } from "@/lib/app-brand";
import { assetStatusTone } from "@/lib/asset-status";
import { valueAsset } from "@/lib/asset-valuation";
import { getAssetById } from "@/lib/assets";
import { getCurrentUser } from "@/lib/auth";
import { withBasePath } from "@/lib/base-path";
import { formatThaiDate } from "@/lib/date-format";
import { todayBangkok } from "@/lib/local-date";
import { toPublicAssetView, type PublicAssetView } from "@/lib/public-asset";
import { consumeRateLimit } from "@/lib/rate-limit";
import { readRequestIp } from "@/lib/security";

type ScanAssetPageProps = {
  params: Promise<{ id: string }>;
};

/** Public scan pages must never end up in search engines (the ids are sequential). */
export const metadata: Metadata = {
  title: `ข้อมูลครุภัณฑ์ · ${APP_NAME}`,
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

// One person checking stickers around a building stays far below this; a script walking every id does not.
const PUBLIC_SCAN_LIMIT = 60;
const PUBLIC_SCAN_WINDOW_MS = 10 * 60 * 1000;

const baht = (value: number) => value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Target of the QR sticker.
 * - Signed-in staff go straight to the full asset page (check-in panel for inspections).
 * - Anyone else sees a read-only public card for transparency (outside auditors): whitelisted fields only
 *   (lib/public-asset.ts) — no IP/MAC/hostname/OS/licence/agent data, serial numbers, owners or rooms.
 */
export default async function ScanAssetPage({ params }: ScanAssetPageProps) {
  const { id } = await params;
  const assetId = Number(id);
  if (!Number.isSafeInteger(assetId) || assetId <= 0) notFound();

  const target = `/assets/${assetId}`;
  const user = await getCurrentUser();
  if (user) redirect(target);

  const ip = readRequestIp(await headers()) ?? "unknown";
  const gate = consumeRateLimit(`public-scan:${ip}`, PUBLIC_SCAN_LIMIT, PUBLIC_SCAN_WINDOW_MS);
  if (!gate.allowed) {
    return (
      <PublicShell>
        <div className="px-6 py-10 text-center">
          <AppIcon name="warning" className="mx-auto mb-3 h-8 w-8 text-[var(--state-warning-fg)]" />
          <h1 className="text-lg font-semibold">เปิดดูข้อมูลถี่เกินไป</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">กรุณารอประมาณ {Math.ceil(gate.retryAfterSeconds / 60)} นาที แล้วสแกนใหม่อีกครั้ง</p>
        </div>
      </PublicShell>
    );
  }

  const asset = await getAssetById(assetId);
  if (!asset) notFound();
  const agent = await getAgentDeviceByLinkedAssetId(asset.id);
  const today = todayBangkok();
  const valuation = valueAsset({ ...asset, subtypeName: asset.extensions[asset.assetClass]?.subtypeName }, today);
  const view = toPublicAssetView(asset, valuation, today, { hostname: agent?.hostname ?? null });

  return (
    <PublicShell>
      <PublicAssetCard view={view} />
      <div className="border-t border-[var(--line)] px-5 py-4 sm:px-6">
        <Link
          href={`/login/?next=${encodeURIComponent(target)}`}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-white px-4 text-sm font-medium text-[var(--primary-text)] transition hover:bg-[var(--primary-soft)] sm:w-auto"
        >
          <AppIcon name="user" size={16} />
          เจ้าหน้าที่ เข้าสู่ระบบเพื่อตรวจนับ
        </Link>
      </div>
    </PublicShell>
  );
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-[var(--background)] px-3 py-5 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-4 flex items-center gap-3 px-1">
          {/* eslint-disable-next-line @next/next/no-img-element -- static logo, basePath-aware */}
          <img src={withBasePath("/logo.png")} alt="" width={40} height={40} className="h-10 w-10 rounded-full" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{APP_NAME}</p>
            <p className="truncate text-xs text-[var(--muted)]">{APP_ORG}</p>
          </div>
        </header>
        <article className="glass-panel overflow-hidden rounded-2xl">{children}</article>
        <p className="mt-4 px-1 text-center text-xs text-[var(--muted)]">
          ข้อมูลเผยแพร่เพื่อความโปร่งใสในการตรวจสอบครุภัณฑ์ของทางราชการ ไม่แสดงข้อมูลส่วนบุคคลและข้อมูลด้านความปลอดภัยของระบบ
        </p>
      </div>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-3 px-5 py-2.5 sm:px-6">
      <dt className="text-sm text-[var(--muted)]">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-medium">{children}</dd>
    </div>
  );
}

function ValueText({ value }: { value: PublicAssetView["value"] }) {
  switch (value.status) {
    case "ok":
      return (
        <>
          {baht(value.bookValue ?? 0)} บาท
          {value.isFullyDepreciated && <span className="ml-1 text-xs font-normal text-[var(--state-warning-fg)]">(ครบอายุการใช้งาน)</span>}
          <span className="block text-xs font-normal text-[var(--muted)]">ณ {formatThaiDate(value.asOf)}</span>
        </>
      );
    case "below-threshold":
      return <span className="font-normal text-[var(--muted)]">ราคาต่ำกว่าเกณฑ์ ไม่คิดค่าเสื่อมราคา</span>;
    default:
      return <span className="font-normal text-[var(--muted)]">ยังคำนวณไม่ได้ (ข้อมูลราคาหรือวันที่ได้มาไม่ครบ)</span>;
  }
}

function PublicAssetCard({ view }: { view: PublicAssetView }) {
  const type = [view.classLabel, view.deviceType].filter(Boolean).join(" · ");
  return (
    <>
      <div className="relative isolate overflow-hidden border-b border-[var(--line)] px-5 py-5 sm:px-6">
        <PhotoBackdrop image="office-desk" fade="left" opacity="opacity-[0.10]" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold leading-snug">{view.assetName}</h1>
            <p className="mt-1 font-mono text-sm text-[var(--muted)]">{view.registrationNo ?? "ยังไม่มีเลขครุภัณฑ์"}</p>
          </div>
          <StatusBadge tone={assetStatusTone(view.status)} className="shrink-0 px-3 py-1 text-sm">
            {view.statusLabel}
          </StatusBadge>
        </div>
      </div>
      <dl className="divide-y divide-[var(--line)] py-1">
        <Row label="ประเภท">{type || "–"}</Row>
        <Row label="หน่วยงาน">{view.facilityName ?? "–"}</Row>
        {view.workGroupName && <Row label="กลุ่มงาน">{view.workGroupName}</Row>}
        <Row label="ยี่ห้อ / รุ่น">{view.brandModel ?? "–"}</Row>
        <Row label="ปีที่ได้มา">{view.acquiredYearBE ? `พ.ศ. ${view.acquiredYearBE}` : "–"}</Row>
        <Row label="ราคาที่ได้มา">{view.purchasePrice !== null ? `${baht(view.purchasePrice)} บาท` : "–"}</Row>
        <Row label="มูลค่าคงเหลือ">
          <ValueText value={view.value} />
        </Row>
      </dl>
    </>
  );
}
