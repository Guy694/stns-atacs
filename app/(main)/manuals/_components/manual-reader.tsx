"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { AppIcon } from "@/app/_components/ui/icon";
import { MANUAL_TOPICS, type ManualTopic } from "@/lib/user-manual";

function subscribeToTopic(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

function currentTopic() {
  const id = window.location.hash.slice(1);
  return MANUAL_TOPICS.some((topic) => topic.id === id) ? id : MANUAL_TOPICS[0].id;
}

function ManualImage({ topic }: { topic: ManualTopic }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const src = `/manuals/images/${topic.image}`;

  return (
    <figure className="my-6 overflow-hidden rounded-xl border border-[var(--line)] bg-white">
      <button
        type="button"
        className="block w-full cursor-zoom-in focus-visible:outline-offset-[-4px]"
        aria-label={`ขยายภาพ: ${topic.title}`}
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
      >
        <Image src={src} alt={topic.imageAlt} width={1600} height={900} className="h-auto w-full" unoptimized />
      </button>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] px-4 py-3 text-xs text-[var(--muted)]">
        <span>ภาพอธิบายขั้นตอน · {topic.title}</span>
        <button type="button" onClick={() => dialogRef.current?.showModal()} className="min-h-9 font-semibold text-[var(--primary-text)] underline underline-offset-4">
          ขยายภาพ
        </button>
      </figcaption>
      <dialog
        ref={dialogRef}
        aria-labelledby={`image-title-${topic.id}`}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[95vw] max-w-7xl overflow-auto rounded-xl border border-[var(--line)] bg-white p-0 text-[var(--foreground)] backdrop:bg-black/65"
        onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close(); }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--line)] bg-white px-4 py-3">
          <p id={`image-title-${topic.id}`} className="text-sm font-semibold">{topic.title}</p>
          <button type="button" autoFocus onClick={() => dialogRef.current?.close()} className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-[var(--neutral-bg)] px-3 text-sm hover:bg-[var(--neutral-bg-strong)]">
            <AppIcon name="close" /> ปิดภาพ
          </button>
        </div>
        <p className="px-4 pt-3 text-xs text-[var(--muted)]">เลื่อนภาพในแนวนอนเพื่ออ่านรายละเอียดบนหน้าจอขนาดเล็ก · กด Esc เพื่อปิด</p>
        <div className="overflow-x-auto p-4">
          <Image src={src} alt={topic.imageAlt} width={1600} height={900} className="h-auto w-full min-w-[1000px]" unoptimized />
        </div>
      </dialog>
    </figure>
  );
}

export function ManualReader() {
  const [query, setQuery] = useState("");
  const topicId = useSyncExternalStore(subscribeToTopic, currentTopic, () => MANUAL_TOPICS[0].id);
  const topicIndex = MANUAL_TOPICS.findIndex((topic) => topic.id === topicId);
  const topic = MANUAL_TOPICS[topicIndex];
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousTopic = useRef(topicId);
  const normalizedQuery = query.trim().toLocaleLowerCase("th");
  const filtered = MANUAL_TOPICS.filter((item) =>
    [item.title, item.group, item.description, item.audience, item.note, ...item.sections.flatMap((section) => [section.title, ...section.steps])]
      .join(" ").toLocaleLowerCase("th").includes(normalizedQuery)
  );
  const groups = [...new Set(filtered.map((item) => item.group))];

  useEffect(() => {
    if (previousTopic.current !== topicId) {
      previousTopic.current = topicId;
      headingRef.current?.focus({ preventScroll: true });
      headingRef.current?.scrollIntoView({ block: "start" });
    }
  }, [topicId]);

  return (
    <div className="mx-auto w-full max-w-7xl pb-10">
      <header className="mb-7 border-b border-[var(--line)] pb-6">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--primary-text)]">
          <AppIcon name="file-text" /> ศูนย์ช่วยเหลือ ATACS
        </div>
        <h1 className="text-balance text-2xl font-semibold sm:text-3xl">คู่มือการใช้งาน</h1>
        <p className="mt-3 max-w-[70ch] text-pretty text-sm leading-7 text-[var(--muted)]">
          เลือกหัวข้อที่ต้องการ แล้วทำตามขั้นตอนพร้อมภาพประกอบ ตั้งแต่เริ่มใช้งานจนถึงการดูแลทะเบียนทรัพย์สิน
        </p>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[17rem_minmax(0,1fr)] xl:gap-8">
        <aside className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-4 xl:sticky xl:top-6" aria-label="ค้นหาและเลือกหัวข้อคู่มือ">
          <label htmlFor="manual-search" className="text-xs font-semibold">ค้นหาในคู่มือ</label>
          <input
            id="manual-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="เช่น CSV, ตรวจนับ, Windows"
            className="filter-control mt-2 w-full"
            aria-controls="manual-contents"
          />
          <p role="status" className="mb-4 mt-2 text-xs text-[var(--muted)]">
            {normalizedQuery ? `พบ ${filtered.length} หัวข้อจาก ${MANUAL_TOPICS.length} หัวข้อ` : `${MANUAL_TOPICS.length} หัวข้อ · เลือกเพื่ออ่านคู่มือ`}
          </p>
          <nav id="manual-contents" aria-label="สารบัญคู่มือ" className="max-h-72 space-y-5 overflow-y-auto pr-1 xl:max-h-[65vh]">
            {groups.map((group) => (
              <div key={group}>
                <h2 className="mb-1 px-2 text-xs font-semibold text-[var(--muted)]">{group}</h2>
                <ul className="space-y-1">
                  {filtered.filter((item) => item.group === group).map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        aria-current={item.id === topicId ? "page" : undefined}
                        className={`block rounded-lg px-3 py-3 text-sm leading-6 ${item.id === topicId ? "bg-[var(--primary-soft)] font-semibold text-[var(--primary-text)]" : "text-[var(--foreground)] hover:bg-[var(--neutral-bg)]"}`}
                      >{item.title}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-2 py-3 text-sm leading-6">
                <p className="font-medium">ไม่พบหัวข้อที่ตรงกับคำค้น</p>
                <p className="mt-1 text-[var(--muted)]">ลองใช้คำสั้น ๆ เช่น นำเข้า หรือ สิทธิ์</p>
                <button type="button" onClick={() => setQuery("")} className="mt-3 min-h-11 font-semibold text-[var(--primary-text)] underline underline-offset-4">ล้างคำค้น</button>
              </div>
            )}
          </nav>
        </aside>

        <article className="min-w-0 rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-5 sm:p-7" aria-labelledby="manual-topic-title">
          <p className="mb-2 text-xs font-medium text-[var(--muted)]">{topic.group} · สำหรับ{topic.audience}</p>
          <h2 id="manual-topic-title" ref={headingRef} tabIndex={-1} className="scroll-mt-20 text-balance text-xl font-semibold sm:text-2xl lg:scroll-mt-6">{topic.title}</h2>
          <p className="mt-3 max-w-[70ch] text-pretty text-sm leading-7 text-[var(--muted)]">{topic.description}</p>
          <ManualImage key={topic.id} topic={topic} />

          <div className="space-y-7">
            {topic.sections.map((section) => (
              <section key={section.title}>
                <h3 className="text-balance text-base font-semibold">{section.title}</h3>
                <ol className="mt-3 list-decimal space-y-3 pl-6 text-sm leading-7 marker:font-semibold marker:text-[var(--primary-text)]">
                  {section.steps.map((step) => <li key={step} className="max-w-[75ch] pl-1">{step}</li>)}
                </ol>
              </section>
            ))}
          </div>

          <div className="mt-7 rounded-lg bg-[var(--neutral-bg)] p-4 text-sm leading-7">
            <p className="font-semibold">ข้อควรรู้</p>
            <p className="mt-1 max-w-[75ch] text-[var(--neutral-text)]">{topic.note}</p>
          </div>
          <nav aria-label="อ่านหัวข้อถัดไปหรือก่อนหน้า" className="mt-7 flex flex-wrap justify-between gap-4 border-t border-[var(--line)] pt-5 text-sm">
            {topicIndex > 0 && <a href={`#${MANUAL_TOPICS[topicIndex - 1].id}`} className="max-w-full py-2 text-[var(--primary-text)] underline underline-offset-4">← {MANUAL_TOPICS[topicIndex - 1].title}</a>}
            {topicIndex < MANUAL_TOPICS.length - 1 && <a href={`#${MANUAL_TOPICS[topicIndex + 1].id}`} className="ml-auto max-w-full py-2 text-[var(--primary-text)] underline underline-offset-4">{MANUAL_TOPICS[topicIndex + 1].title} →</a>}
          </nav>
        </article>
      </div>
    </div>
  );
}
