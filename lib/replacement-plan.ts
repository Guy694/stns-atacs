import { valueAsset, type Valuation, type ValuationInput } from "@/lib/asset-valuation";

/**
 * แผนการจัดหาทดแทน: ranks assets still on the register that should be replaced, from what the
 * register already knows — condition, depreciation/age, and repair history. Pure (data is passed in).
 */
export type ReplacementRules = {
  /** Repairs counted in this many years back from today. */
  repairWindowYears: number;
  /** "Frequently repaired" from this many repairs in the window. */
  repairCountMin: number;
  /** "Repair cost high" when total repair cost reaches this share of the purchase price. */
  repairCostRatio: number;
};

export const DEFAULT_REPLACEMENT_RULES: ReplacementRules = { repairWindowYears: 2, repairCountMin: 3, repairCostRatio: 0.5 };

export type RepairStats = { recentCount: number; totalCount: number; totalCost: number };

export type ReplacementReason = "broken" | "fully-depreciated" | "over-age" | "frequent-repair" | "repair-cost" | "inactive";

export const REPLACEMENT_REASON_LABELS: Record<ReplacementReason, string> = {
  broken: "ชำรุด",
  "fully-depreciated": "ตัดค่าเสื่อมครบแล้ว",
  "over-age": "ใช้งานเกินอายุการใช้งาน",
  "frequent-repair": "ซ่อมบ่อย",
  "repair-cost": "ค่าซ่อมสะสมสูง",
  inactive: "ไม่ได้ใช้งาน",
};

const REASON_POINTS: Record<ReplacementReason, number> = {
  broken: 3,
  "fully-depreciated": 2,
  "over-age": 2,
  "frequent-repair": 2,
  "repair-cost": 2,
  inactive: 1,
};

export type ReplacementPriority = "High" | "Medium" | "Low";

export const REPLACEMENT_PRIORITY_LABELS: Record<ReplacementPriority, string> = {
  High: "เร่งด่วน (ปีงบประมาณถัดไป)",
  Medium: "ควรวางแผน (1–2 ปี)",
  Low: "เฝ้าระวัง",
};

export type ReplacementAsset = ValuationInput & {
  id: number;
  currentStatus?: string;
};

export type ReplacementCandidate<A extends ReplacementAsset> = {
  asset: A;
  valuation: Valuation;
  ageYears: number | null;
  reasons: ReplacementReason[];
  score: number;
  priority: ReplacementPriority;
  repairs: RepairStats;
  repairCostRatio: number | null;
  pendingDisposal: boolean;
};

const round1 = (value: number) => Math.round(value * 10) / 10;

export function yearsBetween(from: string, to: string) {
  const a = new Date(`${from.slice(0, 10)}T00:00:00Z`).getTime();
  const b = new Date(`${to.slice(0, 10)}T00:00:00Z`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return round1((b - a) / (365.25 * 86_400_000));
}

/** Start of the repair-count window (valid date even from 29 Feb). */
export function repairWindowStart(today: string, years: number) {
  const date = new Date(`${today.slice(0, 10)}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() - years);
  return date.toISOString().slice(0, 10);
}

export function priorityOf(score: number): ReplacementPriority {
  if (score >= 5) return "High";
  if (score >= 3) return "Medium";
  return "Low";
}

export function assessReplacement<A extends ReplacementAsset>(
  asset: A,
  repairs: RepairStats | undefined,
  pendingDisposal: boolean,
  today: string,
  rules: ReplacementRules = DEFAULT_REPLACEMENT_RULES,
): ReplacementCandidate<A> | null {
  if (asset.currentStatus === "Disposed" || asset.currentStatus === "Lost") return null;
  const stats = repairs ?? { recentCount: 0, totalCount: 0, totalCost: 0 };
  const valuation = valueAsset(asset, today);
  const ageYears = valuation.startDate ? yearsBetween(valuation.startDate, today) : null;
  const reasons: ReplacementReason[] = [];
  if (asset.currentStatus === "Broken") reasons.push("broken");
  if (asset.currentStatus === "Inactive") reasons.push("inactive");
  if (valuation.status === "ok" && valuation.isFullyDepreciated) reasons.push("fully-depreciated");
  // Items below the capitalisation threshold are not depreciated; their age still counts.
  else if (ageYears !== null && valuation.life.years && ageYears >= valuation.life.years) reasons.push("over-age");
  if (stats.recentCount >= rules.repairCountMin) reasons.push("frequent-repair");
  const cost = asset.purchasePrice ?? null;
  const repairCostRatio = cost && cost > 0 ? Math.round((stats.totalCost / cost) * 1000) / 1000 : null;
  if (repairCostRatio !== null && stats.totalCost > 0 && repairCostRatio >= rules.repairCostRatio) reasons.push("repair-cost");
  if (!reasons.length) return null;
  const score = reasons.reduce((total, reason) => total + REASON_POINTS[reason], 0);
  return { asset, valuation, ageYears, reasons, score, priority: priorityOf(score), repairs: stats, repairCostRatio, pendingDisposal };
}

export function buildReplacementPlan<A extends ReplacementAsset>(
  assets: A[],
  repairStats: Map<number, RepairStats>,
  pendingDisposalIds: Set<number>,
  today: string,
  rules: ReplacementRules = DEFAULT_REPLACEMENT_RULES,
) {
  const items = assets
    .map((asset) => assessReplacement(asset, repairStats.get(asset.id), pendingDisposalIds.has(asset.id), today, rules))
    .filter((item): item is ReplacementCandidate<A> => item !== null)
    .sort((a, b) => b.score - a.score || (b.ageYears ?? 0) - (a.ageYears ?? 0) || (b.repairs.totalCost - a.repairs.totalCost));
  const byPriority = (priority: ReplacementPriority) => items.filter((item) => item.priority === priority);
  const budget = (list: ReplacementCandidate<A>[]) => Math.round(list.reduce((total, item) => total + (item.asset.purchasePrice ?? 0), 0) * 100) / 100;
  const high = byPriority("High");
  const medium = byPriority("Medium");
  return {
    items,
    counts: { High: high.length, Medium: medium.length, Low: items.length - high.length - medium.length },
    /** Replacement estimate at the original purchase price (actual prices are set when procuring). */
    estimatedBudget: { High: budget(high), Medium: budget(medium) },
    reasonCounts: Object.fromEntries(
      (Object.keys(REPLACEMENT_REASON_LABELS) as ReplacementReason[]).map((reason) => [reason, items.filter((item) => item.reasons.includes(reason)).length]),
    ) as Record<ReplacementReason, number>,
  };
}
