import { SECURITY_EVENT_GROUPS, type SecurityEventGroup } from "./security-dashboard";

export const SECURITY_WINDOWS = [1, 7, 30, 90] as const;
export type SecurityWindow = (typeof SECURITY_WINDOWS)[number];

export type SecurityFilterParams = { days: SecurityWindow; group?: SecurityEventGroup; type?: string; ip?: string; search?: string };

type Params = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

/** Validates the dashboard / CSV query string. Malformed values are dropped, never passed on. */
export function readSecurityFilter(params: Params): SecurityFilterParams {
  const daysValue = Number(first(params.days));
  const filter: SecurityFilterParams = { days: (SECURITY_WINDOWS as readonly number[]).includes(daysValue) ? (daysValue as SecurityWindow) : 7 };

  const group = first(params.group);
  if (SECURITY_EVENT_GROUPS.some((item) => item.key === group)) filter.group = group as SecurityEventGroup;

  const type = first(params.type).trim();
  if (/^[a-z][a-z0-9_]{1,99}$/.test(type)) filter.type = type;

  const ip = first(params.ip).trim();
  if (/^[0-9a-fA-F:.]{2,45}$/.test(ip)) filter.ip = ip;

  const search = first(params.search).trim().slice(0, 100);
  if (search) filter.search = search;

  return filter;
}
