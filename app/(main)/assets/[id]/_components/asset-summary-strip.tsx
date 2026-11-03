import Link from "next/link";
import type { ReactNode } from "react";

import { StatusBadge } from "@/app/_components/ui/status-badge";
import { assetStatusLabel, assetStatusTone } from "@/lib/asset-status";
import type { Valuation } from "@/lib/asset-valuation";
import { formatThaiDate } from "@/lib/date-format";

export type LastInspection = {
  roundName: string;
  inspectionId: number;
  found: boolean;
  assetStatus: string;
  checkedAt: string;
  checkedBy: string;
};

type Props = {
  status: string;
  facilityName: string;
  workGroupName: string | null;
  locationDetail: string;
  valuation: Valuation;
  asOf: string;
  maEndDate: string;
  maDaysLeft: number | null;
  lastInspection: LastInspection | null;
  /** Name of an open round still waiting for this asset (links to the check-in form). */
  pendingRoundName?: string;
  updatedAt: string;
  updatedBy: string;
};

const baht = (value: number) => value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Item({ label, children, href }: { label: string; children: ReactNode; href?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2.5">
      <p className="text-xs font-medium text-[var(--muted)]">
        {href ? <a href={href} className="hover:text-[var(--foreground)] hover:underline">{label}</a> : label}
      </p>
      <div className="mt-1 min-w-0 text-sm">{children}</div>
    </div>
  );
}

const HINT_TONE = {
  danger: "text-[var(--state-danger-fg)]",
  warning: "text-[var(--state-warning-fg)]",
  success: "text-[var(--state-success-fg)]",
} as const;

function Hint({ children, tone }: { children: ReactNode; tone?: "danger" | "warning" | "success" }) {
  const color = tone ? `font-medium ${HINT_TONE[tone]}` : "text-[var(--muted)]";
  return <p className={`mt-0.5 text-xs leading-5 ${color}`}>{children}</p>;
}

function BookValue({ valuation, asOf }: { valuation: Valuation; asOf: string }) {
  const asOfText = <Hint>ข้อมูล ณ {formatThaiDate(asOf)}</Hint>;
  switch (valuation.status) {
    case "ok":
      return (
        <>
          <p className="text-base font-semibold tabular-nums text-[var(--foreground)]">{baht(valuation.bookValue ?? 0)} <span className="text-xs font-normal text-[var(--muted)]">บาท</span></p>
          {valuation.isFullyDepreciated ? <Hint tone="warning">ครบอายุการใช้งานแล้ว</Hint> : null}
          {asOfText}
        </>
      );
    case "below-threshold":
      return (
        <>
          <StatusBadge tone="neutral">ต่ำกว่าเกณฑ์</StatusBadge>
          <Hint>ราคาทุน {baht(valuation.cost ?? 0)} บาท · ไม่คิดค่าเสื่อม</Hint>
        </>
      );
    case "missing-price":
      return (
        <>
          <StatusBadge tone="warning">ยังไม่ระบุราคา</StatusBadge>
          <Hint>คำนวณมูลค่าไม่ได้</Hint>
        </>
      );
    default:
      return (
        <>
          <p className="font-semibold tabular-nums">{valuation.cost !== null ? `${baht(valuation.cost)} บาท` : "–"}</p>
          <Hint tone="warning">
            {valuation.status === "missing-date" ? "ยังไม่ระบุวันที่ได้มา" : valuation.status === "no-life" ? "ยังไม่มีอายุการใช้งาน" : "วันที่ได้มาอยู่หลังวันนี้"} · แสดงราคาทุน
          </Hint>
        </>
      );
  }
}

function MaStatus({ endDate, daysLeft }: { endDate: string; daysLeft: number | null }) {
  if (daysLeft === null) return <p className="text-[var(--muted)]">ไม่มีข้อมูล MA</p>;
  return (
    <>
      <p className="font-semibold text-[var(--foreground)]">{formatThaiDate(endDate)}</p>
      {daysLeft < 0 ? (
        <Hint tone="danger">หมดอายุแล้ว {Math.abs(daysLeft).toLocaleString("th-TH")} วัน</Hint>
      ) : daysLeft <= 30 ? (
        <Hint tone="warning">ใกล้หมดอายุ · เหลือ {daysLeft.toLocaleString("th-TH")} วัน</Hint>
      ) : (
        <Hint tone="success">เหลือ {daysLeft.toLocaleString("th-TH")} วัน</Hint>
      )}
    </>
  );
}

/** C5: key facts in one strip right under the title, so a QR scan answers "what/where/worth/covered/counted" at a glance. */
export function AssetSummaryStrip(props: Props) {
  const { lastInspection } = props;
  const place = [props.workGroupName, props.locationDetail].filter(Boolean).join(" · ");
  return (
    <section aria-label="สรุปข้อมูลสำคัญ" className="glass-panel rounded-2xl p-3 sm:p-4">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
        <Item label="สถานะ">
          <StatusBadge tone={assetStatusTone(props.status)} className="px-3 py-1 text-sm font-semibold">
            {assetStatusLabel(props.status)}
          </StatusBadge>
        </Item>
        <Item label="ที่ตั้ง">
          <p className="break-words font-semibold text-[var(--foreground)]">{props.facilityName || "–"}</p>
          <Hint>{place || "ไม่ระบุกลุ่มงาน/ที่ตั้ง"}</Hint>
        </Item>
        <Item label="มูลค่าคงเหลือ" href="#valuation-heading">
          <BookValue valuation={props.valuation} asOf={props.asOf} />
        </Item>
        <Item label="MA หมด" href="#ma-heading">
          <MaStatus endDate={props.maEndDate} daysLeft={props.maDaysLeft} />
        </Item>
        <div className="col-span-2 lg:col-span-1">
          <Item label="ตรวจนับล่าสุด">
            {lastInspection ? (
              <>
                <p className="font-semibold text-[var(--foreground)]">{formatThaiDate(lastInspection.checkedAt)}</p>
                <Hint tone={lastInspection.found ? undefined : "danger"}>
                  {lastInspection.found ? `พบ · ${assetStatusLabel(lastInspection.assetStatus)}` : "ไม่พบ"} ·{" "}
                  <Link href={`/inspection/${lastInspection.inspectionId}`} className="underline hover:text-[var(--foreground)]">{lastInspection.roundName}</Link>
                </Hint>
              </>
            ) : (
              <p className="text-[var(--muted)]">ยังไม่มีผลตรวจนับ</p>
            )}
            {props.pendingRoundName ? (
              <a href="#check-in-heading" className="mt-1 inline-flex min-h-8 items-center text-xs font-semibold text-[var(--primary-text)] underline">
                รอตรวจในรอบ {props.pendingRoundName}
              </a>
            ) : null}
          </Item>
        </div>
      </div>
      <p className="mt-2 px-1 text-xs text-[var(--muted)]">
        แก้ไขล่าสุด {formatThaiDate(props.updatedAt, "–")}{props.updatedBy ? ` โดย ${props.updatedBy}` : ""}
      </p>
    </section>
  );
}
