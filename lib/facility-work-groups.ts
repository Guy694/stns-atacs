import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { executeStatement, selectRows } from "@/lib/mysql";

export type FacilityAgentContext = {
  id: number;
  name: string;
  typecode: string;
  districtName: string | null;
  requiresWorkGroup: boolean;
};

export type FacilityWorkGroupOption = {
  id: number;
  facilityId: number;
  facilityName: string;
  workGroupName: string;
};

export type WorkGroupManagerUser = {
  role: "admin" | "officer" | "viewer";
  facilityId?: number | null;
};

export type WorkGroupFacilityOption = {
  id: number;
  name: string;
  typecode: string;
  districtName: string | null;
  requiresWorkGroup: boolean;
};

export type FacilityWorkGroupManageRow = FacilityWorkGroupOption & {
  facilityTypeCode: string;
  districtName: string | null;
  isActive: boolean;
};

type FacilityAgentContextRow = RowDataPacket & {
  id: number;
  name: string;
  typecode: string;
  district_name: string | null;
};

type FacilityWorkGroupRow = RowDataPacket & {
  id: number;
  facility_id: number;
  facility_name: string;
  facility_typecode?: string;
  district_name?: string | null;
  work_group_name: string;
  is_active?: number;
};

type InsertedIdRow = RowDataPacket & { id: number };

type WorkGroupFacilityRow = RowDataPacket & {
  id: number;
  name: string;
  typecode: string;
  district_name: string | null;
};

export function normalizeWorkGroupName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function requiresAgentWorkGroup(typecode: string | null | undefined) {
  const code = (typecode ?? "").trim();
  if (code === "สสจ." || code === "สสจ") return true;
  if (code === "สสอ." || code === "สสอ") return true;
  if (code === "รพ.สต." || code === "รพ.สต") return false;
  return code.startsWith("รพ.");
}

function toFacilityContext(row: FacilityAgentContextRow): FacilityAgentContext {
  return {
    id: row.id,
    name: row.name,
    typecode: row.typecode,
    districtName: row.district_name,
    requiresWorkGroup: requiresAgentWorkGroup(row.typecode),
  };
}

function toWorkGroupOption(row: FacilityWorkGroupRow): FacilityWorkGroupOption {
  return {
    id: row.id,
    facilityId: row.facility_id,
    facilityName: row.facility_name,
    workGroupName: row.work_group_name,
  };
}

function toWorkGroupManageRow(row: FacilityWorkGroupRow): FacilityWorkGroupManageRow {
  return {
    ...toWorkGroupOption(row),
    facilityTypeCode: row.facility_typecode ?? "",
    districtName: row.district_name ?? null,
    isActive: Boolean(row.is_active),
  };
}

function toWorkGroupFacilityOption(row: WorkGroupFacilityRow): WorkGroupFacilityOption {
  return {
    id: row.id,
    name: row.name,
    typecode: row.typecode,
    districtName: row.district_name,
    requiresWorkGroup: requiresAgentWorkGroup(row.typecode),
  };
}

export async function getFacilityAgentContext(facilityId: number) {
  const rows = await selectRows<FacilityAgentContextRow>(
    `SELECT id, name, typecode, district_name
     FROM health_facilities
     WHERE id = ? AND is_active = 1
     LIMIT 1`,
    [facilityId]
  );
  return rows[0] ? toFacilityContext(rows[0]) : null;
}

export async function listFacilitiesRequiringWorkGroups(): Promise<WorkGroupFacilityOption[]> {
  const rows = await selectRows<WorkGroupFacilityRow>(
    `SELECT id, name, typecode, district_name
     FROM health_facilities
     WHERE is_active = 1
     ORDER BY district_name, typecode DESC, name`
  );

  return rows.map(toWorkGroupFacilityOption).filter((facility) => facility.requiresWorkGroup);
}

export async function listManageableWorkGroupFacilitiesForUser(
  user: WorkGroupManagerUser
): Promise<WorkGroupFacilityOption[]> {
  if (user.role === "admin") {
    return listFacilitiesRequiringWorkGroups();
  }

  if (user.role !== "officer" || !user.facilityId) {
    return [];
  }

  const ownFacility = await getFacilityAgentContext(Number(user.facilityId));
  if (!ownFacility?.requiresWorkGroup) {
    return [];
  }

  return [
    {
      id: ownFacility.id,
      name: ownFacility.name,
      typecode: ownFacility.typecode,
      districtName: ownFacility.districtName,
      requiresWorkGroup: ownFacility.requiresWorkGroup,
    },
  ];
}

export async function listFacilityWorkGroups(facilityId?: number): Promise<FacilityWorkGroupOption[]> {
  try {
    const values: unknown[] = [];
    const where = facilityId ? "WHERE fwg.facility_id = ? AND fwg.is_active = 1" : "WHERE fwg.is_active = 1";
    if (facilityId) values.push(facilityId);

    const rows = await selectRows<FacilityWorkGroupRow>(
      `SELECT fwg.id, fwg.facility_id, hf.name AS facility_name, fwg.work_group_name
       FROM facility_work_groups fwg
       JOIN health_facilities hf ON hf.id = fwg.facility_id
       ${where}
       ORDER BY hf.district_name, hf.name, fwg.sort_order, fwg.work_group_name`,
      values
    );
    return rows.map(toWorkGroupOption);
  } catch {
    return [];
  }
}

export async function listFacilityWorkGroupsForFacilities(
  facilityIds: number[],
  includeInactive = false
): Promise<FacilityWorkGroupManageRow[]> {
  if (facilityIds.length === 0) return [];

  const placeholders = facilityIds.map(() => "?").join(",");
  const activeClause = includeInactive ? "" : "AND fwg.is_active = 1";
  const rows = await selectRows<FacilityWorkGroupRow>(
    `SELECT
       fwg.id,
       fwg.facility_id,
       hf.name AS facility_name,
       hf.typecode AS facility_typecode,
       hf.district_name,
       fwg.work_group_name,
       fwg.is_active
     FROM facility_work_groups fwg
     JOIN health_facilities hf ON hf.id = fwg.facility_id
     WHERE fwg.facility_id IN (${placeholders}) ${activeClause}
     ORDER BY hf.district_name, hf.name, fwg.sort_order, fwg.work_group_name`,
    facilityIds
  );

  return rows.map(toWorkGroupManageRow);
}

export async function getFacilityWorkGroupById(id: number) {
  const rows = await selectRows<FacilityWorkGroupRow>(
    `SELECT
       fwg.id,
       fwg.facility_id,
       hf.name AS facility_name,
       hf.typecode AS facility_typecode,
       hf.district_name,
       fwg.work_group_name,
       fwg.is_active
     FROM facility_work_groups fwg
     JOIN health_facilities hf ON hf.id = fwg.facility_id
     WHERE fwg.id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] ? toWorkGroupManageRow(rows[0]) : null;
}

export async function findOrCreateFacilityWorkGroup(facilityId: number, rawName: string) {
  const workGroupName = normalizeWorkGroupName(rawName);
  if (!workGroupName) return null;

  await executeStatement(
    `INSERT INTO facility_work_groups (facility_id, work_group_name, is_active)
     VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE
       is_active = 1,
       updated_at = CURRENT_TIMESTAMP`,
    [facilityId, workGroupName]
  );

  const rows = await selectRows<InsertedIdRow>(
    `SELECT id
     FROM facility_work_groups
     WHERE facility_id = ? AND work_group_name = ?
     LIMIT 1`,
    [facilityId, workGroupName]
  );
  return rows[0]?.id ?? null;
}

export async function findActiveFacilityWorkGroup(facilityId: number, rawName: string) {
  const workGroupName = normalizeWorkGroupName(rawName);
  if (!workGroupName) return null;

  const rows = await selectRows<FacilityWorkGroupRow>(
    `SELECT
       fwg.id,
       fwg.facility_id,
       hf.name AS facility_name,
       fwg.work_group_name,
       fwg.is_active
     FROM facility_work_groups fwg
     JOIN health_facilities hf ON hf.id = fwg.facility_id
     WHERE fwg.facility_id = ?
       AND fwg.work_group_name = ?
       AND fwg.is_active = 1
     LIMIT 1`,
    [facilityId, workGroupName]
  );

  return rows[0] ? toWorkGroupOption(rows[0]) : null;
}

export async function getActiveFacilityWorkGroupForFacility(facilityId: number, workGroupId: number) {
  if (!Number.isInteger(workGroupId) || workGroupId <= 0) return null;

  const rows = await selectRows<FacilityWorkGroupRow>(
    `SELECT
       fwg.id,
       fwg.facility_id,
       hf.name AS facility_name,
       fwg.work_group_name,
       fwg.is_active
     FROM facility_work_groups fwg
     JOIN health_facilities hf ON hf.id = fwg.facility_id
     WHERE fwg.id = ?
       AND fwg.facility_id = ?
       AND fwg.is_active = 1
     LIMIT 1`,
    [workGroupId, facilityId]
  );

  return rows[0] ? toWorkGroupOption(rows[0]) : null;
}

export async function setFacilityWorkGroupActive(id: number, active: boolean) {
  return executeStatement(
    `UPDATE facility_work_groups
     SET is_active = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [active ? 1 : 0, id]
  );
}
