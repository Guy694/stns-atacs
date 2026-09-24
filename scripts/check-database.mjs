import "dotenv/config";
import fs from "node:fs";
import mysql from "mysql2/promise";

// Read-only health check of the ATACS database (MySQL or MariaDB/XAMPP).
// Usage:  node scripts/check-database.mjs
// Reads MYSQL_* or DB_* from the environment or .env. Makes no database changes.
// Writes the result to database-check-report.txt in the project folder (no passwords or personal data).

const lines = [];
const out = (text = "") => { lines.push(text); console.log(text); };
const ok = (text) => out(`  [OK]   ${text}`);
const bad = (text) => out(`  [ขาด] ${text}`);
const warn = (text) => out(`  [เตือน] ${text}`);
const databaseEnv = (name, fallbackName) => process.env[name]?.trim() || process.env[fallbackName]?.trim();

const config = {
  host: databaseEnv("MYSQL_HOST", "DB_HOST"),
  port: Number(databaseEnv("MYSQL_PORT", "DB_PORT") || 3306),
  user: databaseEnv("MYSQL_USER", "DB_USER"),
  password: databaseEnv("MYSQL_PASSWORD", "DB_PASSWORD"),
  database: databaseEnv("MYSQL_DATABASE", "DB_NAME"),
};

// What each migration adds; the app works without later ones but hides the related features.
// สิ่งที่แต่ละ migration เพิ่ม — เก็บไว้ที่ database/schema-requirements.json เพื่อให้แอปใช้รายการเดียวกัน
const MIGRATIONS = JSON.parse(
  fs.readFileSync(new URL("../database/schema-requirements.json", import.meta.url), "utf8")
);

let connection;
try {
  if (!config.host || !config.user || !config.database) throw new Error("ไม่พบ MYSQL_HOST/MYSQL_USER/MYSQL_DATABASE หรือ DB_HOST/DB_USER/DB_NAME");
  connection = await mysql.createConnection(config);
} catch (error) {
  out(`เชื่อมต่อฐานข้อมูลไม่ได้: ${error.code ?? ""} ${error.message}`);
  out(`ตรวจว่า XAMPP เปิด MySQL อยู่ และ .env ชี้ไปที่ host=${config.host ?? "-"} port=${config.port} database=${config.database ?? "-"}`);
  fs.writeFileSync("database-check-report.txt", lines.join("\n"), "utf8");
  process.exit(1);
}

const q = async (sql, values = []) => (await connection.query(sql, values))[0];
const has = { tables: new Set(), columns: new Map() };

try {
  const [{ v, db }] = await q("SELECT VERSION() AS v, DATABASE() AS db");
  const mariadb = /mariadb/i.test(v);
  out(`ATACS database check · ${new Date().toISOString()}`);
  out(`Server: ${v} (${mariadb ? "MariaDB" : "MySQL"}) · database: ${db}`);
  const [major, minor] = v.split(/[.-]/).map(Number);
  if (mariadb && (major < 10 || (major === 10 && minor < 2))) warn("MariaDB ต่ำกว่า 10.2 ไม่บังคับ CHECK constraint (ระบบยังตรวจในแอปอยู่)");
  if (!mariadb && (major < 8 || (major === 8 && minor === 0 && Number(v.split(".")[2]) < 16))) warn("MySQL ต่ำกว่า 8.0.16 ไม่บังคับ CHECK constraint (ระบบยังตรวจในแอปอยู่)");

  const [{ charset, collation }] = await q("SELECT DEFAULT_CHARACTER_SET_NAME AS charset, DEFAULT_COLLATION_NAME AS collation FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = DATABASE()");
  out(`Charset: ${charset} / ${collation}`);
  if (charset !== "utf8mb4") warn("ฐานข้อมูลไม่ใช่ utf8mb4 อาจมีปัญหากับภาษาไทยบางตัว/อีโมจิ");

  for (const row of await q("SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()")) has.tables.add(row.t);
  for (const row of await q("SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()")) {
    if (!has.columns.has(row.t)) has.columns.set(row.t, new Set());
    has.columns.get(row.t).add(row.c);
  }
  const hasColumn = (table, column) => has.columns.get(table)?.has(column) ?? false;

  out("");
  out("1) Migration");
  const pending = [];
  for (const migration of MIGRATIONS) {
    const missing = [
      ...migration.tables.filter((t) => !has.tables.has(t)).map((t) => `ตาราง ${t}`),
      ...Object.entries(migration.columns).flatMap(([t, cols]) => cols.filter((c) => !hasColumn(t, c)).map((c) => `${t}.${c}`)),
    ];
    if (missing.length) { bad(`${migration.file}: ${missing.join(", ")}`); pending.push(migration.file); }
    else ok(migration.file);
  }

  out("");
  out("2) จำนวนข้อมูล");
  const count = async (table, where = "") => (has.tables.has(table) ? Number((await q(`SELECT COUNT(*) AS n FROM \`${table}\` ${where}`))[0].n) : null);
  for (const table of ["health_facilities", "information_asset_surveys", "information_assets", "asset_inspections", "asset_inspection_items", "asset_transfers", "asset_disposal_requests", "asset_repairs", "asset_loans", "asset_status_history", "audit_logs", "users"]) {
    const n = await count(table);
    out(`  ${table.padEnd(28)} ${n === null ? "(ไม่มีตาราง)" : n.toLocaleString("en-US")}`);
  }

  out("");
  out("3) ความถูกต้องของข้อมูล (อ่านอย่างเดียว)");
  const check = async (label, sql, level = "bad") => {
    try {
      const n = Number((await q(sql))[0].n);
      if (n === 0) ok(label);
      else (level === "warn" ? warn : bad)(`${label}: ${n.toLocaleString("en-US")} รายการ`);
    } catch (error) {
      warn(`${label}: ตรวจไม่ได้ (${error.code ?? error.message})`);
    }
  };

  await check("ครุภัณฑ์ที่ survey_id ไม่มีอยู่จริง", "SELECT COUNT(*) AS n FROM information_assets a LEFT JOIN information_asset_surveys s ON s.id = a.survey_id WHERE s.id IS NULL");
  await check("แบบสำรวจที่หน่วยงานไม่มีอยู่จริง", "SELECT COUNT(*) AS n FROM information_asset_surveys s LEFT JOIN health_facilities hf ON hf.id = s.facility_id WHERE hf.id IS NULL");
  const statuses = await q("SELECT COALESCE(current_status, '(ว่าง)') AS s, COUNT(*) AS n FROM information_assets GROUP BY current_status ORDER BY n DESC");
  out(`  สถานะที่พบ: ${statuses.map((r) => `${r.s}=${r.n}`).join(", ")}`);
  const unknown = statuses.filter((r) => !["Active", "Inactive", "Broken", "Disposed", "Lost"].includes(r.s));
  if (unknown.length) warn(`สถานะนอกมาตรฐาน (ระบบอ่าน ใช้งานได้/ชำรุด ฯลฯ ได้ แต่ควรแปลงเป็นรหัสอังกฤษ): ${unknown.map((r) => `${r.s}=${r.n}`).join(", ")}`);
  else ok("สถานะครุภัณฑ์เป็นรหัสมาตรฐานทั้งหมด");
  await check("วันที่ได้มาอยู่ในอนาคต", "SELECT COUNT(*) AS n FROM information_assets WHERE purchase_date > CURDATE()", "warn");
  await check("ราคาติดลบ", "SELECT COUNT(*) AS n FROM information_assets WHERE purchase_price < 0");
  await check("เลขครุภัณฑ์ซ้ำภายในหน่วยงานเดียวกัน",
    "SELECT COUNT(*) AS n FROM (SELECT s.facility_id, TRIM(a.asset_registration_no) r FROM information_assets a JOIN information_asset_surveys s ON s.id = a.survey_id WHERE NULLIF(TRIM(a.asset_registration_no), '') IS NOT NULL GROUP BY s.facility_id, TRIM(a.asset_registration_no) HAVING COUNT(*) > 1) d", "warn");
  await check("Serial Number ซ้ำภายในหน่วยงานเดียวกัน",
    "SELECT COUNT(*) AS n FROM (SELECT s.facility_id, TRIM(a.serial_number) sn FROM information_assets a JOIN information_asset_surveys s ON s.id = a.survey_id WHERE CHAR_LENGTH(TRIM(a.serial_number)) >= 3 AND UPPER(TRIM(a.serial_number)) NOT IN ('-','--','N/A','NA','NONE','ไม่มี','ไม่ระบุ') GROUP BY s.facility_id, TRIM(a.serial_number) HAVING COUNT(*) > 1) d", "warn");
  if (hasColumn("information_assets", "work_group_id") && has.tables.has("facility_work_groups")) {
    await check("กลุ่มงานของครุภัณฑ์ไม่อยู่ในหน่วยงานเดียวกัน",
      "SELECT COUNT(*) AS n FROM information_assets a JOIN information_asset_surveys s ON s.id = a.survey_id JOIN facility_work_groups w ON w.id = a.work_group_id WHERE w.facility_id <> s.facility_id", "warn");
  }
  if (has.tables.has("asset_inspection_items")) {
    await check("รายการตรวจนับที่ครุภัณฑ์ถูกลบไปแล้ว", "SELECT COUNT(*) AS n FROM asset_inspection_items i LEFT JOIN information_assets a ON a.id = i.asset_id WHERE a.id IS NULL");
    await check("รายการตรวจนับที่รอบถูกลบไปแล้ว", "SELECT COUNT(*) AS n FROM asset_inspection_items i LEFT JOIN asset_inspections r ON r.id = i.inspection_id WHERE r.id IS NULL");
  }
  if (hasColumn("asset_inspections", "round_status")) await check("สถานะรอบตรวจนับไม่ถูกต้อง", "SELECT COUNT(*) AS n FROM asset_inspections WHERE round_status NOT IN ('Open','Closed')");
  if (has.tables.has("asset_inspection_committee")) {
    await check("รอบตรวจนับที่มีประธานกรรมการมากกว่า 1 คน", "SELECT COUNT(*) AS n FROM (SELECT inspection_id FROM asset_inspection_committee WHERE role = 'chair' GROUP BY inspection_id HAVING COUNT(*) > 1) d");
  }
  if (has.tables.has("asset_disposal_requests")) {
    await check("ครุภัณฑ์ที่มีคำขอจำหน่ายรออนุมัติมากกว่า 1 คำขอ", "SELECT COUNT(*) AS n FROM (SELECT asset_id FROM asset_disposal_requests WHERE status = 'Pending' GROUP BY asset_id HAVING COUNT(*) > 1) d");
    await check("สถานะจำหน่าย/สูญหายที่ไม่มีคำขออนุมัติ (ข้อมูลก่อนมีระบบอนุมัติ)",
      "SELECT COUNT(*) AS n FROM information_assets a WHERE a.current_status IN ('Disposed','Lost') AND NOT EXISTS (SELECT 1 FROM asset_disposal_requests r WHERE r.asset_id = a.id AND r.status = 'Approved')", "warn");
    await check("คำขอที่อนุมัติแล้วแต่ครุภัณฑ์ไม่อยู่ในสถานะจำหน่าย/สูญหาย",
      "SELECT COUNT(*) AS n FROM asset_disposal_requests r JOIN information_assets a ON a.id = r.asset_id WHERE r.status = 'Approved' AND COALESCE(a.current_status, '') <> r.request_type");
    await check("ผู้เสนออนุมัติคำขอของตนเอง", "SELECT COUNT(*) AS n FROM asset_disposal_requests WHERE status = 'Approved' AND requested_by_user_id IS NOT NULL AND requested_by_user_id = decided_by_user_id");
    if (hasColumn("asset_disposal_requests", "executed_on")) {
      await check("อนุมัติจำหน่ายแล้วแต่ยังไม่บันทึกผลการจำหน่าย", "SELECT COUNT(*) AS n FROM asset_disposal_requests WHERE status = 'Approved' AND request_type = 'Disposed' AND executed_on IS NULL", "warn");
    }
  }
  if (has.tables.has("asset_repairs")) {
    await check("ครุภัณฑ์ที่มีงานซ่อมเปิดอยู่มากกว่า 1 งาน", "SELECT COUNT(*) AS n FROM (SELECT asset_id FROM asset_repairs WHERE status IN ('Reported','InProgress','SentToVendor') GROUP BY asset_id HAVING COUNT(*) > 1) d");
    await check("งานซ่อมเปิดอยู่ของครุภัณฑ์ที่จำหน่าย/สูญหายแล้ว", "SELECT COUNT(*) AS n FROM asset_repairs r JOIN information_assets a ON a.id = r.asset_id WHERE r.status IN ('Reported','InProgress','SentToVendor') AND a.current_status IN ('Disposed','Lost')");
  }
  if (has.tables.has("asset_loans")) {
    await check("ครุภัณฑ์ที่ถูกยืมอยู่มากกว่า 1 รายการ", "SELECT COUNT(*) AS n FROM (SELECT asset_id FROM asset_loans WHERE status = 'OnLoan' GROUP BY asset_id HAVING COUNT(*) > 1) d");
    await check("การยืมที่เกินกำหนดคืน", "SELECT COUNT(*) AS n FROM asset_loans WHERE status = 'OnLoan' AND due_on < CURDATE()", "warn");
  }
  if (has.tables.has("asset_transfers")) {
    await check("ประวัติโอนย้ายที่หน่วยงานปลายทางไม่ตรงกับหน่วยงานปัจจุบัน (โอนล่าสุด)",
      `SELECT COUNT(*) AS n FROM asset_transfers t JOIN information_assets a ON a.id = t.asset_id JOIN information_asset_surveys s ON s.id = a.survey_id
       WHERE t.id = (SELECT MAX(t2.id) FROM asset_transfers t2 WHERE t2.asset_id = t.asset_id) AND t.to_facility_id <> s.facility_id`, "warn");
  }

  out("");
  out("4) Foreign key ที่ระบบใช้");
  const fks = await q(`SELECT TABLE_NAME AS t, CONSTRAINT_NAME AS c, REFERENCED_TABLE_NAME AS r FROM information_schema.KEY_COLUMN_USAGE
                      WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY TABLE_NAME`);
  const expected = [["information_assets", "information_asset_surveys"], ["asset_inspection_items", "asset_inspections"], ["asset_inspection_items", "information_assets"],
    ["asset_disposal_requests", "information_assets"], ["asset_repairs", "information_assets"], ["asset_transfers", "information_assets"], ["asset_loans", "information_assets"], ["asset_inspection_committee", "asset_inspections"]];
  for (const [table, ref] of expected) {
    if (!has.tables.has(table)) continue;
    if (fks.some((fk) => fk.t === table && fk.r === ref)) ok(`${table} → ${ref}`);
    else warn(`${table} ไม่มี foreign key ไป ${ref} (ข้อมูลอาจค้างเมื่อลบ)`);
  }

  out("");
  out(pending.length ? `สรุป: ยังต้องรัน ${pending.length} ไฟล์ตามลำดับ → ${pending.join(" → ")}` : "สรุป: migration ครบทุกไฟล์");
  out("ขั้นก่อนรัน migration: สำรองฐานข้อมูล (phpMyAdmin → Export หรือ mysqldump) และเปิดดูว่าไฟล์สำรองไม่ใช่ 0 ไบต์");
} catch (error) {
  out(`เกิดข้อผิดพลาดระหว่างตรวจ: ${error.code ?? ""} ${error.message}`);
  process.exitCode = 1;
} finally {
  await connection.end();
  fs.writeFileSync("database-check-report.txt", lines.join("\n"), "utf8");
  console.log("\nบันทึกผลที่ database-check-report.txt");
}
