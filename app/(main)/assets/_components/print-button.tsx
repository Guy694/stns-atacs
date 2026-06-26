"use client";

import { useState } from "react";

import { AppIcon } from "@/app/_components/ui/icon";

type QrDownloadButtonProps = {
  downloadUrl: string;
  filename: string;
};

export function QrDownloadButton({ downloadUrl, filename }: QrDownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  async function downloadQr() {
    setIsDownloading(true);
    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("ดาวน์โหลด QR Code ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={downloadQr}
      disabled={isDownloading}
      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <AppIcon name="download" className="h-4 w-4" /> {isDownloading ? "กำลังดาวน์โหลด" : "ดาวน์โหลด QR Code"}
    </button>
  );
}
