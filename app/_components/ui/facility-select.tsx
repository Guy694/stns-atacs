"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { AppIcon } from "@/app/_components/ui/icon";
import { facilityGroupLabel, sortFacilities } from "@/lib/facility-order";

/**
 * Searchable facility dropdown (combobox) used everywhere a health facility is picked.
 * Always lists facilities in provincial order (สสจ. → สสอ. → รพท. → รพช. → รพ.สต.) grouped by type.
 *
 * Works three ways:
 * - inside a <form>: pass `name`, the value is submitted through a hidden input;
 * - controlled: pass `value` + `onChange`;
 * - filter bars that navigate on change: pass `onChange` (or `autoSubmit` to submit the parent form).
 */
export type FacilityOption = { id: number | string; name: string; typecode?: string | null; districtName?: string | null; district_name?: string | null };

type Props = {
  facilities: readonly FacilityOption[];
  name?: string;
  id?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Text of the empty option, e.g. "ทุกหน่วยงาน". Omit to force a choice. */
  emptyLabel?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoSubmit?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  /** Skip the provincial ordering when the caller already sorted on purpose. */
  keepOrder?: boolean;
};

type Row = { value: string; label: string; group: string; district: string };

const normalize = (text: string) => text.toLocaleLowerCase("th").replace(/\s+/g, "").replace(/\./g, "");

export function FacilitySelect({
  facilities,
  name,
  id,
  value,
  defaultValue = "",
  onChange,
  emptyLabel,
  placeholder = "พิมพ์ค้นหาหน่วยงาน…",
  required,
  disabled,
  autoSubmit,
  className = "",
  keepOrder,
  ...aria
}: Props) {
  const autoId = useId();
  const inputId = id ?? `${autoId}-facility`;
  const listId = `${autoId}-list`;
  const [inner, setInner] = useState(defaultValue);
  const selected = value ?? inner;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const rows = useMemo<Row[]>(() => {
    const ordered = keepOrder ? [...facilities] : sortFacilities(facilities);
    return ordered.map((f) => ({
      value: String(f.id),
      label: f.name,
      group: facilityGroupLabel(f),
      district: f.districtName ?? f.district_name ?? "",
    }));
  }, [facilities, keepOrder]);

  const options = useMemo<Row[]>(() => {
    const all = emptyLabel !== undefined ? [{ value: "", label: emptyLabel, group: "", district: "" }, ...rows] : rows;
    const q = normalize(query);
    if (!q) return all;
    // While searching, drop the empty row so Enter picks the first real match.
    return rows.filter((row) => normalize(`${row.label}${row.district}${row.group}`).includes(q));
  }, [rows, emptyLabel, query]);

  const selectedLabel = selected === "" ? (emptyLabel ?? "") : (rows.find((row) => row.value === selected)?.label ?? "");

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function choose(next: string) {
    setOpen(false);
    setQuery("");
    if (value === undefined) setInner(next);
    if (hiddenRef.current) hiddenRef.current.value = next;
    if (next !== selected) {
      onChange?.(next);
      if (autoSubmit) queueMicrotask(() => hiddenRef.current?.form?.requestSubmit());
    }
  }

  function openList() {
    if (disabled) return;
    setOpen(true);
    const index = options.findIndex((row) => row.value === selected);
    setActive(index >= 0 ? index : 0);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) return openList();
      setActive((index) => Math.min(index + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      if (open && options[active]) {
        event.preventDefault();
        choose(options[active].value);
      }
    } else if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        setQuery("");
      }
    } else if (event.key === "Tab") {
      setOpen(false);
      setQuery("");
    }
  }

  // Group header shown above the first option of each facility type.
  const headers = options.map((row, index) => (row.group && row.group !== options[index - 1]?.group ? row.group : ""));

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {name && <input ref={hiddenRef} type="hidden" name={name} value={selected} />}
      <div className="relative">
        <AppIcon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
          aria-label={aria["aria-label"]}
          aria-describedby={aria["aria-describedby"]}
          autoComplete="off"
          disabled={disabled}
          required={required && !selected}
          placeholder={open ? placeholder : selectedLabel || placeholder}
          value={open ? query : selectedLabel}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            if (!open) setOpen(true);
          }}
          onFocus={openList}
          onClick={openList}
          onKeyDown={onKeyDown}
          className="filter-control w-full truncate"
          // .filter-control is unlayered and sets padding; inline style keeps room for the two icons.
          style={{ paddingLeft: "2.25rem", paddingRight: "2.25rem" }}
        />
        <AppIcon name="chevrons-up-down" size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
      </div>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 max-h-72 min-w-64 overflow-y-auto rounded-xl border border-black/10 bg-white p-1 text-sm shadow-[0_12px_32px_-12px_rgba(24,50,74,0.35)]"
        >
          {options.length === 0 && <li className="px-3 py-2.5 text-[var(--muted)]">ไม่พบหน่วยงานที่ตรงกับ “{query}”</li>}
          {options.map((row, index) => {
            const header = headers[index];
            const isSelected = row.value === selected;
            return (
              <li key={row.value || "__empty"} role="presentation">
                {header && <div className="px-3 pb-1 pt-2.5 text-[11px] font-semibold text-[var(--muted)]">{header}</div>}
                <div
                  id={`${listId}-${index}`}
                  role="option"
                  data-index={index}
                  aria-selected={isSelected}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => choose(row.value)}
                  onPointerEnter={() => setActive(index)}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 ${
                    index === active ? "bg-[var(--primary-soft)] text-[var(--primary-text)]" : ""
                  } ${isSelected ? "font-semibold" : ""}`}
                >
                  <span className="min-w-0 truncate">{row.label}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-[var(--muted)]">
                    {row.district && <span>{row.district}</span>}
                    {isSelected && <AppIcon name="check" size={15} className="text-[var(--primary)]" />}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
