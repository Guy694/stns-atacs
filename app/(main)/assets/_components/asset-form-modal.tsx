"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { createAssetAction, updateAssetAction } from "@/app/(main)/assets/actions";
import type { AssetWithFacility } from "@/lib/assets";

type FacilityOption = { id: number; facility_name: string | null; district_name: string | null };
type DeviceTypeOption = { name: string; category: string };

type Props = {
  facilities: FacilityOption[];
  deviceTypes?: DeviceTypeOption[];
  fixedFacilityId?: number;
  updaterName: string;
  mode: "create" | "edit";
  asset?: AssetWithFacility;
  children: React.ReactNode;
};

const INITIAL: string | null = null;

function formatFacilityOption(facility: FacilityOption) {
  const name = facility.facility_name?.trim() || `หน่วยงาน #${facility.id}`;
  return `${name}${facility.district_name ? ` · อ.${facility.district_name}` : ""}`;
}

function FacilityCombobox({
  facilities,
  defaultFacilityId,
}: {
  facilities: FacilityOption[];
  defaultFacilityId?: number | null;
}) {
  const inputId = useId();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const defaultFacility = facilities.find((facility) => facility.id === defaultFacilityId);
  const [selectedId, setSelectedId] = useState(defaultFacility?.id.toString() ?? "");
  const [query, setQuery] = useState(defaultFacility ? formatFacilityOption(defaultFacility) : "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredFacilities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return facilities;

    return facilities.filter((facility) => {
      const label = formatFacilityOption(facility).toLowerCase();
      return (
        label.includes(normalizedQuery) ||
        facility.id.toString().includes(normalizedQuery) ||
        (facility.facility_name ?? "").toLowerCase().includes(normalizedQuery) ||
        (facility.district_name ?? "").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [facilities, query]);

  const activeOptionIndex = Math.min(activeIndex, Math.max(filteredFacilities.length - 1, 0));
  const activeFacility = filteredFacilities[activeOptionIndex];

  useEffect(() => {
    if (!inputRef.current) return;
    if (!selectedId && query.trim()) {
      inputRef.current.setCustomValidity("กรุณาเลือกหน่วยงานจากรายการ");
    } else {
      inputRef.current.setCustomValidity("");
    }
  }, [query, selectedId]);

  function selectFacility(facility: FacilityOption) {
    setSelectedId(facility.id.toString());
    setQuery(formatFacilityOption(facility));
    setActiveIndex(0);
    setOpen(false);
  }

  return (
    <div className="mt-1">
      <input type="hidden" name="facilityId" value={selectedId} />
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-activedescendant={open && activeFacility ? `${listboxId}-${activeFacility.id}` : undefined}
        value={query}
        required
        placeholder="พิมพ์ชื่อหน่วยงานหรืออำเภอเพื่อค้นหา"
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelectedId("");
          setActiveIndex(0);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((index) => Math.min(index + 1, Math.max(filteredFacilities.length - 1, 0)));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((index) => Math.max(index - 1, 0));
          }
          if (event.key === "Enter" && open && activeFacility) {
            event.preventDefault();
            selectFacility(activeFacility);
          }
          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
      />

      {open && (
        <div id={listboxId} role="listbox" className="mt-2 max-h-60 overflow-y-auto rounded-xl border border-black/10 bg-white shadow-sm">
          {filteredFacilities.length === 0 ? (
            <p className="px-4 py-5 text-center text-sm text-[var(--muted)]">ไม่พบหน่วยงานที่ตรงกับคำค้น</p>
          ) : (
            filteredFacilities.map((facility, index) => {
              const selected = selectedId === facility.id.toString();
              const active = index === activeOptionIndex;

              return (
                <button
                  key={facility.id}
                  id={`${listboxId}-${facility.id}`}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectFacility(facility);
                  }}
                  className={`flex w-full items-start justify-between gap-3 border-b border-black/6 px-4 py-3 text-left text-sm transition last:border-0 ${
                    active ? "bg-[var(--accent)]/8" : "hover:bg-[var(--accent)]/5"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-[var(--foreground)]">
                      {facility.facility_name?.trim() || `หน่วยงาน #${facility.id}`}
                    </span>
                    {facility.district_name && (
                      <span className="mt-0.5 block text-xs text-[var(--muted)]">อ.{facility.district_name}</span>
                    )}
                  </span>
                  {selected && <span className="shrink-0 text-xs font-medium text-[var(--accent)]">เลือกอยู่</span>}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export function AssetFormModal({ facilities, deviceTypes = [], fixedFacilityId, mode, asset, children }: Props) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const mounted = typeof document !== "undefined";
  const formRef = useRef<HTMLFormElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  const action = mode === "create" ? createAssetAction : updateAssetAction;
  const [error, formAction, pending] = useActionState(
    async (prev: string | null, fd: FormData) => {
      const result = await action(prev, fd);
      if (!result) {
        setOpen(false);
        formRef.current?.reset();
      }
      return result;
    },
    INITIAL
  );

  const title = mode === "create" ? "เพิ่มทรัพย์สินใหม่" : `แก้ไข: ${asset?.assetName ?? ""}`;

  return (
    <>
      <span onClick={() => setOpen(true)} className="cursor-pointer">{children}</span>

      {mounted &&
        open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-[var(--surface-strong)] p-6 shadow-2xl sm:p-8"
            >
              <div className="flex items-center justify-between">
                <h2 id={titleId} className="section-title text-xl font-semibold">{title}</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="ปิดหน้าต่างทรัพย์สิน"
                  className="min-h-11 min-w-11 rounded-xl text-[var(--muted)] hover:bg-stone-100 hover:text-[var(--foreground)]"
                >
                  ✕
                </button>
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
              )}

              <form ref={formRef} action={formAction} className="mt-5 space-y-4">
                {mode === "edit" && <input type="hidden" name="assetId" value={asset?.id} />}

              {/* Survey / หน่วยงาน */}
              <div>
                <label className="block text-sm font-medium">หน่วยงาน <span className="text-rose-500">*</span></label>
                {fixedFacilityId ? (
                  <>
                    <input type="hidden" name="facilityId" value={fixedFacilityId} />
                    <div className="mt-1 rounded-xl border border-black/10 bg-white/60 px-3 py-2 text-sm text-[var(--muted)]">
                      หน่วยงานนี้ถูกกำหนดไว้แล้ว
                    </div>
                  </>
                ) : (
                  <FacilityCombobox facilities={facilities} defaultFacilityId={asset?.facilityId} />
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* เลขทะเบียน */}
                <div>
                  <label className="block text-sm font-medium">เลขทะเบียนทรัพย์สิน</label>
                  <input
                    name="assetRegistrationNo"
                    defaultValue={asset?.assetRegistrationNo ?? ""}
                    placeholder="เช่น SAT-HW-0001 หรือเว้นว่าง"
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
                {/* ชื่อ */}
                <div>
                  <label className="block text-sm font-medium">ชื่อทรัพย์สิน <span className="text-rose-500">*</span></label>
                  <input
                    name="assetName"
                    defaultValue={asset?.assetName ?? ""}
                    required
                    placeholder="เช่น Core Firewall"
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* หมวด */}
                <div>
                  <label className="block text-sm font-medium">หมวดทรัพย์สิน <span className="text-rose-500">*</span></label>
                  <select
                    name="assetCategory"
                    defaultValue={asset?.assetGroup ?? "Hardware"}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  >
                    <option value="Hardware">Hardware</option>
                    <option value="Software">Software</option>
                  </select>
                </div>
                {/* ประเภทอุปกรณ์ */}
                <div>
                  <label className="block text-sm font-medium">ประเภทอุปกรณ์</label>
                  <input
                    name="deviceType"
                    list="device-type-list"
                    defaultValue={asset?.deviceType ?? ""}
                    placeholder="เช่น Firewall, Server, Switch"
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                  <datalist id="device-type-list">
                    {deviceTypes.map((t) => <option key={t.name} value={t.name} />)}
                  </datalist>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* OS */}
                <div>
                  <label className="block text-sm font-medium">Operating System</label>
                  <input
                    name="operatingSystem"
                    defaultValue={asset?.operatingSystem ?? ""}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
                {/* Private IP */}
                <div>
                  <label className="block text-sm font-medium">Private IP</label>
                  <input
                    name="privateIp"
                    defaultValue={asset?.privateIp ?? ""}
                    placeholder="10.x.x.x"
                    pattern="^(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}$"
                    title="กรอกเป็น IPv4 เช่น 10.0.0.1"
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 font-mono text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium">Public IP</label>
                <input
                  name="publicIp"
                  defaultValue={asset?.publicIp ?? ""}
                  placeholder="เช่น 1.2.3.4"
                  pattern="^(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}$"
                  title="กรอกเป็น IPv4 เช่น 1.2.3.4"
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 font-mono text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Owner */}
                <div>
                  <label className="block text-sm font-medium">ผู้รับผิดชอบ</label>
                  <input
                    name="ownerName"
                    defaultValue={asset?.ownerName ?? ""}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
                {/* Location */}
                <div>
                  <label className="block text-sm font-medium">ที่ตั้ง / Location</label>
                  <input
                    name="locationDetail"
                    defaultValue={asset?.locationDetail ?? ""}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {/* Serial */}
                <div>
                  <label className="block text-sm font-medium">Serial Number</label>
                  <input
                    name="serialNumber"
                    defaultValue={asset?.serialNumber ?? ""}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 font-mono text-sm outline-none focus:border-[var(--accent)]"
                  />
                  <p className="mt-1 text-xs text-[var(--muted)]">Serial Number ต้องไม่ซ้ำในหน่วยงานเดียวกัน</p>
                </div>
                {/* MA Start */}
                <div>
                  <label className="block text-sm font-medium">วันเริ่มสัญญา</label>
                    <input
                      type="date"
                      name="maintenanceStartDate"
                      defaultValue={asset?.maintenanceStartDate ?? ""}
                      className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                    />
                </div>
                {/* MA End */}
                <div>
                  <label className="block text-sm font-medium">วันสิ้นสุดสัญญา</label>
                  <input
                    type="date"
                    name="maintenanceEndDate"
                    defaultValue={asset?.maintenanceEndDate ?? ""}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              {/* ── ข้อมูลราคาและการจัดซื้อ ── */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium">ราคาที่ซื้อ (บาท)</label>
                  <input
                    type="number"
                    name="purchasePrice"
                    min="0"
                    step="0.01"
                    defaultValue={asset?.purchasePrice ?? ""}
                    placeholder="0.00"
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">วันที่ซื้อ / ได้รับมอบ</label>
                  <input
                    type="date"
                    name="purchaseDate"
                    defaultValue={asset?.purchaseDate ?? ""}
                    max={today}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">เลขที่สัญญา / PO</label>
                  <input
                    name="purchaseOrderNo"
                    defaultValue={asset?.purchaseOrderNo ?? ""}
                    placeholder="เช่น 65-045/2567"
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium">สถานะ</label>
                <select
                  name="currentStatus"
                  defaultValue={asset?.currentStatus ?? "Active"}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                >
                  <option value="Active">พร้อมใช้งาน (Active)</option>
                  <option value="Inactive">ไม่ใช้งาน (Inactive)</option>
                  <option value="Broken">ชำรุด (Broken)</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium">คำอธิบายการใช้งาน</label>
                <textarea
                  name="usageDescription"
                  defaultValue={asset?.usageDescription ?? ""}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-xl border border-black/10 bg-white/80 px-5 py-2 text-sm font-medium hover:bg-white"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-xl bg-[var(--accent-strong)] px-6 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {pending ? "กำลังบันทึก…" : mode === "create" ? "เพิ่มทรัพย์สิน" : "บันทึกการแก้ไข"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
