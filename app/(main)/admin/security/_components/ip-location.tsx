import Link from "next/link";

import { AppIcon } from "@/app/_components/ui/icon";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import type { IpGeoRow } from "@/lib/visitor-log-data";
import { countryName, locationLabel } from "@/lib/visitor-log";

/** One IP with its approximate location, ISP and a link that filters the current page by it. */
export function IpLocation({ ip, geo, href, compact = false }: { ip: string; geo: IpGeoRow | undefined; href?: string; compact?: boolean }) {
  const label = geo ? locationLabel(geo) : "กำลังค้นหาตำแหน่ง…";
  const foreign = geo?.network === "public" && geo.country && geo.country !== "TH";
  const internal = geo?.network === "private";
  return (
    <span className="block min-w-0">
      {href ? (
        <Link href={href} className="font-mono text-xs font-semibold text-[var(--primary-text)] hover:underline">{ip}</Link>
      ) : (
        <span className="font-mono text-xs font-semibold">{ip}</span>
      )}
      <span className={`mt-0.5 flex flex-wrap items-center gap-1 text-xs ${foreign ? "text-[var(--state-danger-fg)]" : "text-[var(--muted)]"}`}>
        <AppIcon name={internal ? "building" : "map"} size={12} className="shrink-0" />
        {label}
        {foreign && <StatusBadge tone="danger" className="px-1.5 py-0 text-[10px]">ต่างประเทศ</StatusBadge>}
      </span>
      {!compact && geo?.isp && <span className="block truncate text-[11px] text-[var(--muted)]" title={geo.isp}>{geo.isp}</span>}
    </span>
  );
}

export { countryName };
