"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { assetIdFromScan } from "@/lib/asset-scan";

type Item = { assetId: number; number: string; name: string; status: "Pending" | "Found" | "Missing" };

type Detector = { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> };
type DetectorConstructor = new (options: { formats: string[] }) => Detector;

/**
 * Check-in by QR: scan with the page's camera (where the browser supports BarcodeDetector) or with the
 * phone's camera app — both open the asset page, which shows one-tap “found” buttons for this round.
 * Items can also be found by typing part of the asset number or name.
 */
export function ScanCheckIn({ items }: { items: Item[] }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [query, setQuery] = useState("");
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState("");
  const [supported, setSupported] = useState(false);

  // Decided after mount so the server and first client render match.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported("BarcodeDetector" in window && Boolean(navigator.mediaDevices?.getUserMedia));
  }, []);

  useEffect(() => {
    if (!scanning) return;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let cancelled = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const Detector = (window as unknown as { BarcodeDetector: DetectorConstructor }).BarcodeDetector;
        const detector = new Detector({ formats: ["qr_code"] });
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          const codes = await detector.detect(videoRef.current).catch(() => []);
          const id = codes.map((code) => assetIdFromScan(code.rawValue)).find((value) => value !== null);
          if (id) {
            if (items.some((item) => item.assetId === id)) {
              setScanning(false);
              router.push(`/assets/${id}#check-in-heading`);
              return;
            }
            setMessage("ครุภัณฑ์นี้ไม่อยู่ในรอบตรวจนับนี้");
          }
          timer = window.setTimeout(tick, 400);
        };
        tick();
      } catch {
        setMessage("เปิดกล้องไม่ได้ ใช้แอปกล้องของโทรศัพท์สแกน QR แทนได้");
        setScanning(false);
      }
    })();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [items, router, scanning]);

  const q = query.trim().toLowerCase();
  const matches = q.length >= 2
    ? items.filter((item) => item.number.toLowerCase().includes(q) || item.name.toLowerCase().includes(q)).slice(0, 8)
    : [];

  return (
    <section aria-labelledby="scan-heading" className="glass-panel rounded-2xl p-5">
      <h2 id="scan-heading" className="font-semibold text-[var(--foreground)]">ตรวจนับด้วย QR</h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        สแกน QR บนครุภัณฑ์ด้วยกล้องโทรศัพท์ ระบบจะเปิดหน้าครุภัณฑ์พร้อมปุ่ม “พบ” ของรอบนี้ หรือค้นหาจากเลขครุภัณฑ์ด้านล่าง
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        {supported && (
          <button type="button" onClick={() => { setMessage(""); setScanning((value) => !value); }}
            className="min-h-11 shrink-0 rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white hover:opacity-90">
            {scanning ? "ปิดกล้อง" : "สแกนด้วยกล้องในหน้านี้"}
          </button>
        )}
        <label className="min-w-0 flex-1 text-sm">
          <span className="sr-only">ค้นหาเลขครุภัณฑ์หรือชื่อ</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="พิมพ์เลขครุภัณฑ์หรือชื่อ อย่างน้อย 2 ตัวอักษร"
            className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm" />
        </label>
      </div>
      {scanning && <video ref={videoRef} muted playsInline className="mt-3 aspect-video w-full max-w-md rounded-xl bg-black object-cover" aria-label="ภาพจากกล้องสำหรับสแกน QR" />}
      {message && <p role="status" className="mt-2 text-sm text-amber-700">{message}</p>}
      {matches.length > 0 && (
        <ul className="mt-3 divide-y divide-black/5 rounded-xl border border-[var(--line)] bg-white">
          {matches.map((item) => (
            <li key={item.assetId}>
              <Link href={`/assets/${item.assetId}#check-in-heading`} className="flex min-h-11 items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-[var(--primary-soft)]">
                <span className="min-w-0"><span className="font-mono text-xs text-[var(--muted)]">{item.number || "-"}</span> <span className="block truncate">{item.name}</span></span>
                <span className="shrink-0 text-xs text-[var(--muted)]">{item.status === "Pending" ? "รอตรวจ" : item.status === "Found" ? "พบแล้ว" : "ไม่พบ"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {q.length >= 2 && matches.length === 0 && <p className="mt-2 text-sm text-[var(--muted)]">ไม่พบรายการในรอบนี้</p>}
    </section>
  );
}
