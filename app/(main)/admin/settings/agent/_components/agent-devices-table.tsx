"use client";

import { useMemo, useState } from "react";

import { SortableTh, TablePagination } from "@/app/_components/ui/data-table";
import { FacilitySelect } from "@/app/_components/ui/facility-select";
import { AppIcon } from "@/app/_components/ui/icon";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { useTableState } from "@/app/_components/ui/use-table-state";
import type { AssetSelectOption } from "@/lib/assets";
import { formatThaiDateTime } from "@/lib/date-format";

import { AgentDeviceLifecycleCell, AgentLifecycleStatus, type AgentLifecycleDevice } from "./agent-device-lifecycle-cell";
import { AgentDeviceLinkCell } from "./agent-device-link-cell";
import { formatRelativeThai } from "./relative-time";

export type AgentDeviceRow = AgentLifecycleDevice & {
  facilityId: number;
  facilityName: string;
  facilityTypecode: string | null;
  deviceType: string | null;
  serialNumber: string | null;
  privateIp: string | null;
  status: string;
  lastSeenAt: string | null;
  diskTotalGb: number | null;
  diskFreeGb: number | null;
  linkedAssetId: number | null;
  linkedAssetName: string | null;
  linkedAssetRegistrationNo: string | null;
  autoLinkDisabled: boolean;
};

type StatusFilter = "" | "online" | "offline" | "inactive";

function diskLabel(device: AgentDeviceRow) {
  if (device.diskTotalGb == null) return null;
  const total = device.diskTotalGb.toLocaleString("th-TH", { maximumFractionDigits: 0 });
  if (device.diskFreeGb == null) return `ดิสก์ ${total} GB`;
  return `ดิสก์ว่าง ${device.diskFreeGb.toLocaleString("th-TH", { maximumFractionDigits: 0 })}/${total} GB`;
}

const th = "px-4 py-2.5 font-medium whitespace-nowrap";

export function AgentDevicesTable({
  devices,
  assets,
  canManage,
  nowMs,
}: {
  devices: AgentDeviceRow[];
  assets: AssetSelectOption[];
  canManage: boolean;
  nowMs: number;
}) {
  const [query, setQuery] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");

  const facilityOptions = useMemo(() => {
    const seen = new Map<number, { id: number; name: string; typecode: string | null }>();
    for (const device of devices) seen.set(device.facilityId, { id: device.facilityId, name: device.facilityName, typecode: device.facilityTypecode });
    return [...seen.values()];
  }, [devices]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("th");
    return devices.filter((device) => {
      if (facilityId && String(device.facilityId) !== facilityId) return false;
      if (status === "inactive" && device.isActive) return false;
      if ((status === "online" || status === "offline") && (!device.isActive || device.status !== status)) return false;
      if (!needle) return true;
      return [device.hostname, device.privateIp, device.serialNumber, device.operatingSystem, device.facilityName, device.linkedAssetRegistrationNo, device.linkedAssetName, device.agentVersion]
        .some((value) => value?.toLocaleLowerCase("th").includes(needle));
    });
  }, [devices, query, facilityId, status]);

  const table = useTableState(filtered, {
    host: (row) => row.hostname ?? "",
    facility: (row) => row.facilityName,
    os: (row) => row.operatingSystem ?? "",
    asset: (row) => row.linkedAssetRegistrationNo ?? "",
    seen: (row) => row.lastSeenAt ?? "",
  }, { initialSort: { key: "seen", dir: "desc" } });

  const filtersActive = Boolean(query || facilityId || status);

  return (
    <div className="min-w-0">
      <div className="grid gap-2 border-b border-[var(--line)] px-5 py-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,12rem)_auto] lg:items-end">
        <label className="filter-label">
          ค้นหา
          <span className="relative mt-1 block">
            <AppIcon name="search" size={15} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="search"
              value={query}
              onChange={(event) => { setQuery(event.target.value); table.resetPage(); }}
              placeholder="ชื่อเครื่อง, IP, S/N, เลขทะเบียน…"
              className="filter-control pl-9"
            />
          </span>
        </label>
        {facilityOptions.length > 1 ? (
          <div className="filter-label">
            <span>หน่วยงาน</span>
            <div className="mt-1">
              <FacilitySelect
                facilities={facilityOptions}
                value={facilityId}
                onChange={(value) => { setFacilityId(value); table.resetPage(); }}
                emptyLabel="ทุกหน่วยงาน"
                aria-label="กรองตามหน่วยงาน"
              />
            </div>
          </div>
        ) : null}
        <label className="filter-label">
          สถานะ
          <select
            value={status}
            onChange={(event) => { setStatus(event.target.value as StatusFilter); table.resetPage(); }}
            className="filter-control"
          >
            <option value="">ทุกสถานะ</option>
            <option value="online">ออนไลน์</option>
            <option value="offline">ออฟไลน์</option>
            <option value="inactive">ถอน/ลบออกจากระบบแล้ว</option>
          </select>
        </label>
        {filtersActive ? (
          <button
            type="button"
            onClick={() => { setQuery(""); setFacilityId(""); setStatus(""); table.resetPage(); }}
            className="secondary-action action-sm justify-self-start whitespace-nowrap"
          >
            ล้างตัวกรอง
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] bg-[var(--primary-soft)]/40 text-xs text-[var(--muted)]">
              <SortableTh label="เครื่อง" sortKey="host" sort={table.sort} onSort={table.onSort} className={`${th} min-w-52`} />
              <SortableTh label="หน่วยงาน" sortKey="facility" sort={table.sort} onSort={table.onSort} className={`${th} min-w-44`} />
              <SortableTh label="ระบบปฏิบัติการ / IP" sortKey="os" sort={table.sort} onSort={table.onSort} className={`${th} min-w-52`} />
              <SortableTh label="ทะเบียนที่ผูก" sortKey="asset" sort={table.sort} onSort={table.onSort} className={`${th} min-w-48`} />
              <SortableTh label="สถานะ / ล่าสุด" sortKey="seen" sort={table.sort} onSort={table.onSort} className={`${th} min-w-40`} />
              <th className={`${th} min-w-36 text-right`}>การจัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {table.rows.map((device) => {
              const disk = diskLabel(device);
              return (
                <tr key={device.id} className="align-middle">
                  <td className="px-4 py-2">
                    <p className="break-words font-medium">{device.hostname ?? `Device #${device.id}`}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      Agent {device.agentVersion ?? "-"} · {device.deviceType ?? "Computer"}
                      {device.serialNumber ? <> · <span className="font-mono">S/N {device.serialNumber}</span></> : null}
                    </p>
                  </td>
                  <td className="px-4 py-2 text-[var(--muted)]">{device.facilityName}</td>
                  <td className="px-4 py-2">
                    <p className="line-clamp-2">{device.operatingSystem ?? "-"}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      <span className="font-mono">{device.privateIp ?? "-"}</span>
                      {disk ? <> · {disk}</> : null}
                    </p>
                  </td>
                  <AgentDeviceLinkCell
                    deviceId={device.id}
                    facilityId={device.facilityId}
                    linkedAssetId={device.linkedAssetId}
                    linkedAssetName={device.linkedAssetName}
                    linkedAssetRegistrationNo={device.linkedAssetRegistrationNo}
                    autoLinkDisabled={device.autoLinkDisabled}
                    assets={assets}
                  />
                  <td className="px-4 py-2">
                    {device.isActive ? (
                      <StatusBadge tone={device.status === "online" ? "success" : "warning"}>
                        {device.status === "online" ? "ออนไลน์" : "ออฟไลน์"}
                      </StatusBadge>
                    ) : null}
                    <p className="mt-1 whitespace-nowrap text-xs text-[var(--muted)]" title={device.lastSeenAt ? formatThaiDateTime(device.lastSeenAt) : undefined}>
                      {device.lastSeenAt ? formatRelativeThai(device.lastSeenAt, nowMs) : "ยังไม่รายงาน"}
                    </p>
                    <AgentLifecycleStatus device={device} />
                  </td>
                  <AgentDeviceLifecycleCell canManage={canManage} device={device} />
                </tr>
              );
            })}
            {table.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[var(--muted)]">
                  {devices.length === 0 ? "ยังไม่มีเครื่องที่ลงทะเบียน — คัดลอกคำสั่งติดตั้งด้านบนไปรันที่เครื่องปลายทาง" : "ไม่พบเครื่องที่ตรงกับตัวกรอง"}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <TablePagination {...table} onPage={table.onPage} label="แบ่งหน้ารายการเครื่อง Agent" className="border-t border-[var(--line)]" />
    </div>
  );
}
