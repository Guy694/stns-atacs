// One place for the system's name and owner (B1). Change here, not in pages.
export const APP_NAME = "ระบบทะเบียนทรัพย์สินและครุภัณฑ์";
export const APP_ORG = "สำนักงานสาธารณสุขจังหวัดสตูล";
export const APP_SCOPE = "หน่วยงานในสังกัด สป. จังหวัดสตูล";
export const APP_SHORT = "ATACS Satun";
export const APP_TAGLINE = "Asset Tracking and Control System";

/** Thai names of the account roles, for badges and menus. */
export const ROLE_LABELS: Record<string, string> = { admin: "ผู้ดูแลระบบ", officer: "เจ้าหน้าที่", viewer: "ผู้ดูข้อมูล" };
export const roleLabel = (role: string) => ROLE_LABELS[role] ?? role;
