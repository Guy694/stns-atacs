"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { AppIcon } from "@/app/_components/ui/icon";
import { QR_SCANNER_MESSAGES, cameraAvailable, useQrScanner } from "@/app/_components/ui/use-qr-scanner";
import { scanTarget } from "@/lib/asset-scan";

export function QrScannerPanel({ searchPath }: { searchPath: string }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");

  const status = useQrScanner({
    active,
    videoRef,
    onCode: (text) => {
      const target = scanTarget(text, searchPath);
      if (target.kind === "unknown") {
        setMessage("QR นี้ไม่ใช่สติ๊กเกอร์ครุภัณฑ์ของระบบ ลองสแกนใหม่");
        return;
      }
      try { navigator.vibrate?.(80); } catch { /* not supported */ }
      setActive(false);
      setMessage(target.kind === "asset" ? "พบครุภัณฑ์ กำลังเปิดข้อมูล…" : `กำลังค้นหา “${target.query}”…`);
      router.push(target.href);
    },
  });

  const statusMessage = QR_SCANNER_MESSAGES[status];
  const scanning = status === "scanning" || status === "starting";

  function start() {
    setMessage("");
    if (!cameraAvailable()) {
      setMessage(QR_SCANNER_MESSAGES.unavailable ?? "");
      return;
    }
    setActive(true);
  }

  function search(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    const target = scanTarget(value, searchPath);
    router.push(target.kind === "unknown" ? `${searchPath}?search=${encodeURIComponent(value)}` : target.href);
  }

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="camera-heading" className="glass-panel rounded-2xl p-4 sm:p-5">
        <h2 id="camera-heading" className="sr-only">กล้องสแกน QR</h2>
        <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-slate-900">
          <video
            ref={videoRef}
            muted
            playsInline
            aria-label="ภาพจากกล้องสำหรับสแกน QR"
            className={`h-full w-full object-cover ${active ? "" : "hidden"}`}
          />
          {!active && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-slate-200">
              <AppIcon name="qr" aria-hidden="true" className="h-14 w-14 opacity-80" />
              <p className="text-sm">กดปุ่มด้านล่างเพื่อเปิดกล้อง แล้วหันไปที่สติ๊กเกอร์ QR บนครุภัณฑ์</p>
            </div>
          )}
          {active && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-[14%] rounded-2xl border-4 border-white/85 shadow-[0_0_0_9999px_rgba(15,23,42,0.35)]" />
          )}
        </div>

        <div className="mt-4 flex flex-col items-center gap-2">
          {scanning ? (
            <button type="button" onClick={() => setActive(false)} className="secondary-action w-full max-w-sm">
              ปิดกล้อง
            </button>
          ) : (
            <button type="button" onClick={start} className="primary-action w-full max-w-sm" data-autofocus>
              <AppIcon name="qr" aria-hidden="true" className="h-5 w-5" /> เปิดกล้องสแกน
            </button>
          )}
          <p role="status" aria-live="polite" className="min-h-5 text-center text-sm text-[var(--muted)]">
            {message || (status === "scanning" ? "กำลังสแกน… ถือให้ QR อยู่ในกรอบ" : statusMessage ?? "")}
          </p>
        </div>
      </section>

      <section aria-labelledby="manual-heading" className="glass-panel rounded-2xl p-4 sm:p-5">
        <h2 id="manual-heading" className="text-sm font-semibold text-[var(--foreground)]">สแกนไม่ได้? พิมพ์เลขครุภัณฑ์</h2>
        <form onSubmit={search} className="mt-2 flex flex-col gap-2 sm:flex-row">
          <label className="min-w-0 flex-1">
            <span className="sr-only">เลขครุภัณฑ์ ชื่อ หรือ Serial Number</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="เลขครุภัณฑ์ ชื่อ หรือ Serial Number"
              className="filter-control w-full"
              inputMode="search"
              enterKeyHint="search"
            />
          </label>
          <button type="submit" className="secondary-action">ค้นหา</button>
        </form>
        <p className="mt-2 text-xs text-[var(--muted)]">
          ใช้แอปกล้องของโทรศัพท์สแกนสติ๊กเกอร์ก็ได้ ระบบจะเปิดหน้าครุภัณฑ์เดียวกัน{" "}
          <Link href="/manuals" className="font-semibold text-[var(--primary-text)] underline underline-offset-2">ดูคู่มือ</Link>
        </p>
      </section>
    </div>
  );
}
