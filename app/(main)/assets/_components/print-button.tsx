"use client";

import { useState } from "react";

import { ActionIconButton } from "@/app/_components/ui/action-icon-button";

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
    <ActionIconButton
      icon={isDownloading ? "refresh" : "download"}
      tone="primary"
      label={isDownloading ? "กำลังดาวน์โหลด QR Code…" : "ดาวน์โหลด QR Code"}
      onClick={downloadQr}
      disabled={isDownloading}
      aria-busy={isDownloading}
    />
  );
}
