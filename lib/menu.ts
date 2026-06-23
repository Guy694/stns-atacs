import type { IconName } from "@/app/_components/ui/icon";

export type AppMenuGroupKey = "overview" | "assets" | "system";

export type AppMenuItem = {
  key: string;
  href: string;
  label: string;
  description: string;
  icon: IconName;
  group: AppMenuGroupKey;
  adminOnly?: boolean;
  officerOnly?: boolean;
  hideForViewer?: boolean;
  permissionKey?: string;
  exact?: boolean;
};

export const APP_MENU_GROUPS: Array<{ key: AppMenuGroupKey; label: string }> = [
  { key: "overview", label: "ภาพรวมและรายงาน" },
  { key: "assets", label: "งานทรัพย์สิน" },
  { key: "system", label: "ระบบและความปลอดภัย" },
];

export const APP_MENU_ITEMS: AppMenuItem[] = [
  {
    key: "dashboard",
    href: "/",
    label: "ภาพรวม",
    description: "หน้า dashboard หลักของระบบ",
    icon: "activity",
    group: "overview",
    exact: true,
  },
  {
    key: "reports",
    href: "/reports",
    label: "รายงาน",
    description: "รายงานสรุปและรายการ MA ใกล้หมดอายุ",
    icon: "file-text",
    group: "overview",
    permissionKey: "reports.view",
  },
  {
    key: "map",
    href: "/map",
    label: "แผนที่ทรัพย์สิน",
    description: "แสดงตำแหน่งหน่วยงานและทรัพย์สินบนแผนที่",
    icon: "map",
    group: "overview",
  },
  {
    key: "assets",
    href: "/assets",
    label: "ทรัพย์สินทั้งหมด",
    description: "ค้นหา เพิ่ม แก้ไข และจัดการทะเบียนทรัพย์สิน",
    icon: "package",
    group: "assets",
    permissionKey: "assets.view",
  },
  {
    key: "inspection",
    href: "/inspection",
    label: "ตรวจนับทรัพย์สิน",
    description: "บันทึกและตรวจสอบรอบตรวจนับทรัพย์สิน",
    icon: "clipboard-check",
    group: "assets",
    permissionKey: "inspection.view",
  },
  {
    key: "transfer",
    href: "/transfer",
    label: "โอนย้ายทรัพย์สิน",
    description: "จัดการการย้ายทรัพย์สินระหว่างหน่วยงาน",
    icon: "chevrons-left-right",
    group: "assets",
    hideForViewer: true,
    permissionKey: "transfer.manage",
  },
  {
    key: "disposal",
    href: "/disposal",
    label: "จำหน่ายและเหตุผิดปกติ",
    description: "บันทึกจำหน่าย ชำรุด สูญหาย หรือเหตุผิดปกติ",
    icon: "archive",
    group: "assets",
    hideForViewer: true,
    permissionKey: "disposal.manage",
  },
  {
    key: "agent-download",
    href: "/agent-download",
    label: "ดาวน์โหลด Agent",
    description: "ดาวน์โหลดและลงทะเบียน ATACS Agent",
    icon: "download",
    group: "system",
    officerOnly: true,
    permissionKey: "agent.manage",
  },
  {
    key: "admin-users",
    href: "/admin/users",
    label: "ผู้ใช้งาน",
    description: "จัดการบัญชี ผู้รออนุมัติ และบทบาทผู้ใช้",
    icon: "users",
    group: "system",
    permissionKey: "users.manage",
  },
  {
    key: "admin-settings",
    href: "/admin/settings",
    label: "ตั้งค่าระบบ",
    description: "ตั้งค่าระบบ เมนู หน่วยงาน และสิทธิ์",
    icon: "settings",
    group: "system",
    permissionKey: "permissions.manage",
  },
  {
    key: "admin-audit",
    href: "/admin/audit",
    label: "ประวัติการใช้งาน",
    description: "ตรวจสอบ audit log และกิจกรรมในระบบ",
    icon: "audit",
    group: "system",
    permissionKey: "audit.view",
  },
];

export function menuSettingKey(menuKey: string) {
  return `menu.${menuKey}.enabled`;
}
