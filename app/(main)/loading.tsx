import { ROUTE_LOADING_ID } from "@/lib/splash";

function Block({ className = "" }: { className?: string }) {
  return <div className={`skeleton-block rounded-xl ${className}`} />;
}

// Shown while a page's data loads (also tells the splash screen the first page is not ready yet).
// Skeleton blocks shaped like a typical page: heading, summary cards, then a table panel.
export default function Loading() {
  return (
    <div id={ROUTE_LOADING_ID} role="status" aria-live="polite" className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
      <span className="sr-only">กำลังโหลดข้อมูล…</span>
      <div aria-hidden="true" className="glass-panel rounded-2xl p-5">
        <Block className="h-4 w-28" />
        <Block className="mt-3 h-7 w-2/3 max-w-md" />
        <Block className="mt-3 h-4 w-full max-w-xl" />
      </div>
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="glass-panel rounded-2xl p-5">
            <Block className="h-3.5 w-24" />
            <Block className="mt-3 h-8 w-20" />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="glass-panel rounded-2xl p-5">
        <Block className="h-10 w-full max-w-sm" />
        <div className="mt-5 space-y-3">
          {[0, 1, 2, 3, 4].map((index) => (
            <Block key={index} className="h-11 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
