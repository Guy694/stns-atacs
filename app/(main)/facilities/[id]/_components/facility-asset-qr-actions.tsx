"use client";

import { useEffect, useMemo, useState } from "react";

import { AppIcon } from "@/app/_components/ui/icon";

type AssetQrItem = {
  id: number;
  assetRegistrationNo: string;
  assetName: string;
};

type FacilityAssetQrActionsProps = {
  assets: AssetQrItem[];
  facilityName: string;
};

function sanitizeDownloadName(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 100);
}

export function FacilityAssetQrActions({ assets, facilityName }: FacilityAssetQrActionsProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>(() => assets.map((asset) => asset.id));

  const selectedAssets = useMemo(() => {
    const selected = new Set(selectedIds);
    return assets.filter((asset) => selected.has(asset.id));
  }, [assets, selectedIds]);

  useEffect(() => {
    if (!isPickerOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsPickerOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isPickerOpen]);

  if (assets.length === 0) return null;

  function toggleAsset(id: number) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  async function downloadAssets(items: AssetQrItem[]) {
    if (items.length === 0) return;

    setIsDownloading(true);
    try {
      const response = await fetch("/api/qr/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: items.map((asset) => asset.id),
          filename: `atacs-qr-${sanitizeDownloadName(facilityName) || "assets"}`,
        }),
      });

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `atacs-qr-${sanitizeDownloadName(facilityName) || "assets"}.zip`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setIsPickerOpen(false);
    } catch {
      alert("ดาวน์โหลด QR Code ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => downloadAssets(assets)}
          disabled={isDownloading}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--primary-soft-strong)] bg-[var(--primary-soft)] px-4 py-2 text-xs font-semibold text-[var(--primary-text)] transition hover:bg-[var(--primary-soft-strong)]"
        >
          <AppIcon name="download" className="h-4 w-4" /> {isDownloading ? "กำลังดาวน์โหลด" : "ดาวน์โหลด QR ทั้งหมด"}
        </button>
        <button
          type="button"
          onClick={() => setIsPickerOpen(true)}
          disabled={isDownloading}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-black/10 bg-white/85 px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-white"
        >
          <AppIcon name="check" className="h-4 w-4" /> เลือกดาวน์โหลด QR
        </button>
      </div>

      {isPickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="asset-qr-picker-title"
        >
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-[var(--surface-strong)] shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-black/8 px-5 py-4">
              <div>
                <h3 id="asset-qr-picker-title" className="text-base font-semibold text-[var(--foreground)]">
                  เลือกรายการสำหรับดาวน์โหลด QR Code
                </h3>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  เลือกแล้ว {selectedAssets.length.toLocaleString("th-TH")} จาก {assets.length.toLocaleString("th-TH")} รายการ
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPickerOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white text-[var(--muted)] hover:bg-[var(--neutral-bg)]"
                aria-label="ปิดหน้าต่างเลือก QR Code"
              >
                <AppIcon name="close" className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-black/8 bg-[var(--neutral-bg)]/70 px-5 py-3">
              <button
                type="button"
                onClick={() => setSelectedIds(assets.map((asset) => asset.id))}
                className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-medium text-[var(--foreground)] hover:bg-white/80"
              >
                เลือกทั้งหมด
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-medium text-[var(--muted)] hover:bg-white/80"
              >
                ล้างรายการ
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
              <div className="divide-y divide-black/6">
                {assets.map((asset) => (
                  <label key={asset.id} className="flex cursor-pointer items-start gap-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(asset.id)}
                      onChange={() => toggleAsset(asset.id)}
                      className="mt-1 h-4 w-4 rounded border-black/20 text-[var(--primary)] focus:ring-[var(--focus-ring)]"
                    />
                    <span className="min-w-0">
                      <span className="block font-mono text-xs font-semibold text-[var(--accent-strong)]">
                        {asset.assetRegistrationNo || `#${asset.id}`}
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-[var(--foreground)]">{asset.assetName}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-black/8 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsPickerOpen(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-[var(--muted)] hover:bg-[var(--neutral-bg)]"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => downloadAssets(selectedAssets)}
                disabled={selectedAssets.length === 0 || isDownloading}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <AppIcon name="download" className="h-4 w-4" /> {isDownloading ? "กำลังดาวน์โหลด" : "ดาวน์โหลด QR ที่เลือก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
