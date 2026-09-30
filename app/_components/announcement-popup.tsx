"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  revision: string;
  title: string;
  version: string;
  message: string;
  imageUrl: string;
  /** true = หน้าดูตัวอย่างของแอดมิน แสดงทันที ไม่จำสถานะปิด */
  preview?: boolean;
};

const seenKey = (revision: string) => `atacs:announcement-seen:${revision}`;
const hideKey = (revision: string) => `atacs:announcement-hide:${revision}`;

function readStorage(kind: "session" | "local", key: string) {
  try {
    return (kind === "session" ? window.sessionStorage : window.localStorage).getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(kind: "session" | "local", key: string, value: string) {
  try {
    (kind === "session" ? window.sessionStorage : window.localStorage).setItem(key, value);
  } catch {
    // ถ้าเบราว์เซอร์ไม่ให้จำค่า ประกาศจะแสดงใหม่ในครั้งถัดไป ซึ่งไม่เป็นปัญหา
  }
}

export function AnnouncementPopup({ revision, title, version, message, imageUrl, preview = false }: Props) {
  const [open, setOpen] = useState(preview);
  const [dontShow, setDontShow] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (preview) return;
    // แสดงครั้งเดียวต่อ session ของแท็บ และไม่แสดงถ้าผู้ใช้เลือก "ไม่ต้องแสดงอีก" สำหรับประกาศฉบับนี้
    if (readStorage("local", hideKey(revision)) === "1") return;
    if (readStorage("session", seenKey(revision)) === "1") return;
    // รอให้ splash screen แสดงจบก่อน
    const timer = window.setTimeout(() => setOpen(true), 900);
    return () => window.clearTimeout(timer);
  }, [preview, revision]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dontShow]);

  function close() {
    if (!preview) {
      writeStorage("session", seenKey(revision), "1");
      if (dontShow) writeStorage("local", hideKey(revision), "1");
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-title"
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-[var(--surface,#fff)] shadow-2xl"
      >
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={title || "ประกาศ"} className="max-h-[45vh] w-full bg-black/5 object-contain" />
        )}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {version && (
            <span className="inline-block rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--primary-text)]">
              อัปเดตเวอร์ชัน v.{version.replace(/^v\.?/i, "")}
            </span>
          )}
          <h2 id="announcement-title" className="mt-2 text-xl font-semibold">
            {title || "ประชาสัมพันธ์"}
          </h2>
          {message && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[var(--muted)]">{message}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] px-6 py-4">
          {preview ? (
            <span className="text-xs text-[var(--muted)]">ตัวอย่างที่ผู้ใช้จะเห็น</span>
          ) : (
            <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <input type="checkbox" checked={dontShow} onChange={(event) => setDontShow(event.target.checked)} />
              ไม่ต้องแสดงประกาศนี้อีก
            </label>
          )}
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            className="rounded-xl bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            {preview ? "ปิดตัวอย่าง" : "รับทราบ"}
          </button>
        </div>
      </div>
    </div>
  );
}
