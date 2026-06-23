"use client";

import { AppIcon } from "@/app/_components/ui/icon";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--primary-hover)]"
    >
      <AppIcon name="file-text" className="h-4 w-4" /> พิมพ์ QR Code
    </button>
  );
}
