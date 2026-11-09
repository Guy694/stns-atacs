import Link from "next/link";

import { AppIcon } from "@/app/_components/ui/icon";
import { PhotoBackdrop } from "@/app/_components/ui/photo-backdrop";
import { getCurrentUser } from "@/lib/auth";
import { getFacilityScopeId } from "@/lib/facility-scope";
import { listInspections, type Inspection } from "@/lib/inspection";
import { hasPermission } from "@/lib/role-permissions";

import { QrScannerPanel } from "./_components/qr-scanner-panel";

/**
 * In-app QR scanner: scan a sticker → the asset page (which shows the "พบ" panel when a round is open).
 * Works without an open inspection round. Continuous / offline counting stays on the round page.
 */
export default async function ScanPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [canViewAssets, canViewInspection] = await Promise.all([
    hasPermission(user.role, "assets.view"),
    hasPermission(user.role, "inspection.view"),
  ]);

  if (!canViewAssets) {
    return (
      <div className="mx-auto w-full max-w-xl">
        <h1 className="section-title text-2xl font-semibold">สแกน QR</h1>
        <p className="mt-3 flex items-center gap-2 text-sm text-[var(--muted)]"><AppIcon name="shield" size={16} /> บัญชีนี้ไม่มีสิทธิ์ดูข้อมูลครุภัณฑ์</p>
      </div>
    );
  }

  // Officers search inside their own facility page (/assets sends them there and would drop the query).
  const singleManaged = user.managedAssetFacilityIds?.length === 1 ? user.managedAssetFacilityIds[0] : null;
  const ownFacilityId = user.role === "admin" ? null : user.facilityId ?? singleManaged;
  const searchPath = ownFacilityId ? `/facilities/${ownFacilityId}/` : "/assets/";

  let openRounds: Inspection[] = [];
  const scopeId = getFacilityScopeId(user);
  if (canViewInspection && scopeId !== null && user.role !== "viewer") {
    openRounds = (await listInspections(scopeId).catch(() => []))
      .filter((round) => round.roundStatus !== "Closed" && round.remainingItems > 0)
      .slice(0, 5);
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4">
      <header className="glass-panel relative isolate overflow-hidden rounded-2xl px-5 py-5">
        <PhotoBackdrop image="it-storage" opacity="opacity-[0.12]" fade="left" />
        <h1 className="section-title text-2xl font-semibold sm:text-3xl">สแกน QR ครุภัณฑ์</h1>
        <p className="mt-1 max-w-md text-sm text-[var(--muted)]">
          สแกนสติ๊กเกอร์เพื่อเปิดข้อมูลครุภัณฑ์ ถ้ามีรอบตรวจนับเปิดอยู่ หน้าครุภัณฑ์จะมีปุ่ม “พบ” ให้บันทึกทันที
        </p>
      </header>

      <QrScannerPanel searchPath={searchPath} />

      {openRounds.length > 0 && (
        <section aria-labelledby="open-rounds-heading" className="glass-panel rounded-2xl p-4 sm:p-5">
          <h2 id="open-rounds-heading" className="text-sm font-semibold text-[var(--foreground)]">รอบตรวจนับที่เปิดอยู่</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">ต้องการสแกนต่อเนื่องหลายรายการ หรือสแกนในพื้นที่ไม่มีสัญญาณ ให้เปิดจากหน้ารอบตรวจนับ</p>
          <ul className="mt-3 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] bg-white">
            {openRounds.map((round) => (
              <li key={round.id}>
                <Link href={`/inspection/${round.id}`} className="flex min-h-12 items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-[var(--primary-soft)]">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{round.roundName}</span>
                    <span className="block truncate text-xs text-[var(--muted)]">{round.facilityName}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-[var(--muted)]">
                    เหลือ {round.remainingItems.toLocaleString("th-TH")}
                    <AppIcon name="clipboard-check" aria-hidden="true" className="h-4 w-4" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
