import { ROUTE_LOADING_ID } from "@/lib/splash";

// Shown while a page's data loads (also tells the splash screen the first page is not ready yet).
export default function Loading() {
  return (
    <div id={ROUTE_LOADING_ID} role="status" aria-live="polite" className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-sm text-[var(--muted)]">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-[var(--primary-soft-strong)] border-t-[var(--primary)]" aria-hidden="true" />
      กำลังโหลดข้อมูล…
    </div>
  );
}
