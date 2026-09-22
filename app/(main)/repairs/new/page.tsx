import Link from "next/link";
import { redirect } from "next/navigation";

import { StatusBadge } from "@/app/_components/ui/status-badge";
import { listRepairs } from "@/lib/asset-repairs";
import { assetStatusLabel, assetStatusTone, isTerminalAssetStatus } from "@/lib/asset-status";
import { getCurrentUser } from "@/lib/auth";
import { getAssetById, listAssets } from "@/lib/assets";
import { getFacilityScopeId } from "@/lib/facility-scope";
import { canManageAssetRecord, canMutateAssets } from "@/lib/permissions";
import { hasPermission } from "@/lib/role-permissions";
import { NewRepairForm } from "../_components/repair-forms";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const readParam = (p: Record<string, string | string[] | undefined>, key: string) => (Array.isArray(p[key]) ? p[key]?.[0] : p[key]) ?? "";

export default async function NewRepairPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canMutateAssets(user) || !(await hasPermission(user.role, "repairs.manage"))) redirect("/repairs");
  const facilityScopeId = getFacilityScopeId(user);
  if (facilityScopeId === null) redirect("/profile");

  const params = await searchParams;
  const assetId = Number(readParam(params, "assetId")) || 0;
  const q = readParam(params, "q");

  if (assetId) {
    const asset = await getAssetById(assetId);
    if (!asset || !canManageAssetRecord(user, asset.facilityId)) {
      return <p className="mx-auto max-w-2xl py-20 text-center text-[var(--muted)]">ไม่พบทรัพย์สินหรือไม่มีสิทธิ์ — <Link href="/repairs/new" className="text-[var(--primary)] hover:underline">ค้นหาใหม่</Link></p>;
    }
    const open = await listRepairs({ assetId, status: "open", limit: 1 });
    const openRepair = open.rows[0];
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6">
        <div>
          <nav className="mb-3 flex items-center gap-2 text-xs text-[var(--muted)]"><Link href="/repairs" className="hover:text-[var(--foreground)]">งานซ่อมบำรุง</Link><span>/</span><span>แจ้งซ่อม</span></nav>
          <h1 className="section-title text-3xl font-semibold">แจ้งซ่อมทรัพย์สิน</h1>
        </div>
        <section className="glass-panel rounded-2xl p-6">
          <div className="mb-5 rounded-xl border border-[var(--primary-soft-strong)] bg-[var(--primary-soft)] p-4 text-sm">
            <p className="font-semibold">{asset.assetName}</p>
            <p className="font-mono text-xs text-[var(--muted)]">{asset.assetNumber || "-"} · {asset.facilityName}</p>
            <p className="mt-1">สถานะ: <StatusBadge tone={assetStatusTone(asset.currentStatus)}>{assetStatusLabel(asset.currentStatus)}</StatusBadge></p>
          </div>
          {!open.schemaReady ? (
            <p className="text-sm text-amber-700">ยังไม่ได้เปิดใช้งานซ่อมบำรุง (ต้องรัน database/add_asset_lifecycle.sql)</p>
          ) : isTerminalAssetStatus(asset.currentStatus) ? (
            <p className="text-sm text-amber-700">ทรัพย์สินนี้จำหน่ายหรือสูญหายแล้ว แจ้งซ่อมไม่ได้</p>
          ) : openRepair ? (
            <p className="text-sm">มีงานซ่อมที่ยังไม่ปิดอยู่แล้ว <Link href={`/repairs/${openRepair.id}`} className="font-semibold text-[var(--primary)] underline">#{openRepair.id}</Link> — อัปเดตงานเดิมแทนการแจ้งซ้ำ</p>
          ) : (
            <NewRepairForm assetId={asset.id} assetStatus={asset.currentStatus} />
          )}
        </section>
      </div>
    );
  }

  const results = q ? await listAssets({ search: q, facilityId: facilityScopeId, limit: 50 }) : [];
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6">
      <div>
        <nav className="mb-3 flex items-center gap-2 text-xs text-[var(--muted)]"><Link href="/repairs" className="hover:text-[var(--foreground)]">งานซ่อมบำรุง</Link><span>/</span><span>แจ้งซ่อม</span></nav>
        <h1 className="section-title text-3xl font-semibold">แจ้งซ่อม: เลือกทรัพย์สิน</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">ค้นหาด้วยชื่อ เลขทะเบียน หรือ Serial Number หรือสแกน QR ของทรัพย์สินแล้วเลือก “แจ้งซ่อม”</p>
      </div>
      <form method="GET" className="glass-panel flex gap-3 rounded-2xl p-4">
        <label htmlFor="repair-search" className="sr-only">ค้นหาทรัพย์สิน</label>
        <input id="repair-search" name="q" defaultValue={q} autoFocus placeholder="ค้นหาชื่อ / เลขทะเบียน / Serial…" className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-white/80 px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)]" />
        <button className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--primary-hover)]">ค้นหา</button>
      </form>
      {q && (
        <section className="glass-panel divide-y divide-black/5 overflow-hidden rounded-2xl">
          {results.length === 0 ? <p className="p-8 text-center text-sm text-[var(--muted)]">ไม่พบทรัพย์สิน</p> : results.map((asset) => (
            <div key={asset.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className="text-sm font-medium">{asset.assetName}</p>
                <p className="font-mono text-xs text-[var(--muted)]">{asset.assetNumber} · {asset.facilityName}</p>
              </div>
              {isTerminalAssetStatus(asset.currentStatus)
                ? <StatusBadge tone="neutral">{assetStatusLabel(asset.currentStatus)}</StatusBadge>
                : <Link href={`/repairs/new?assetId=${asset.id}`} className="whitespace-nowrap rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--primary-hover)]">แจ้งซ่อม →</Link>}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
