"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useSyncExternalStore } from "react";

import { AppIcon, type IconName } from "@/app/_components/ui/icon";

/**
 * Toast แจ้งผลสั้น ๆ (หายเองใน ~3.5 วินาที)
 *
 * ใช้จาก client component:  `import { toast } from "@/app/_components/ui/toast"; toast.success("บันทึกแล้ว");`
 * มี <Toaster /> วางไว้ครั้งเดียวใน app/(main)/layout.tsx
 *
 * Server action ที่ redirect ต่อ ให้เติม query `?toast=<key>` ใน URL ปลายทาง แล้วหน้านั้นจะแสดง toast
 * และลบ `toast` ออกจาก URL (history.replaceState) เพื่อไม่ให้แสดงซ้ำเมื่อรีเฟรช คีย์ที่รองรับ:
 *   saved    → "บันทึกข้อมูลแล้ว"
 *   created  → "เพิ่มข้อมูลแล้ว"
 *   updated  → "แก้ไขข้อมูลแล้ว"
 *   deleted  → "ลบข้อมูลแล้ว"
 *   sent     → "ส่งข้อมูลแล้ว"
 *   approved → "อนุมัติแล้ว"
 * คีย์อื่นจะถูกละเลย (ไม่แสดงข้อความจาก URL ตรง ๆ เพื่อกันการปลอมข้อความ)
 */
export const URL_TOASTS: Record<string, { tone: ToastTone; message: string }> = {
  saved: { tone: "success", message: "บันทึกข้อมูลแล้ว" },
  created: { tone: "success", message: "เพิ่มข้อมูลแล้ว" },
  updated: { tone: "success", message: "แก้ไขข้อมูลแล้ว" },
  deleted: { tone: "success", message: "ลบข้อมูลแล้ว" },
  sent: { tone: "success", message: "ส่งข้อมูลแล้ว" },
  approved: { tone: "success", message: "อนุมัติแล้ว" },
};

export type ToastTone = "success" | "error" | "info";
type ToastItem = { id: number; tone: ToastTone; message: string };

const DURATION_MS = 3500;
const MAX_VISIBLE = 4;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function emit() {
  for (const listener of listeners) listener();
}

function dismiss(id: number) {
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
  items = items.filter((item) => item.id !== id);
  emit();
}

function push(tone: ToastTone, message: string) {
  const id = nextId++;
  items = [...items, { id, tone, message }].slice(-MAX_VISIBLE);
  timers.set(id, setTimeout(() => dismiss(id), DURATION_MS));
  emit();
  return id;
}

export const toast = {
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message),
  info: (message: string) => push("info", message),
  dismiss,
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const EMPTY: ToastItem[] = [];

const TONE: Record<ToastTone, { icon: IconName; className: string }> = {
  success: { icon: "check", className: "border-[var(--state-success-border)] bg-[var(--state-success-bg)] text-[var(--state-success-fg)]" },
  error: { icon: "close", className: "border-[var(--state-danger-border)] bg-[var(--state-danger-bg)] text-[var(--state-danger-fg)]" },
  info: { icon: "activity", className: "border-[var(--state-info-border)] bg-[var(--state-info-bg)] text-[var(--state-info-fg)]" },
};

/** Reads `?toast=<key>` once per navigation, shows it, then removes it from the address bar. */
function UrlToast() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const key = searchParams.get("toast");

  useEffect(() => {
    if (!key) return;
    const entry = URL_TOASTS[key];
    if (entry) push(entry.tone, entry.message);
    const url = new URL(window.location.href);
    url.searchParams.delete("toast");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [key, pathname]);

  return null;
}

export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => items, () => EMPTY);

  return (
    <>
      {/* useSearchParams needs its own Suspense boundary so it never suspends the page shell. */}
      <Suspense fallback={null}>
        <UrlToast />
      </Suspense>
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[45] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:items-end lg:bottom-6 lg:right-6"
      >
        {list.map((item) => (
          <div
            key={item.id}
            className={`atacs-toast pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${TONE[item.tone].className}`}
          >
            <AppIcon name={TONE[item.tone].icon} className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="min-w-0 flex-1 leading-6">{item.message}</p>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="ปิดข้อความแจ้งเตือน"
              className="-my-1 -mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg opacity-70 transition hover:bg-black/5 hover:opacity-100"
            >
              <AppIcon name="close" className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
