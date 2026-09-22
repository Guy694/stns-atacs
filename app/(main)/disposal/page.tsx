import Link from "next/link";
import { redirect } from "next/navigation";

import { AppIcon } from "@/app/_components/ui/icon";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { assetStatusLabel, assetStatusTone } from "@/lib/asset-status";
import { getCurrentUser } from "@/lib/auth";
import { getAssetById, listAssets } from "@/lib/assets";
import { getDisposalRequest, listDisposalRequests, type DisposalRequest } from "@/lib/asset-disposals";
import { isTerminalAssetStatus } from "@/lib/asset-status";
import { formatThaiDate, formatThaiDateTime } from "@/lib/date-format";
import { DISPOSAL_REQUEST_TYPE_LABELS, DISPOSAL_STATUS_LABELS, DISPOSAL_STATUS_TONES, disposalMethodLabel } from "@/lib/disposal-options";
import { getFacilityScopeId } from "@/lib/facility-scope";
import { canManageAsset, canMutateAssets } from "@/lib/permissions";
import { hasPermission } from "@/lib/role-permissions";
import { DisposalForm } from "./_components/disposal-form";
import { CancelDisposalForm, DisposalDecisionForm } from "./_components/disposal-decision-form";

const baht = (value: number | null) => (value === null ? "-" : value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

function RequestTable({ rows, empty }: { rows: DisposalRequest[]; empty: string }) {
  if (rows.length === 0) return <p className="px-5 py-6 text-center text-sm text-[var(--muted)]">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-slate-50/60 text-xs text-[var(--muted)]">
          <tr>
            <th className="px-4 py-2.5 text-left font-medium">คำขอ</th>
            <th className="px-4 py-2.5 text-left font-medium">ทรัพย์สิน</th>
            <th className="px-4 py-2.5 text-left font-medium">ประเภท</th>
            <th className="px-4 py-2.5 text-right font-medium">มูลค่าสุทธิ</th>
            <th className="px-4 py-2.5 text-left font-medium">ผู้เสนอ</th>
            <th className="px-4 py-2.5 text-center font-medium">สถานะ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/4">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-white/50">
              <td className="px-4 py-2.5"><Link href={`/disposal?requestId=${row.id}`} className="font-mono text-xs font-semibold text-[var(--primary)] hover:underline">#{row.id}</Link><p className="text-xs text-[var(--muted)]">{formatThaiDate(row.requestedAt)}</p></td>
              <td className="px-4 py-2.5"><Link href={`/assets/${row.assetId}`} className="font-medium hover:underline">{row.assetName}</Link><p className="font-mono text-xs text-[var(--muted)]">{row.assetRegistrationNo} · {row.facilityName}</p></td>
              <td className="px-4 py-2.5 text-xs">{DISPOSAL_REQUEST_TYPE_LABELS[row.requestType]}{row.disposalMethod ? <p className="text-[var(--muted)]">{disposalMethodLabel(row.disposalMethod)}</p> : null}</td>
              <td className="px-4 py-2.5 text-right text-xs tabular-nums">{baht(row.bookValue)}</td>
              <td className="px-4 py-2.5 text-xs text-[var(--muted)]">{row.requestedBy}</td>
              <td className="px-4 py-2.5 text-center"><StatusBadge tone={DISPOSAL_STATUS_TONES[row.status]}>{DISPOSAL_STATUS_LABELS[row.status]}</StatusBadge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(p: Record<string, string | string[] | undefined>, key: string) {
  const v = p[key];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

export default async function DisposalPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canMutateAssets(user)) redirect("/assets");
  const [canRequest, canApprove] = await Promise.all([hasPermission(user.role, "disposal.manage"), hasPermission(user.role, "disposal.approve")]);
  if (!canRequest && !canApprove) redirect("/assets");
  const canMutate = canRequest;
  const facilityScopeId = getFacilityScopeId(user);
  if (facilityScopeId === null) redirect("/profile");

  const params = await searchParams;
  const q = readParam(params, "q");
  const assetId = Number(readParam(params, "assetId")) || 0;
  const requestId = Number(readParam(params, "requestId")) || 0;
  const scopeIds = facilityScopeId ? [facilityScopeId] : undefined;

  // ── View: one request ─────────────────────────────────────────────────
  if (requestId) {
    let request: DisposalRequest | null = null;
    let schemaReady = true;
    try { request = await getDisposalRequest(requestId); } catch { schemaReady = false; }
    if (!request || !canManageAsset(user, request.facilityId)) {
      return (
        <div className="mx-auto max-w-2xl py-20 text-center text-[var(--muted)]">
          {schemaReady ? "ไม่พบคำขอหรือคุณไม่มีสิทธิ์เข้าถึง" : "ยังไม่ได้เปิดใช้คำขอจำหน่าย (ต้องรัน database/add_asset_lifecycle.sql)"} —{" "}
          <Link href="/disposal" className="text-[var(--primary)] hover:underline">กลับ</Link>
        </div>
      );
    }
    const isOwn = request.requestedByUserId !== null && Number(request.requestedByUserId) === Number(user.id);
    const pendingRequest = request.status === "Pending";
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
        <div>
          <nav className="mb-3 flex items-center gap-2 text-xs text-[var(--muted)]">
            <Link href="/disposal" className="hover:text-[var(--foreground)]">จำหน่าย/สูญหาย</Link><span>/</span><span>คำขอ #{request.id}</span>
          </nav>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="section-title text-3xl font-semibold">คำขอ{DISPOSAL_REQUEST_TYPE_LABELS[request.requestType]} #{request.id}</h1>
            <StatusBadge tone={DISPOSAL_STATUS_TONES[request.status]}>{DISPOSAL_STATUS_LABELS[request.status]}</StatusBadge>
          </div>
        </div>
        <section className="glass-panel grid gap-4 rounded-2xl p-6 text-sm sm:grid-cols-2">
          <div><p className="text-xs text-[var(--muted)]">ทรัพย์สิน</p><Link href={`/assets/${request.assetId}`} className="font-semibold hover:underline">{request.assetName}</Link><p className="font-mono text-xs text-[var(--muted)]">{request.assetRegistrationNo}</p></div>
          <div><p className="text-xs text-[var(--muted)]">หน่วยงาน</p><p className="font-semibold">{request.facilityName}</p></div>
          <div><p className="text-xs text-[var(--muted)]">วิธีการจำหน่าย</p><p>{request.requestType === "Lost" ? "จำหน่ายเป็นสูญ (สูญหาย)" : disposalMethodLabel(request.disposalMethod)}</p></div>
          <div><p className="text-xs text-[var(--muted)]">วันที่{request.requestType === "Lost" ? "ตรวจพบ" : "เสนอ"}</p><p>{formatThaiDate(request.eventDate)}</p></div>
          <div><p className="text-xs text-[var(--muted)]">ราคาทุน</p><p className="tabular-nums">{baht(request.purchasePrice)}</p></div>
          <div><p className="text-xs text-[var(--muted)]">มูลค่าสุทธิโดยประมาณ ณ วันที่เสนอ</p><p className="tabular-nums">{baht(request.bookValue)}</p></div>
          <div className="sm:col-span-2"><p className="text-xs text-[var(--muted)]">เหตุผล</p><p className="whitespace-pre-line">{request.reason}</p></div>
          <div><p className="text-xs text-[var(--muted)]">ผู้เสนอ</p><p>{request.requestedBy} · {formatThaiDateTime(request.requestedAt)}</p></div>
          {!pendingRequest && <div><p className="text-xs text-[var(--muted)]">ผู้พิจารณา</p><p>{request.decidedBy || "-"} · {formatThaiDateTime(request.decidedAt)}</p></div>}
          {request.approvalDocumentNo && <div><p className="text-xs text-[var(--muted)]">เลขที่หนังสืออนุมัติ</p><p>{request.approvalDocumentNo}</p></div>}
          {request.proceedsAmount !== null && <div><p className="text-xs text-[var(--muted)]">เงินที่ได้รับ</p><p className="tabular-nums">{baht(request.proceedsAmount)}</p></div>}
          {request.decisionNote && <div className="sm:col-span-2"><p className="text-xs text-[var(--muted)]">ความเห็นผู้พิจารณา</p><p className="whitespace-pre-line">{request.decisionNote}</p></div>}
        </section>
        {pendingRequest && canApprove && !isOwn && (
          <section className="glass-panel rounded-2xl p-6">
            <h2 className="mb-3 font-semibold">พิจารณาคำขอ</h2>
            <DisposalDecisionForm requestId={request.id} requestType={request.requestType} />
          </section>
        )}
        {pendingRequest && canApprove && isOwn && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">คุณเป็นผู้เสนอคำขอนี้ ต้องให้ผู้มีสิทธิ์อนุมัติคนอื่นพิจารณา</p>
        )}
        {pendingRequest && (isOwn || canApprove) && <div><CancelDisposalForm requestId={request.id} /></div>}
      </div>
    );
  }

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

    if (!canMutate || isTerminalAssetStatus(asset.currentStatus)) {
      return (
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6">
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-[var(--accent-strong)]">ATACS · จำหน่าย/ชำรุด/สูญหาย</p>
            <h1 className="section-title mt-1 text-3xl font-semibold">บันทึกการดำเนินการ</h1>
          </div>
          <div className="glass-panel rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            {canMutate ? "ทรัพย์สินนี้จำหน่ายหรือบันทึกสูญหายแล้ว" : "บัญชีของคุณไม่มีสิทธิ์บันทึกชำรุดหรือเสนอจำหน่าย"}
          </div>
        </div>
      );
    }
    const assetRequests = await listDisposalRequests({ assetId: asset.id, status: "Pending", limit: 1 });
    const pendingForAsset = assetRequests.rows[0];

    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6">
        <div>
          <nav className="flex items-center gap-2 text-xs text-[var(--muted)] mb-3">
            <Link href="/disposal" className="hover:text-[var(--foreground)]">จำหน่าย/ชำรุด/สูญหาย</Link>
            <span>/</span>
            <span>{asset.assetNumber}</span>
          </nav>
          <p className="text-xs font-semibold tracking-[0.12em] text-[var(--accent-strong)]">ATACS · จำหน่าย/ชำรุด/สูญหาย</p>
          <h1 className="section-title mt-1 text-3xl font-semibold">บันทึกการดำเนินการ</h1>
        </div>
        <div className="glass-panel rounded-2xl p-6">
          {pendingForAsset && (
            <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              มีคำขอ{DISPOSAL_REQUEST_TYPE_LABELS[pendingForAsset.requestType]}รออนุมัติ{" "}
              <Link href={`/disposal?requestId=${pendingForAsset.id}`} className="font-semibold underline">#{pendingForAsset.id}</Link>
            </p>
          )}
          <DisposalForm asset={asset} defaultType={readParam(params, "type")} hasPendingRequest={Boolean(pendingForAsset)} />
        </div>
      </div>
    );
  }

  // ── View: search ───────────────────────────────────────────────────────
  const [results, pendingList, decidedList] = await Promise.all([
    q ? listAssets({ search: q, facilityId: facilityScopeId }) : Promise.resolve([]),
    listDisposalRequests({ facilityIds: scopeIds, status: "Pending", limit: 200 }),
    listDisposalRequests({ facilityIds: scopeIds, limit: 30 }),
  ]);
  const decided = decidedList.rows.filter((row) => row.status !== "Pending");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6">
      <div>
        <p className="text-xs font-semibold tracking-[0.12em] text-[var(--accent-strong)]">ATACS · จำหน่าย/ชำรุด/สูญหาย</p>
        <h1 className="section-title mt-1 text-3xl font-semibold">จำหน่าย / ชำรุด / สูญหาย</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">ค้นหาทรัพย์สินที่ต้องการดำเนินการ</p>
      </div>

      {canMutate && <form method="GET" className="glass-panel flex gap-3 rounded-2xl p-4">
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
      </form>}

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

      {!q && canMutate && (
        <div className="glass-panel rounded-2xl p-10 text-center text-[var(--muted)]">
          <AppIcon name="clipboard-check" className="mx-auto mb-3 h-10 w-10 text-[var(--primary)]" />
          <p className="text-sm">ป้อนชื่อหรือรหัสทรัพย์สินเพื่อเริ่มต้น</p>
        </div>
      )}

      {!pendingList.schemaReady ? (
        <p className="glass-panel rounded-2xl p-5 text-sm text-amber-700">ยังไม่ได้เปิดใช้คำขอจำหน่ายแบบอนุมัติ (ต้องรัน database/add_asset_lifecycle.sql)</p>
      ) : (
        <>
          <section className="glass-panel overflow-hidden rounded-2xl">
            <div className="border-b border-black/6 px-5 py-3">
              <h2 className="font-semibold">คำขอรออนุมัติ <span className="ml-1 text-sm font-normal text-[var(--muted)]">{pendingList.rows.length} รายการ</span></h2>
              {canApprove && <p className="mt-0.5 text-xs text-[var(--muted)]">เลือกหมายเลขคำขอเพื่อพิจารณาอนุมัติหรือไม่อนุมัติ</p>}
            </div>
            <RequestTable rows={pendingList.rows} empty="ไม่มีคำขอรออนุมัติ" />
          </section>
          <section className="glass-panel overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b border-black/6 px-5 py-3">
              <h2 className="font-semibold">ผลการพิจารณาล่าสุด</h2>
              <Link href="/reports?view=disposal" className="text-xs font-medium text-[var(--primary)] hover:underline">ดูรายงาน</Link>
            </div>
            <RequestTable rows={decided} empty="ยังไม่มีผลการพิจารณา" />
          </section>
        </>
      )}
    </div>
  );
}
