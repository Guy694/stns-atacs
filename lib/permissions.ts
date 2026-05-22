import "server-only";

type Role = "admin" | "officer" | "viewer";

type PermissionUser = {
  role: Role;
  facilityId?: number | null;
};

export function canManageFacility(user: PermissionUser | null, facilityId: number | null | undefined) {
  if (!user || !facilityId) return false;
  if (user.role === "admin") return true;
  return user.role === "officer" && Number(user.facilityId) === Number(facilityId);
}

export function canMutateAssets(user: PermissionUser | null) {
  return !!user && user.role !== "viewer";
}

export function canManageAsset(user: PermissionUser | null, facilityId: number | null | undefined) {
  if (!canMutateAssets(user)) return false;
  return canManageFacility(user, facilityId);
}

export function canManageAllFacilities(user: PermissionUser | null) {
  return !!user && user.role === "admin";
}

export function canSeeSensitiveAssetNetwork(user: PermissionUser | null, facilityId: number | null | undefined) {
  return canManageAsset(user, facilityId);
}