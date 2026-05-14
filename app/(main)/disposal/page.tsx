import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { getAssetById, listAssets } from "@/lib/assets";
import { DisposalForm } from "./_components/disposal-form";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(p: Record<string, string | string[] | undefined>, key: string) {
  const v = p[key];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

const STATUS_STYLE: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-700",
  Inactive: "bg-amber-100 text-amber-700",
  Broken: "bg-rose-100 text-rose-700",
};

export default async function DisposalPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "viewer") redirect("/assets");
  const canMutate = user.role !== "viewer";

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
          <Link href="/disposal" className="text-indigo-600 hover:underline">ค้นหาใหม่</Link>
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
  const results = q ? await listAssets({ search: q }) : [];

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
          className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-white/80 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
        />
        <button type="submit" className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700">
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
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[asset.currentStatus] ?? ""}`}>
                    {asset.currentStatus}
                  </span>
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
          <p className="mb-3 text-4xl">📋</p>
          <p className="text-sm">ป้อนชื่อหรือรหัสทรัพย์สินเพื่อเริ่มต้น</p>
        </div>
      )}
    </div>
  );
}

