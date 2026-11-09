"use client";

import Link from "next/link";

import { AppIcon } from "@/app/_components/ui/icon";

/** Screen-only toolbar above a printable document. */
export function PrintToolbar({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-2 print:hidden">
      <Link href={backHref} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-[var(--primary-text)] hover:underline"><AppIcon name="arrow-left" size={16} /> {backLabel}</Link>
      {/* Printing is the main task of these pages, so it stays a labelled primary button. */}
      <button type="button" onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[var(--primary-hover)]">
        <AppIcon name="printer" size={16} /> พิมพ์ / บันทึกเป็น PDF
      </button>
    </div>
  );
}
