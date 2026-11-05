import "server-only";

type ScopedUser = {
  role: "admin" | "officer" | "viewer";
  facilityId?: number | null;
  managedAssetFacilityIds?: number[];
};

export function isAdminUser(user: ScopedUser | null | undefined) {
  return user?.role === "admin";
}

export function getFacilityScopeId(user: ScopedUser | null | undefined) {
  if (!user) return null;
  if (isAdminUser(user)) return undefined;
  const facilityId = Number(user.facilityId ?? 0);
  return Number.isInteger(facilityId) && facilityId > 0 ? facilityId : null;
}

export function getAssetFacilityScopeIds(user: ScopedUser | null | undefined) {
  if (!user) return null;
  if (isAdminUser(user)) return undefined;
  const ownFacilityId = getFacilityScopeId(user);
  if (!ownFacilityId) return null;
  if (user.role !== "officer") return [ownFacilityId];
  return [...new Set([ownFacilityId, ...(user.managedAssetFacilityIds ?? [])])];
}

export function canAccessFacility(user: ScopedUser | null | undefined, facilityId: number | null | undefined) {
  if (!user || !facilityId) return false;
  if (isAdminUser(user)) return true;
  return Number(user.facilityId) === Number(facilityId);
}

export function resolveFacilityFilter(
  user: ScopedUser,
  requestedFacilityId?: number | null
): number | undefined | null {
  if (isAdminUser(user)) {
    return requestedFacilityId || undefined;
  }
  return getFacilityScopeId(user);
}

export type RequestedFacilityResult =
  | { ok: true; facilityId: number | undefined }
  | { ok: false; status: 403; error: string };

/**
 * Facility for list/export endpoints that accept ?facilityId=. A requested facility inside the user's
 * asset scope (own + managed facilities) is honoured; one outside it is refused (403) instead of being
 * silently replaced by the user's own facility. Without a request: admins get every facility (undefined),
 * everyone else their own facility.
 */
export function resolveRequestedAssetFacility(
  user: ScopedUser | null | undefined,
  requestedFacilityId?: number | null
): RequestedFacilityResult {
  const requested = Number.isSafeInteger(requestedFacilityId) && Number(requestedFacilityId) > 0 ? Number(requestedFacilityId) : undefined;
  const scopeIds = getAssetFacilityScopeIds(user);
  if (scopeIds === null) return { ok: false, status: 403, error: "No facility scope" };
  if (scopeIds === undefined) return { ok: true, facilityId: requested };
  if (requested === undefined) return { ok: true, facilityId: getFacilityScopeId(user) ?? undefined };
  if (!scopeIds.includes(requested)) return { ok: false, status: 403, error: "Facility outside your scope" };
  return { ok: true, facilityId: requested };
}
