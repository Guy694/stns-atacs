import Link from "next/link";
import { redirect } from "next/navigation";

import { AppIcon } from "@/app/_components/ui/icon";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { assetStatusLabel, assetStatusTone } from "@/lib/asset-status";
import { getCurrentUser } from "@/lib/auth";
import { getAssetById, listAssets, listSurveys } from "@/lib/assets";
import { listTransfers } from "@/lib/asset-transfers";
import { isTerminalAssetStatus } from "@/lib/asset-status";
import { formatThaiDate } from "@/lib/date-format";
import { listFacilityWorkGroups } from "@/lib/facility-work-groups";
import { getFacilityScopeId } from "@/lib/facility-scope";
import { canManageAsset, canMutateAssets } from "@/lib/permissions";
import { hasPermission } from "@/lib/role-permissions";
import { TransferForm } from "./_components/transfer-form";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(p: Record<string, string | string[] | undefined>, key: string) {
  const v = p[key];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

export default async function TransferPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canMutateAssets(user)) redirect("/assets");
  if (!(await hasPermission(user.role, "transfer.manage"))) redirect("/assets");
  const canMutate = true;
  const facilityScopeId = getFacilityScopeId(user);
  if (facilityScopeId === null) redirect("/profile");

  const params = await searchParams;
  const q = readParam(params, "q");
  const assetId = Number(readParam(params, "assetId")) || 0;

  // ── View: transfer form for a specific asset ───────────────────────────
  if (assetId) {
    const [asset, surveys, workGroups] = await Promise.all([
      getAssetById(assetId),
      listSurveys(facilityScopeId ? { facilityId: facilityScopeId } : undefined),
      listFacilityWorkGroups(facilityScopeId || undefined),
    ]);
    if (!asset) {
      return (
        <div className="mx-auto max-w-2xl py-20 text-center text-[var(--muted)]">
          ไม่พบทรัพย์สิน ID {assetId} —{" "}
          <Link href="/transfer" className="text-[var(--primary)] hover:underline">ค้นหาใหม่</Link>
        </div>
      );
    }

    if (!canManageAsset(user, asset.facilityId)) {
      return (
        <div className="mx-auto max-w-2xl py-20 text-center text-[var(--muted)]">
          คุณไม่มีสิทธิ์โอนย้ายทรัพย์สินของหน่วยงานนี้ —{" "}
          <Link href="/transfer" className="text-[var(--primary)] hover:underline">ค้นหาใหม่</Link>
        </div>
      );
    }

    const scopedSurveys = surveys;

    if (isTerminalAssetStatus(asset.currentStatus)) {
      return (
        <div className="mx-auto max-w-2xl py-20 text-center text-[var(--muted)]">
          ทรัพย์สินนี้{asset.currentStatus === "Lost" ? "สูญหาย" : "จำหน่าย"}แล้ว โอนย้ายไม่ได้ —{" "}
          <Link href={`/assets/${asset.id}`} className="text-[var(--primary)] hover:underline">กลับไปหน้ารายละเอียด</Link>
        </div>
      );
    }

    if (!canMutate) {
      return (
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6">
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-[var(--accent-strong)]">ATACS · โอนย้ายทรัพย์สิน</p>
            <h1 className="section-title mt-1 text-3xl font-semibold">โอนย้ายทรัพย์สิน</h1>
          </div>
          <div className="glass-panel rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            บัญชี Viewer ไม่มีสิทธิ์โอนย้ายทรัพย์สิน
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6">
        <div>
          <nav className="flex items-center gap-2 text-xs text-[var(--muted)] mb-3">
            <Link href="/transfer" className="hover:text-[var(--foreground)]">โอนย้ายทรัพย์สิน</Link>
            <span>/</span>
            <span>{asset.assetNumber}</span>
          </nav>
          <p className="text-xs font-semibold tracking-[0.12em] text-[var(--accent-strong)]">ATACS · โอนย้ายทรัพย์สิน</p>
          <h1 className="section-title mt-1 text-3xl font-semibold">โอนย้ายทรัพย์สิน</h1>
        </div>
        <div className="glass-panel rounded-2xl p-6">
          <TransferForm asset={asset} surveys={scopedSurveys} workGroups={workGroups} />
        </div>
      </div>
    );
  }

  // ── View: search ───────────────────────────────────────────────────────
  const [results, recent] = await Promise.all([
    q ? listAssets({ search: q, facilityId: facilityScopeId }) : Promise.resolve([]),
    listTransfers({ facilityIds: facilityScopeId ? [facilityScopeId] : undefined, limit: 20 }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6">
      <div>
        <p className="text-xs font-semibold tracking-[0.12em] text-[var(--accent-strong)]">ATACS · โอนย้ายทรัพย์สิน</p>
        <h1 className="section-title mt-1 text-3xl font-semibold">โอนย้ายทรัพย์สิน</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">ค้นหาทรัพย์สินที่ต้องการโอนย้าย แล้วระบุหน่วยงานปลายทาง</p>
      </div>

      <form method="GET" className="glass-panel flex gap-3 rounded-2xl p-4">
        <input
          name="q"
          defaultValue={q}
          autoFocus
          placeholder="ค้นหาชื่อ / เลขทะเบียน / ประเภท…"
          className="filter-control min-w-0 flex-1"
        />
        <button type="submit" className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[var(--primary-hover)]">
          ค้นหา
        </button>
      </form>

      {q && results.length === 0 && (
        <div className="glass-panel rounded-2xl p-10 text-center text-[var(--muted)]">
          ไม่พบทรัพย์สินที่ตรงกับ &quot;{q}&quot;
        </div>
      )}

      {results.length > 0 && (
        <div className="glass-panel overflow-hidden rounded-2xl">
          <div className="border-b border-black/6 px-5 py-3">
            <span className="font-semibold">ผลการค้นหา</span>
            <span className="ml-2 text-sm text-[var(--muted)]">{results.length} รายการ</span>
          </div>
          <div className="divide-y divide-black/4">
            {results.map((asset) => (
              <div key={asset.id} className="flex items-center justify-between px-5 py-3 transition hover:bg-white/50">
                <div>
                  <p className="text-sm font-medium">{asset.assetName}</p>
                  <p className="font-mono text-xs text-[var(--muted)]">{asset.assetNumber}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">{asset.facilityName} · อ.{asset.districtName}</p>
                </div>
                <div className="ml-4 flex items-center gap-3">
                  <StatusBadge tone={assetStatusTone(asset.currentStatus)}>
                    {assetStatusLabel(asset.currentStatus)}
                  </StatusBadge>
                  {canMutate ? (
                    <Link
                      href={`/transfer?assetId=${asset.id}`}
                      className="whitespace-nowrap rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--primary-hover)]"
                    >
                      โอนย้ายทรัพย์สินนี้ →
                    </Link>
                  ) : (
                    <span className="rounded-xl border border-stone-300 bg-stone-100 px-4 py-2 text-xs font-medium text-stone-500">
                      ดูข้อมูลเท่านั้น
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!q && (
        <div className="glass-panel rounded-2xl p-10 text-center text-[var(--muted)]">
          <AppIcon name="package" className="mx-auto mb-3 h-10 w-10 text-[var(--primary)]" />
          <p className="text-sm">ป้อนชื่อหรือรหัสทรัพย์สินเพื่อเริ่มต้น</p>
        </div>
      )}

      <section className="glass-panel overflow-hidden rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/6 px-5 py-3">
          <h2 className="font-semibold">ประวัติการโอนย้ายล่าสุด</h2>
          <Link href="/reports?view=transfers" className="text-xs font-medium text-[var(--primary)] hover:underline">ดูรายงานทั้งหมด</Link>
        </div>
        {!recent.schemaReady ? (
          <p className="px-5 py-6 text-sm text-amber-700">ยังไม่ได้เปิดใช้ประวัติการโอนย้าย (ต้องรัน database/add_asset_lifecycle.sql)</p>
        ) : recent.rows.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-[var(--muted)]">ยังไม่มีการโอนย้าย</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50/60 text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">วันที่</th>
                  <th className="px-4 py-2.5 text-left font-medium">ทรัพย์สิน</th>
                  <th className="px-4 py-2.5 text-left font-medium">จาก</th>
                  <th className="px-4 py-2.5 text-left font-medium">ไป</th>
                  <th className="px-4 py-2.5 text-left font-medium">ผู้บันทึก</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/4">
                {recent.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-[var(--muted)]">{formatThaiDate(row.transferDate)}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/assets/${row.assetId}`} className="font-medium hover:underline">{row.assetName}</Link>
                      <p className="font-mono text-xs text-[var(--muted)]">{row.assetRegistrationNo}</p>
                    </td>
                    <td className="px-4 py-2.5 text-xs">{row.fromFacilityName}{row.fromLocationDetail ? ` · ${row.fromLocationDetail}` : ""}</td>
                    <td className="px-4 py-2.5 text-xs">{row.toFacilityName}{row.toLocationDetail ? ` · ${row.toLocationDetail}` : ""}</td>
                    <td className="px-4 py-2.5 text-xs text-[var(--muted)]">{row.transferredBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
