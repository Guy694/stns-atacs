export type AppRole = "admin" | "officer" | "viewer";

export const APP_ROLES: AppRole[] = ["admin", "officer", "viewer"];

export const PERMISSION_DEFINITIONS = [
  { key: "assets.view", label: "ดูรายการทรัพย์สิน", area: "Assets" },
  { key: "assets.create", label: "เพิ่มทรัพย์สิน", area: "Assets" },
  { key: "assets.update", label: "แก้ไขทรัพย์สิน", area: "Assets" },
  { key: "assets.delete", label: "ลบทรัพย์สิน", area: "Assets" },
  { key: "assets.network.view", label: "ดูข้อมูล IP/Network", area: "Assets" },
  { key: "transfer.manage", label: "โอนย้ายทรัพย์สิน", area: "Operations" },
  { key: "disposal.manage", label: "จำหน่าย/ชำรุด/สูญหาย", area: "Operations" },
  { key: "inspection.view", label: "ดูผลตรวจนับ", area: "Operations" },
  { key: "inspection.create", label: "สร้างรอบตรวจนับ", area: "Operations" },
  { key: "reports.view", label: "ดูรายงาน", area: "Reporting" },
  { key: "audit.view", label: "ดู Audit Log", area: "Security" },
  { key: "audit.export", label: "Export Audit Log", area: "Security" },
  { key: "users.manage", label: "จัดการผู้ใช้งาน", area: "Administration" },
  { key: "facilities.manage", label: "จัดการหน่วยงาน", area: "Administration" },
  { key: "device-types.manage", label: "จัดการประเภทอุปกรณ์", area: "Administration" },
  { key: "permissions.manage", label: "จัดการ Permission Matrix", area: "Administration" },
  { key: "agent.manage", label: "จัดการ Agent", area: "Administration" },
] as const;

export type PermissionKey = (typeof PERMISSION_DEFINITIONS)[number]["key"];
