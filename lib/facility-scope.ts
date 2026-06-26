import "server-only";

type ScopedUser = {
  role: "admin" | "officer" | "viewer";
  facilityId?: number | null;
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
