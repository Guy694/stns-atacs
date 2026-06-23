import Link from "next/link";
import { redirect } from "next/navigation";

import { AppIcon } from "@/app/_components/ui/icon";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { getCurrentUser } from "@/lib/auth";
import { getAssetById, listAssets } from "@/lib/assets";
import { canManageAsset, canMutateAssets } from "@/lib/permissions";
import { hasPermission } from "@/lib/role-permissions";
import { DisposalForm } from "./_components/disposal-form";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(p: Record<string, string | string[] | undefined>, key: string) {
  const v = p[key];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

const STATUS_TONE = {
  Active: "success",
  Inactive: "warning",
  Broken: "danger",
} as const;

export default async function DisposalPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canMutateAssets(user)) redirect("/assets");
  if (!(await hasPermission(user.role, "disposal.manage"))) redirect("/assets");
  const canMutate = true;
  const facilityScopeId = user.role === "officer" ? Number(user.facilityId ?? 0) : undefined;

  const params = await searchParams;
  const q = readParam(params, "q");
  const assetId = Number(readParam(params, "assetId")) || 0;

  // ── View: disposal form for a specific asset ───────────────────────────
  if (assetId) {
    const asset = await getAssetById(assetId);
    if (!asset) {
      return (
        <div className="mx-auto max-w-2xl py-20 text-center text-[var(--muted)]">
          ไม่พบทรัพย์สิน ID {assetId} —{" "}
          <Link href="/disposal" className="text-[var(--primary)] hover:underline">ค้นหาใหม่</Link>
        </div>
      );
    }

    if (!canManageAsset(user, asset.facilityId)) {
      return (
        <div className="mx-auto max-w-2xl py-20 text-center text-[var(--muted)]">
          คุณไม่มีสิทธิ์ดำเนินการทรัพย์สินของหน่วยงานนี้ —{" "}
          <Link href="/disposal" className="text-[var(--primary)] hover:underline">ค้นหาใหม่</Link>
        </div>
      );
    }

    if (!canMutate) {
      return (
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--muted)]">ATACS · จำหน่าย/ชำรุด/สูญหาย</p>
            <h1 className="section-title mt-1 text-3xl font-semibold">บันทึกการดำเนินการ</h1>
          </div>
          <div className="glass-panel rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            บัญชี Viewer ไม่มีสิทธิ์บันทึกการดำเนินการทรัพย์สิน
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6">
        <div>
          <nav className="flex items-center gap-2 text-xs text-[var(--muted)] mb-3">
            <Link href="/disposal" className="hover:text-[var(--foreground)]">จำหน่าย/ชำรุด/สูญหาย</Link>
            <span>/</span>
            <span>{asset.assetRegistrationNo}</span>
          </nav>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--muted)]">ATACS · จำหน่าย/ชำรุด/สูญหาย</p>
          <h1 className="section-title mt-1 text-3xl font-semibold">บันทึกการดำเนินการ</h1>
        </div>
        <div className="glass-panel rounded-2xl p-6">
          <DisposalForm asset={asset} />
        </div>
      </div>
    );
  }

  // ── View: search ───────────────────────────────────────────────────────
  const results = q ? await listAssets({ search: q, facilityId: facilityScopeId }) : [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--muted)]">ATACS · จำหน่าย/ชำรุด/สูญหาย</p>
        <h1 className="section-title mt-1 text-3xl font-semibold">จำหน่าย / ชำรุด / สูญหาย</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">ค้นหาทรัพย์สินที่ต้องการดำเนินการ</p>
      </div>

      <form method="GET" className="glass-panel flex gap-3 rounded-2xl p-4">
        <input
          name="q"
          defaultValue={q}
          autoFocus
          placeholder="ค้นหาชื่อ / เลขทะเบียน / ประเภท…"
          className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-white/80 px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
        />
        <button type="submit" className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)]">
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
                  <p className="font-mono text-xs text-[var(--muted)]">{asset.assetRegistrationNo}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">{asset.facilityName} · อ.{asset.districtName}</p>
                </div>
                <div className="ml-4 flex items-center gap-3">
                  <StatusBadge tone={STATUS_TONE[asset.currentStatus as keyof typeof STATUS_TONE] ?? "neutral"}>
                    {asset.currentStatus}
                  </StatusBadge>
                  {canMutate ? (
                    <Link
                      href={`/disposal?assetId=${asset.id}`}
                      className="whitespace-nowrap rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-700"
                    >
                      ดำเนินการ →
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
          <AppIcon name="clipboard-check" className="mx-auto mb-3 h-10 w-10 text-[var(--primary)]" />
          <p className="text-sm">ป้อนชื่อหรือรหัสทรัพย์สินเพื่อเริ่มต้น</p>
        </div>
      )}
    </div>
  );
}
