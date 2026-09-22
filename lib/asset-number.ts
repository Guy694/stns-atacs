/**
 * Full asset number = unit code prefix + registration number, e.g. "สสจ." + "7440-001-0006/120".
 * Legacy rows often already store the prefix inside asset_registration_no, so it is never doubled.
 */
export function formatAssetNumber(prefix?: string | null, registrationNo?: string | null) {
  const code = (prefix ?? "").trim();
  const number = (registrationNo ?? "").trim();
  if (!number) return "";
  if (!code) return number;
  const compact = (value: string) => value.replace(/\s+/g, "").toLowerCase();
  return compact(number).startsWith(compact(code)) ? number : `${code}${number}`;
}

export const ASSET_CODE_PREFIX_MAX = 30;
export const ASSET_ACCOUNTING_CODE_MAX = 50;
