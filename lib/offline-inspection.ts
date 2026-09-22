/**
 * Offline inspection queue (shared by the scan panel and the batch API; no server imports).
 * Results scanned while offline are kept in the browser (localStorage, per round) and sent to
 * POST /api/inspection/[id]/results when the connection returns.
 */
export type QueuedResult = {
  /** Unique per scan, so a retried batch never double-counts in the UI. */
  clientId: string;
  itemId: number;
  assetId: number;
  inspectionStatus: "Found" | "Missing";
  /** Asset condition to record; "" = keep the current status. */
  assetStatus: string;
  conditionNote?: string;
  foundWorkGroupId?: number | null;
  foundLocation?: string;
  scannedAt: string;
};

export type SyncOutcome = { clientId: string; itemId: number; ok: boolean; code?: string; error?: string };

export const OFFLINE_BATCH_LIMIT = 100;

export function queueStorageKey(inspectionId: number) {
  return `atacs:inspection-queue:${inspectionId}`;
}

/** Adds a scan; a newer scan of the same item replaces the older one (last result wins). */
export function enqueueResult(queue: QueuedResult[], entry: QueuedResult) {
  return [...queue.filter((item) => item.itemId !== entry.itemId), entry];
}

/** Keeps only entries that failed with a retryable reason (network / server error). */
export function remainingAfterSync(queue: QueuedResult[], outcomes: SyncOutcome[]) {
  const done = new Set(outcomes.filter((outcome) => outcome.ok || outcome.code !== "retry").map((outcome) => outcome.clientId));
  return queue.filter((item) => !done.has(item.clientId));
}

export function parseQueue(raw: string | null): QueuedResult[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .filter((item) =>
        item && typeof item.clientId === "string" && item.clientId.length <= 64 && Number.isSafeInteger(item.itemId) && item.itemId > 0 &&
        (item.inspectionStatus === "Found" || item.inspectionStatus === "Missing"))
      .map((item): QueuedResult => ({
        clientId: item.clientId,
        itemId: item.itemId,
        assetId: Number(item.assetId) || 0,
        inspectionStatus: item.inspectionStatus,
        assetStatus: typeof item.assetStatus === "string" ? item.assetStatus : "",
        conditionNote: typeof item.conditionNote === "string" ? item.conditionNote.slice(0, 2000) : "",
        foundWorkGroupId: item.foundWorkGroupId === null ? null : Number.isSafeInteger(item.foundWorkGroupId) ? item.foundWorkGroupId : undefined,
        foundLocation: typeof item.foundLocation === "string" ? item.foundLocation.slice(0, 255) : "",
        scannedAt: typeof item.scannedAt === "string" ? item.scannedAt.slice(0, 40) : "",
      }));
  } catch {
    return [];
  }
}

/** Validates the body of a batch request; returns the entries or an error message. */
export function parseBatch(body: unknown): { entries: QueuedResult[] } | { error: string } {
  const results = (body as { results?: unknown } | null)?.results;
  if (!Array.isArray(results) || !results.length) return { error: "ไม่มีผลตรวจที่จะบันทึก" };
  if (results.length > OFFLINE_BATCH_LIMIT) return { error: `ส่งได้ครั้งละไม่เกิน ${OFFLINE_BATCH_LIMIT} รายการ` };
  const entries = parseQueue(JSON.stringify(results));
  if (entries.length !== results.length) return { error: "ข้อมูลผลตรวจบางรายการไม่ถูกต้อง" };
  return { entries };
}
