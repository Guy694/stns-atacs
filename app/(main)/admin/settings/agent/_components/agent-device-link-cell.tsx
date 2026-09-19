"use client";

import { useState, useTransition } from "react";

import { linkAgentDeviceAction } from "@/app/(main)/admin/settings/agent/actions";
import type { AssetSelectOption } from "@/lib/assets";

type Props = {
  deviceId: number;
  facilityId: number;
  linkedAssetId: number | null;
  linkedAssetName: string | null;
  linkedAssetRegistrationNo: string | null;
  assets: AssetSelectOption[];
};

export function AgentDeviceLinkCell({
  deviceId,
  facilityId,
  linkedAssetId,
  linkedAssetName,
  linkedAssetRegistrationNo,
  assets,
}: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();

  const facilityAssets = assets.filter((a) => a.facilityId === facilityId);
  const filtered = search.trim()
    ? facilityAssets.filter(
        (a) =>
          a.assetName.toLowerCase().includes(search.toLowerCase()) ||
          a.assetRegistrationNo.toLowerCase().includes(search.toLowerCase()) ||
          (a.serialNumber ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : facilityAssets;

  function handleSelect(assetId: number | null) {
    const fd = new FormData();
    fd.set("deviceId", String(deviceId));
    if (assetId !== null) fd.set("assetId", String(assetId));
    setError(null);
    startTransition(async () => {
      try {
        const result = await linkAgentDeviceAction(fd);
        if (result?.error) setError(result.error);
        else setOpen(false);
      } catch {
        setError("ไม่สามารถเชื่อม Agent ได้ กรุณาลองใหม่");
      }
    });
  }

  return (
    <td className="px-4 py-3">
      {linkedAssetId ? (
        <div>
          <p className="font-medium">{linkedAssetName ?? "Asset linked"}</p>
          <p className="font-mono text-xs text-[var(--muted)]">{linkedAssetRegistrationNo ?? `#${linkedAssetId}`}</p>
          <button
            type="button"
            onClick={() => { setSearch(""); setOpen(true); }}
            className="mt-1 text-xs text-[var(--accent)] underline-offset-2 hover:underline"
          >
            เปลี่ยน
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { setSearch(""); setOpen(true); }}
          className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-2.5 py-1 text-xs font-medium text-[var(--accent)] transition hover:bg-[var(--accent)]/10"
        >
          ผูก Asset
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="glass-panel w-full max-w-lg rounded-2xl p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">ผูก Agent Device กับ Asset</h3>
                <p className="mt-0.5 text-sm text-[var(--muted)]">เลือก asset ที่ตรงกับเครื่องนี้</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-0.5 rounded-lg p-1.5 text-[var(--muted)] hover:bg-black/6"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>

            {error && <p role="alert" className="mb-3 text-sm text-rose-700">{error}</p>}
            <input
              type="text"
              placeholder="ค้นหาชื่อ, รหัส, S/N..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              autoFocus
            />

            <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-black/8">
              {filtered.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-[var(--muted)]">
                  {facilityAssets.length === 0 ? "หน่วยงานนี้ยังไม่มี asset ในระบบ" : "ไม่พบ asset ที่ตรงกับคำค้น"}
                </p>
              ) : (
                filtered.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    disabled={pending}
                    onClick={() => handleSelect(asset.id)}
                    className={`flex w-full items-start gap-3 border-b border-black/6 px-4 py-3 text-left transition last:border-0 hover:bg-white/60 ${asset.id === linkedAssetId ? "bg-[var(--accent)]/6" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{asset.assetName}</p>
                      <p className="mt-0.5 font-mono text-xs text-[var(--muted)]">
                        {asset.assetRegistrationNo}
                        {asset.deviceType ? ` · ${asset.deviceType}` : ""}
                        {asset.serialNumber ? ` · S/N ${asset.serialNumber}` : ""}
                      </p>
                    </div>
                    {asset.id === linkedAssetId && (
                      <span className="mt-0.5 shrink-0 rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--accent)]">ผูกอยู่</span>
                    )}
                  </button>
                ))
              )}
            </div>

            {linkedAssetId && (
              <button
                type="button"
                disabled={pending}
                onClick={() => handleSelect(null)}
                className="mt-3 w-full rounded-xl border border-rose-200 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
              >
                ยกเลิกการผูก asset
              </button>
            )}

            {pending && (
              <p className="mt-3 text-center text-sm text-[var(--muted)]">กำลังบันทึก...</p>
            )}
          </div>
        </div>
      )}
    </td>
  );
}
