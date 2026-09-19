"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { createAssetAction, updateAssetAction } from "@/app/(main)/assets/actions";
import { ASSET_CLASS_OPTIONS } from "@/lib/asset-classes";
import { isItAsset, requiresWindowsLicense } from "@/lib/asset-policy";
import type { AssetWithFacility } from "@/lib/assets";
import { isComputerDeviceType, type WindowsLicenseStatus } from "@/lib/windows-license";

type FacilityOption = { id: number; facility_name: string | null; district_name: string | null };
type DeviceTypeOption = { name: string; category: string };
type WorkGroupOption = { id: number; facilityId: number; facilityName: string; workGroupName: string };

type Props = {
  facilities: FacilityOption[];
  deviceTypes?: DeviceTypeOption[];
  workGroups?: WorkGroupOption[];
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
  onSelectedFacilityIdChange,
}: {
  facilities: FacilityOption[];
  defaultFacilityId?: number | null;
  onSelectedFacilityIdChange?: (facilityId: number | null) => void;
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

  useEffect(() => {
    onSelectedFacilityIdChange?.(selectedId ? Number(selectedId) : null);
  }, [onSelectedFacilityIdChange, selectedId]);

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

export function AssetFormModal({ facilities, deviceTypes = [], workGroups = [], fixedFacilityId, mode, asset, children }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedFacilityId, setSelectedFacilityId] = useState<number | null>(fixedFacilityId ?? asset?.facilityId ?? null);
  const [selectedWorkGroupId, setSelectedWorkGroupId] = useState(asset?.workGroupId?.toString() ?? "");
  const [assetClass, setAssetClass] = useState(asset?.assetClass ?? "IT");
  const isIt = isItAsset({ assetClass });
  const classChanged = mode === "edit" && assetClass !== asset?.assetClass;
  const [assetCategory, setAssetCategory] = useState<"Hardware" | "Software">(asset?.assetGroup ?? "Hardware");
  const [deviceType, setDeviceType] = useState(asset?.deviceType?.trim() ?? "");
  const [windowsLicenseStatus, setWindowsLicenseStatus] = useState<WindowsLicenseStatus | "">(
    asset?.windowsLicenseStatus ?? ""
  );
  const titleId = useId();
  const mounted = typeof document !== "undefined";
  const formRef = useRef<HTMLFormElement>(null);
  const today = new Date().toISOString().slice(0, 10);
  const selectedDeviceType = asset?.deviceType?.trim() ?? "";
  const requiresWindowsLicenseStatus = requiresWindowsLicense({ assetClass, assetCategory, deviceType });
  const hasSelectedDeviceType = Boolean(
    selectedDeviceType && !deviceTypes.some((t) => t.name === selectedDeviceType)
  );
  const hardwareDeviceTypes = useMemo(
    () => deviceTypes.filter((t) => t.category === "Hardware"),
    [deviceTypes]
  );
  const softwareDeviceTypes = useMemo(
    () => deviceTypes.filter((t) => t.category === "Software"),
    [deviceTypes]
  );
  const selectedWorkGroups = useMemo(
    () => (selectedFacilityId ? workGroups.filter((group) => group.facilityId === selectedFacilityId) : []),
    [selectedFacilityId, workGroups]
  );
  const selectedWorkGroupValue = selectedWorkGroups.some((group) => String(group.id) === selectedWorkGroupId)
    ? selectedWorkGroupId
    : "";

  function openModal() {
    setSelectedFacilityId(fixedFacilityId ?? asset?.facilityId ?? null);
    setSelectedWorkGroupId(asset?.workGroupId?.toString() ?? "");
    setAssetClass(asset?.assetClass ?? "IT");
    setAssetCategory(asset?.assetGroup ?? "Hardware");
    setDeviceType(asset?.deviceType?.trim() ?? "");
    setWindowsLicenseStatus(asset?.windowsLicenseStatus ?? "");
    setOpen(true);
  }

  const action = mode === "create" ? createAssetAction : updateAssetAction;
  const [error, formAction, pending] = useActionState(
    async (prev: string | null, fd: FormData) => {
      const result = await action(prev, fd);
      if (!result) {
        setOpen(false);
        formRef.current?.reset();
        setSelectedWorkGroupId("");
      }
      return result;
    },
    INITIAL
  );

  const title = mode === "create" ? "เพิ่มทรัพย์สินใหม่" : `แก้ไข: ${asset?.assetName ?? ""}`;

  return (
    <>
      <span onClick={openModal} className="cursor-pointer">{children}</span>

      {mounted &&
        open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="relative z-10 mx-3 max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl overflow-y-auto rounded-2xl bg-[var(--surface-strong)] p-4 shadow-2xl sm:p-6"
            >
              <div className="flex items-start justify-between gap-3 colors-[var(--foreground)]">
                <h2 id={titleId} className="section-title min-w-0 text-xl font-semibold leading-snug">{title}</h2>
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
                <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
              )}

              <form ref={formRef} action={formAction} className="mt-5 space-y-4">
                {mode === "edit" && <input type="hidden" name="assetId" value={asset?.id} />}

              <h3 className="text-base font-semibold">ข้อมูลทั่วไป</h3>
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
                  <FacilityCombobox
                    facilities={facilities}
                    defaultFacilityId={asset?.facilityId}
                    onSelectedFacilityIdChange={(facilityId) => {
                      setSelectedFacilityId(facilityId);
                      setSelectedWorkGroupId("");
                    }}
                  />
                )}
              </div>

              {selectedWorkGroups.length > 0 && (
                <div>
                  <label className="block text-sm font-medium">
                    กลุ่มงาน <span className="text-rose-500">*</span>
                  </label>
                  <select
                    name="workGroupId"
                    value={selectedWorkGroupValue}
                    onChange={(event) => setSelectedWorkGroupId(event.target.value)}
                    required
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  >
                    <option value="">เลือกกลุ่มงาน</option>
                    {selectedWorkGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.workGroupName}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    ดึงจากรายการกลุ่มงานของหน่วยงานที่สร้างไว้
                  </p>
                </div>
              )}

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
                    placeholder="เช่น คอมพิวเตอร์สำนักงาน โต๊ะทำงาน หรือรถยนต์"
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* หมวด */}
                <div>
                  <label htmlFor={`${titleId}-class`} className="block text-sm font-medium">กลุ่มทรัพย์สิน <span className="text-rose-500">*</span></label>
                  <select
                    id={`${titleId}-class`}
                    name="assetClass"
                    value={assetClass}
                    onChange={(event) => setAssetClass(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  >
                    {ASSET_CLASS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <fieldset hidden={!isIt} disabled={!isIt}>
                  <label className="block text-sm font-medium">ลักษณะทรัพย์สิน IT <span className="text-rose-500">*</span></label>
                  <select
                    name="assetCategory"
                    value={assetCategory}
                    onChange={(event) => {
                      const nextCategory = event.target.value as "Hardware" | "Software";
                      setAssetCategory(nextCategory);
                      if (nextCategory !== "Hardware") setWindowsLicenseStatus("");
                    }}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  >
                    <option value="Hardware">Hardware</option>
                    <option value="Software">Software</option>
                  </select>
                </fieldset>
                {/* ประเภททรัพย์สิน */}
                <fieldset hidden={!isIt} disabled={!isIt} className="sm:col-span-2">
                  <label className="block text-sm font-medium">ประเภทอุปกรณ์ IT</label>
                  <select
                    name="deviceType"
                    value={deviceType}
                    onChange={(event) => {
                      const nextDeviceType = event.target.value;
                      setDeviceType(nextDeviceType);
                      if (!isComputerDeviceType(nextDeviceType)) setWindowsLicenseStatus("");
                    }}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  >
                    <option value="">เลือกประเภททรัพย์สิน</option>
                    {hasSelectedDeviceType && <option value={selectedDeviceType}>{selectedDeviceType} (ค่าปัจจุบัน)</option>}
                    {hardwareDeviceTypes.length > 0 && (
                      <optgroup label="ฮาร์ดแวร์">
                        {hardwareDeviceTypes.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
                      </optgroup>
                    )}
                    {softwareDeviceTypes.length > 0 && (
                      <optgroup label="ซอฟต์แวร์">
                        {softwareDeviceTypes.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
                      </optgroup>
                    )}
                  </select>
                </fieldset>
                {requiresWindowsLicenseStatus && (
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium">
                      สถานะลิขสิทธิ์ Windows <span className="text-rose-500">*</span>
                    </label>
                    <select
                      name="windowsLicenseStatus"
                      value={windowsLicenseStatus}
                      onChange={(event) => setWindowsLicenseStatus(event.target.value as WindowsLicenseStatus | "")}
                      required
                      aria-describedby="windows-license-status-help"
                      className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                    >
                      <option value="">เลือกสถานะลิขสิทธิ์ Windows</option>
                      <option value="Genuine">Windows แท้ (มีลิขสิทธิ์ถูกต้อง)</option>
                      <option value="Pirated">Windows เถื่อน (ไม่มีลิขสิทธิ์ถูกต้อง)</option>
                    </select>
                    <p id="windows-license-status-help" className="mt-1 text-xs text-[var(--muted)]">
                      จำเป็นสำหรับ Hardware ประเภทคอมพิวเตอร์
                    </p>
                  </div>
                )}
              </div>

              {classChanged && (
                <label className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  <input key={assetClass} type="checkbox" name="confirmClassChange" value="1" required className="mt-1" />
                  ยืนยันการเปลี่ยนกลุ่มทรัพย์สิน ข้อมูลเดิมจะถูกเก็บไว้ รายการที่ผูก Agent ต้องยกเลิกการเชื่อมก่อนเปลี่ยนเป็นกลุ่มอื่น
                </label>
              )}
              {!isIt && <p className="text-sm text-[var(--foreground)]">บันทึกข้อมูลทะเบียน การจัดซื้อ และรายละเอียดทั่วไปของทรัพย์สินได้โดยไม่ต้องระบุข้อมูลคอมพิวเตอร์</p>}
              <fieldset disabled={!isIt} className={isIt ? "grid gap-4 sm:grid-cols-2" : "hidden"}>
                <legend className="mb-3 text-base font-semibold">ข้อมูล IT</legend>
                {/* OS */}
                <div>
                  <label className="block text-sm font-medium">ระบบปฏิบัติการ</label>
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
                    placeholder="เช่น 10.0.0.1 หรือ 10.0.0.1/24"
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 font-mono text-sm outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </fieldset>

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

              <div className="grid gap-4 sm:grid-cols-2">
                {([
                  ["manufacturerBrand", "ยี่ห้อ", asset?.manufacturerBrand],
                  ["manufacturerModel", "รุ่น", asset?.manufacturerModel],
                ] as const).map(([name, label, value]) => (
                  <div key={name}>
                    <label htmlFor={titleId + name} className="block text-sm font-medium">{label}</label>
                    <input id={titleId + name} name={name} defaultValue={value ?? ""} className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
                  </div>
                ))}
              </div>
              <div>
                <label htmlFor={titleId + "specification"} className="block text-sm font-medium">รายละเอียด / คุณลักษณะ</label>
                <textarea id={titleId + "specification"} name="manufacturerSpecification" defaultValue={asset?.manufacturerSpecification ?? ""} rows={3} className="mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
              </div>
              <h3 className="pt-2 text-base font-semibold">การจัดซื้อและการบำรุงรักษา</h3>
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
                  <option value="Active">พร้อมใช้งาน</option>
                  <option value="Inactive">ไม่ใช้งาน</option>
                  <option value="Broken">ชำรุด</option>
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

              <fieldset className="space-y-3">
                <legend className="mb-2 text-base font-semibold">รูปภาพทรัพย์สิน</legend>
                <p className="text-sm text-[var(--muted)]">JPG, PNG หรือ WebP ไม่เกิน 5 MB ต่อภาพ</p>
                {([1, 2] as const).map((slot) => {
                  const imageUrl = slot === 1 ? asset?.assetImage1Url : asset?.assetImage2Url;
                  return (
                    <div key={slot}>
                      <label htmlFor={titleId + "image" + slot} className="block text-sm font-medium">รูปภาพที่ {slot}</label>
                      <input id={titleId + "image" + slot} name={"assetImage" + slot} type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block w-full text-sm" />
                      {imageUrl && (
                        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
                          <a href={imageUrl} target="_blank" rel="noreferrer" className="underline">ดูรูปปัจจุบัน</a>
                          <label className="flex items-center gap-2"><input type="checkbox" name={"removeAssetImage" + slot} value="1" />ลบรูปปัจจุบัน</label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </fieldset>
                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
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
