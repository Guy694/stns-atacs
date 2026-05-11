#!/usr/bin/env node
/**
 * generate-seed-users.mjs
 *
 * สร้าง SQL INSERT สำหรับข้อมูล user ตัวอย่าง
 * รันด้วย:  node scripts/generate-seed-users.mjs > database/seed_users.sql
 *
 * ตัวอย่าง user ที่สร้าง:
 *  1. admin       — ThaiD + username/password  (ใช้ได้ทั้งสองช่องทาง)
 *  2. officer1    — ThaiD เท่านั้น
 *  3. officer2    — username/password เท่านั้น (ไม่มี ThaiD)
 */

import crypto from "node:crypto";

// ── hash ตาม format เดียวกับ lib/auth.ts hashPassword() ──────────────────
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function esc(value) {
  if (value === null) return "NULL";
  return `'${String(value).replace(/'/g, "\\'")}'`;
}

// ── ข้อมูล user ตัวอย่าง ────────────────────────────────────────────────
const users = [
  {
    thaid_cid: "3901900015481",
    full_name: "อิรฟาน หลงเด็น",
    email: "irfan.admin@satun.moph.go.th",
    username: "atacs_admin",
    password: "Admin@2026",
    role: "admin",
    is_active: 1,
    note: "admin — ThaiD + username/password",
  },
  {
    thaid_cid: "3900600012345",
    full_name: "สุชาดา ทองมาก",
    email: "suchada.officer@satun.moph.go.th",
    username: null,
    password: null,
    role: "officer",
    is_active: 1,
    note: "officer — ThaiD เท่านั้น",
  },
  {
    thaid_cid: null,
    full_name: "นครินทร์ ชายสิทธิ์",
    email: "nakharin.officer@satun.moph.go.th",
    username: "nakharin",
    password: "Officer@2026",
    role: "officer",
    is_active: 1,
    note: "officer — username/password เท่านั้น",
  },
  {
    thaid_cid: "1901900088812",
    full_name: "ธนพล รัตนะ",
    email: null,
    username: "thanaphon.r",
    password: "Staff@2026",
    role: "officer",
    is_active: 1,
    note: "officer — ThaiD + username/password (ไม่มี email)",
  },
];

// ── output SQL ────────────────────────────────────────────────────────────
const lines = [
  "-- ==========================================================",
  "-- seed_users.sql  —  ข้อมูล user ตัวอย่างสำหรับ ATACS",
  "-- สร้างจาก scripts/generate-seed-users.mjs",
  `-- วันที่สร้าง: ${new Date().toISOString()}`,
  "--",
  "-- ⚠️  ไฟล์นี้มีรหัสผ่าน plaintext อยู่ใน comment",
  "--     ห้ามนำขึ้น production โดยไม่เปลี่ยนรหัสผ่าน",
  "-- ==========================================================",
  "",
  "-- รันหลังจาก auth.sql และ add_password_auth.sql แล้วเท่านั้น",
  "",
  "INSERT INTO `users`",
  "  (`thaid_cid`, `full_name`, `email`, `username`, `password_hash`, `role`, `is_active`)",
  "VALUES",
];

const valueRows = users.map((u, i) => {
  const hash = u.password ? hashPassword(u.password) : null;
  const comma = i < users.length - 1 ? "," : ";";
  const comment = `  -- [${u.role.toUpperCase()}] ${u.note}${u.password ? ` | password: ${u.password}` : ""}`;
  const row = `  (${esc(u.thaid_cid)}, ${esc(u.full_name)}, ${esc(u.email)}, ${esc(u.username)}, ${esc(hash)}, ${esc(u.role)}, ${u.is_active})${comma}`;
  return `${comment}\n${row}`;
});

lines.push(...valueRows);

lines.push(
  "",
  "-- ตรวจสอบผลลัพธ์",
  "SELECT id, thaid_cid, full_name, email, username,",
  "       IF(password_hash IS NOT NULL, 'SET', 'NONE') AS pwd_status,",
  "       role, is_active",
  "FROM users",
  "ORDER BY id;",
);

console.log(lines.join("\n"));
