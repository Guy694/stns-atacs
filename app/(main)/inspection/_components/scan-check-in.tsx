"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { assetIdFromScan } from "@/lib/asset-scan";
import { withBasePath } from "@/lib/base-path";
import { ASSET_STATUS_LABELS, OPERATIONAL_ASSET_STATUSES } from "@/lib/asset-status";
import {
  enqueueResult,
  OFFLINE_BATCH_LIMIT,
  parseQueue,
  queueStorageKey,
  remainingAfterSync,
  type QueuedResult,
  type SyncOutcome,
} from "@/lib/offline-inspection";
import { confirmAction } from "@/app/_components/ui/confirm";
import { ActionIconButton } from "@/app/_components/ui/action-icon-button";
import { AppIcon } from "@/app/_components/ui/icon";
import { QR_SCANNER_MESSAGES, cameraAvailable, useQrScanner } from "@/app/_components/ui/use-qr-scanner";

type Item = { itemId: number; assetId: number; number: string; name: string; status: "Pending" | "Found" | "Missing"; currentStatus: string };
type WorkGroup = { id: number; workGroupName: string };


function readQueue(inspectionId: number) {
  try {
    return parseQueue(window.localStorage.getItem(queueStorageKey(inspectionId)));
  } catch {
    return [];
  }
}

function writeQueue(inspectionId: number, queue: QueuedResult[]) {
  try {
    if (queue.length) window.localStorage.setItem(queueStorageKey(inspectionId), JSON.stringify(queue));
    else window.localStorage.removeItem(queueStorageKey(inspectionId));
    return true;
  } catch {
    return false;
  }
}

function newClientId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Check-in by QR.
 * - Normal: scan with the page camera (BarcodeDetector or jsQR) or the phone camera app → the asset page
 *   shows the “found” buttons for this round.
 * - Continuous / offline: each scan (or tap on a search result) is recorded as “found” at once and kept in this
 *   browser; results are sent automatically when the connection is back, so an area without signal can be
 *   counted as long as this page was opened beforehand.
 */
export function ScanCheckIn({ inspectionId, items, workGroups }: { inspectionId: number; items: Item[]; workGroups: WorkGroup[] }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const syncing = useRef(false);
  const [query, setQuery] = useState("");
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState("");
  const [supported, setSupported] = useState(false);
  const [quick, setQuick] = useState(false);
  const [online, setOnline] = useState(true);
  const [queue, setQueue] = useState<QueuedResult[]>([]);
  const [failed, setFailed] = useState<Array<SyncOutcome & { label: string }>>([]);
  const [foundGroup, setFoundGroup] = useState("");
  const [condition, setCondition] = useState("");
  const [stored, setStored] = useState(true);
  const [blocked, setBlocked] = useState(false);

  const labelOf = useCallback((itemId: number) => {
    const item = items.find((entry) => entry.itemId === itemId);
    return item ? `${item.number || "-"} ${item.name}` : `รายการ #${itemId}`;
  }, [items]);

  const sync = useCallback(async () => {
    if (syncing.current) return;
    const pending = readQueue(inspectionId);
    if (!pending.length || !navigator.onLine) return;
    syncing.current = true;
    let rest = pending;
    let savedTotal = 0;
    try {
      for (let start = 0; start < pending.length; start += OFFLINE_BATCH_LIMIT) {
        const batch = pending.slice(start, start + OFFLINE_BATCH_LIMIT);
        const response = await fetch(withBasePath(`/api/inspection/${inspectionId}/results/`), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ results: batch }),
          credentials: "same-origin",
        });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
          setMessage("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่ — ผลที่สแกนยังเก็บอยู่ในเครื่องนี้");
          break;
        }
        if (!response.ok) {
          setMessage(data.error || "ส่งผลตรวจไม่สำเร็จ จะลองใหม่อัตโนมัติ");
          // Closed round / no permission: retrying will not help, let the user clear the queue.
          if (response.status === 403 || response.status === 409) setBlocked(true);
          break;
        }
        const outcomes = (data.results ?? []) as SyncOutcome[];
        rest = remainingAfterSync(rest, outcomes);
        savedTotal += outcomes.filter((outcome) => outcome.ok).length;
        const finalFailures = outcomes.filter((outcome) => !outcome.ok && outcome.code !== "retry");
        if (finalFailures.length) setFailed((current) => [...current, ...finalFailures.map((outcome) => ({ ...outcome, label: labelOf(outcome.itemId) }))]);
      }
    } catch {
      setMessage("ยังไม่มีสัญญาณ ผลที่สแกนเก็บไว้ในเครื่อง จะส่งให้อัตโนมัติเมื่อกลับมาออนไลน์");
    } finally {
      // Remove only the entries that were settled; scans made while the request was running stay queued.
      const keep = new Set(rest.map((entry) => entry.clientId));
      const settled = new Set(pending.filter((entry) => !keep.has(entry.clientId)).map((entry) => entry.clientId));
      const next = readQueue(inspectionId).filter((entry) => !settled.has(entry.clientId));
      writeQueue(inspectionId, next);
      setQueue(next);
      syncing.current = false;
    }
    if (savedTotal) {
      setMessage(`ส่งผลตรวจแล้ว ${savedTotal.toLocaleString("th-TH")} รายการ`);
      router.refresh();
    }
  }, [inspectionId, labelOf, router]);

  // Decided after mount so the server and first client render match.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setSupported(cameraAvailable());
    setOnline(navigator.onLine);
    const saved = readQueue(inspectionId);
    setQueue(saved);
    if (saved.length) setQuick(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    const goOnline = () => { setOnline(true); void sync(); };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    void sync();
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [inspectionId, sync]);

  // Retry regularly: "online" is not always reported when a weak signal comes back.
  useEffect(() => {
    const timer = window.setInterval(() => void sync(), 20000);
    return () => window.clearInterval(timer);
  }, [sync]);

  const record = useCallback((item: Item) => {
    const entry: QueuedResult = {
      clientId: newClientId(),
      itemId: item.itemId,
      assetId: item.assetId,
      inspectionStatus: "Found",
      assetStatus: condition,
      ...(foundGroup ? { foundWorkGroupId: Number(foundGroup) } : {}),
      scannedAt: new Date().toISOString(),
    };
    const next = enqueueResult(readQueue(inspectionId), entry);
    setStored(writeQueue(inspectionId, next));
    setQueue(next);
    setMessage(`บันทึก “พบ”: ${item.number || "-"} ${item.name}${navigator.onLine ? "" : " (เก็บไว้ในเครื่อง)"}`);
    try { navigator.vibrate?.(80); } catch { /* not supported */ }
    if (navigator.onLine) void sync();
  }, [condition, foundGroup, inspectionId, sync]);

  // The camera loop reads the latest values through a ref: depending on them directly restarted the
  // camera (getUserMedia again, flicker, possibly a new permission prompt) after every synced scan.
  const latest = useRef({ items, quick, record, router });
  useEffect(() => {
    latest.current = { items, quick, record, router };
  }, [items, quick, record, router]);

  // Camera scanning (BarcodeDetector, or jsQR on iPhone/Safari) via the shared hook.
  const cameraStatus = useQrScanner({
    active: scanning,
    videoRef,
    onCode: (text) => {
      const id = assetIdFromScan(text);
      if (!id) return;
      const current = latest.current;
      const item = current.items.find((entry) => entry.assetId === id);
      if (!item) {
        setMessage("ครุภัณฑ์นี้ไม่อยู่ในรอบตรวจนับนี้");
      } else if (current.quick) {
        current.record(item);
      } else {
        setScanning(false);
        current.router.push(`/assets/${id}/#check-in-heading`);
      }
    },
  });
  const cameraMessage = cameraStatus === "denied" || cameraStatus === "unavailable" || cameraStatus === "error"
    ? (quick ? "เปิดกล้องไม่ได้ ค้นหาจากเลขครุภัณฑ์แล้วกด “พบ” แทนได้" : QR_SCANNER_MESSAGES[cameraStatus])
    : "";

  const queuedIds = new Set(queue.map((entry) => entry.itemId));
  const q = query.trim().toLowerCase();
  const matches = q.length >= 2
    ? items.filter((item) => item.number.toLowerCase().includes(q) || item.name.toLowerCase().includes(q)).slice(0, 8)
    : [];
  const statusText = (item: Item) => (queuedIds.has(item.itemId) ? "รอส่ง" : item.status === "Pending" ? "รอตรวจ" : item.status === "Found" ? "พบแล้ว" : "ไม่พบ");

  return (
    <section aria-labelledby="scan-heading" className="glass-panel rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="scan-heading" className="font-semibold text-[var(--foreground)]">ตรวจนับด้วย QR</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {quick
              ? "โหมดสแกนต่อเนื่อง: สแกนหรือกด “พบ” แล้วบันทึกทันที ใช้ได้แม้ไม่มีสัญญาณ (เปิดหน้านี้ไว้ก่อนเข้าพื้นที่) ผลจะส่งอัตโนมัติเมื่อออนไลน์"
              : "สแกน QR บนครุภัณฑ์ด้วยกล้องโทรศัพท์ ระบบจะเปิดหน้าครุภัณฑ์พร้อมปุ่ม “พบ” ของรอบนี้ หรือค้นหาจากเลขครุภัณฑ์ด้านล่าง"}
          </p>
        </div>
        <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-medium">
          <input type="checkbox" checked={quick} onChange={(event) => { setQuick(event.target.checked); setMessage(""); }} className="h-4 w-4" />
          สแกนต่อเนื่อง / ออฟไลน์
        </label>
      </div>

      {(quick || queue.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" role="status">
          <span className={`rounded-full px-2.5 py-1 font-semibold ${online ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
            {online ? "ออนไลน์" : "ออฟไลน์"}
          </span>
          <span className="rounded-full bg-[var(--neutral-bg)] px-2.5 py-1">รอส่ง {queue.length.toLocaleString("th-TH")} รายการ</span>
          {queue.length > 0 && online && (
            <button type="button" onClick={() => void sync()} className="secondary-action action-sm gap-1.5">
              <AppIcon name="upload" className="h-4 w-4" /> ส่งตอนนี้
            </button>
          )}
          {blocked && queue.length > 0 && (
            <ActionIconButton icon="trash" tone="danger" label="ล้างรายการที่รอส่ง" onClick={async () => {
              const confirmed = await confirmAction({
                title: `ล้างรายการที่รอส่ง ${queue.length.toLocaleString("th-TH")} รายการ?`,
                text: "ผลสแกนที่ยังไม่ได้ส่งเข้าระบบจะหายไป ต้องสแกนใหม่",
                confirmText: "ล้างรายการ",
                danger: true,
              });
              if (!confirmed) return;
              writeQueue(inspectionId, []); setQueue([]); setBlocked(false); setMessage("ล้างรายการที่รอส่งแล้ว");
            }} />
          )}
          {!stored && <span className="text-red-700">เบราว์เซอร์นี้เก็บข้อมูลในเครื่องไม่ได้ (โหมดส่วนตัว?) ต้องมีสัญญาณขณะสแกน</span>}
        </div>
      )}

      {quick && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-xs font-medium text-[var(--muted)]">พบที่กลุ่มงาน (ใช้กับทุกรายการที่สแกนต่อจากนี้)</span>
            <select value={foundGroup} onChange={(event) => setFoundGroup(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm">
              <option value="">ตามทะเบียน (ไม่บันทึกที่ตั้งใหม่)</option>
              {workGroups.map((group) => <option key={group.id} value={group.id}>{group.workGroupName}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-xs font-medium text-[var(--muted)]">สภาพที่พบ</span>
            <select value={condition} onChange={(event) => setCondition(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm">
              <option value="">คงสถานะเดิม</option>
              {OPERATIONAL_ASSET_STATUSES.map((status) => <option key={status} value={status}>{ASSET_STATUS_LABELS[status]}</option>)}
            </select>
          </label>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        {supported && (
          scanning ? (
            <ActionIconButton icon="close" label="ปิดกล้อง" onClick={() => { setMessage(""); setScanning(false); }} />
          ) : (
            <button type="button" onClick={() => { setMessage(""); setScanning(true); }} className="primary-action shrink-0">
              <AppIcon name="qr" className="h-4 w-4" /> สแกนด้วยกล้องในหน้านี้
            </button>
          )
        )}
        <label className="min-w-0 flex-1 text-sm">
          <span className="sr-only">ค้นหาเลขครุภัณฑ์หรือชื่อ</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="พิมพ์เลขครุภัณฑ์หรือชื่อ อย่างน้อย 2 ตัวอักษร"
            className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm" />
        </label>
      </div>
      {quick && !supported && (
        <p className="mt-2 text-xs text-[var(--muted)]">เบราว์เซอร์นี้เปิดกล้องในหน้าไม่ได้ (ต้องเข้าผ่าน https) — ค้นหาจากเลขครุภัณฑ์บนสติ๊กเกอร์แล้วกด “พบ”</p>
      )}
      {scanning && <video ref={videoRef} muted playsInline className="mt-3 aspect-video w-full max-w-md rounded-xl bg-black object-cover" aria-label="ภาพจากกล้องสำหรับสแกน QR" />}
      {(message || cameraMessage) && <p role="status" className="mt-2 text-sm text-amber-700">{message || cameraMessage}</p>}
      {matches.length > 0 && (
        <ul className="mt-3 divide-y divide-black/5 rounded-xl border border-[var(--line)] bg-white">
          {matches.map((item) => (
            <li key={item.itemId} className="flex min-h-11 items-center justify-between gap-3 px-3 py-2 text-sm">
              {quick ? (
                <>
                  <span className="min-w-0"><span className="font-mono text-xs text-[var(--muted)]">{item.number || "-"}</span> <span className="block truncate">{item.name}</span></span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-[var(--muted)]">{statusText(item)}</span>
                    <button type="button" onClick={() => record(item)} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white transition hover:bg-emerald-800"><AppIcon name="check" className="h-3.5 w-3.5" /> พบ</button>
                  </span>
                </>
              ) : (
                <Link href={`/assets/${item.assetId}#check-in-heading`} className="-mx-3 -my-2 flex min-h-11 flex-1 items-center justify-between gap-3 px-3 py-2 hover:bg-[var(--primary-soft)]">
                  <span className="min-w-0"><span className="font-mono text-xs text-[var(--muted)]">{item.number || "-"}</span> <span className="block truncate">{item.name}</span></span>
                  <span className="shrink-0 text-xs text-[var(--muted)]">{statusText(item)}</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      {q.length >= 2 && matches.length === 0 && <p className="mt-2 text-sm text-[var(--muted)]">ไม่พบรายการในรอบนี้</p>}

      {failed.length > 0 && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-semibold">บันทึกไม่ได้ {failed.length.toLocaleString("th-TH")} รายการ (ตรวจในตารางด้านล่างแทน)</p>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {failed.slice(0, 10).map((entry) => <li key={entry.clientId}>{entry.label}: {entry.error}</li>)}
          </ul>
          <ActionIconButton icon="close" label="ปิดรายการที่บันทึกไม่ได้" onClick={() => setFailed([])} className="mt-2" />
        </div>
      )}
    </section>
  );
}
