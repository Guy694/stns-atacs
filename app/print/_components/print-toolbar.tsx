"use client";

import Link from "next/link";

/** Screen-only toolbar above a printable document. */
export function PrintToolbar({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-2 print:hidden">
      <Link href={backHref} className="text-sm text-[var(--primary-text)] hover:underline">← {backLabel}</Link>
      <button type="button" onClick={() => window.print()} className="min-h-11 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--primary-hover)]">
        พิมพ์ / บันทึกเป็น PDF
      </button>
    </div>
  );
}
