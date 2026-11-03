"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type HistoryTab = {
  /** Value used in the `?history=` query param (SSR picks the initial tab from it). */
  key: string;
  label: string;
  /** Shown next to the label; omit when unknown (e.g. table not migrated yet). */
  count?: string;
  /** Element ids inside the panel; a matching URL hash (old deep links) opens this tab. */
  anchors?: string[];
  content: ReactNode;
};

/**
 * Tabbed panel for the asset's history lists (สถานะ / ซ่อม / โอนย้าย / แก้ไขข้อมูล).
 * Every panel is server-rendered (inactive ones are `hidden`), so content is in the HTML;
 * the client only switches visibility and keeps `?history=` in sync via replaceState.
 */
export function HistoryTabs({ tabs, initialKey, title }: { tabs: HistoryTab[]; initialKey?: string; title: string }) {
  const baseId = useId();
  const [active, setActive] = useState(() => (tabs.some((tab) => tab.key === initialKey) ? initialKey! : tabs[0]?.key));
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Old links such as #repair-history-heading should still land on the right list.
  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (!hash) return;
    const match = tabs.find((tab) => tab.anchors?.includes(hash));
    if (match) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off sync from the URL hash after hydration
      setActive(match.key);
      requestAnimationFrame(() => document.getElementById(hash)?.closest("[role=tabpanel]")?.scrollIntoView({ block: "start" }));
    }
  }, [tabs]);

  function select(key: string, focus = false) {
    setActive(key);
    const url = new URL(window.location.href);
    url.searchParams.set("history", key);
    url.hash = "";
    window.history.replaceState(window.history.state, "", url);
    if (focus) tabRefs.current[tabs.findIndex((tab) => tab.key === key)]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = tabs.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    select(tabs[next].key, true);
  }

  if (tabs.length === 0) return null;

  return (
    <section className="glass-panel overflow-hidden rounded-2xl" aria-labelledby={`${baseId}-title`}>
      <div className="border-b border-black/8 px-5 pt-4">
        <h2 id={`${baseId}-title`} className="text-sm font-semibold text-[var(--muted)]">{title}</h2>
        <div role="tablist" aria-labelledby={`${baseId}-title`} className="-mx-1 mt-2 flex gap-1 overflow-x-auto pb-px">
          {tabs.map((tab, index) => {
            const selected = tab.key === active;
            return (
              <button
                key={tab.key}
                ref={(node) => { tabRefs.current[index] = node; }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${tab.key}`}
                aria-selected={selected}
                aria-controls={`${baseId}-panel-${tab.key}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(tab.key)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition ${
                  selected
                    ? "border-[var(--primary)] text-[var(--primary-text)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`rounded-full px-1.5 py-px text-[11px] tabular-nums ${selected ? "bg-[var(--primary-soft-strong)]" : "bg-[var(--state-neutral-bg)]"}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.key}
          role="tabpanel"
          id={`${baseId}-panel-${tab.key}`}
          aria-labelledby={`${baseId}-tab-${tab.key}`}
          hidden={tab.key !== active}
          tabIndex={0}
          className="scroll-mt-20 focus-visible:outline-offset-[-3px]"
        >
          {tab.content}
        </div>
      ))}
    </section>
  );
}
