// Copies asset photos saved by older versions (public/uploads/assets) into the protected upload folder
// (UPLOAD_DIR/assets, default storage/uploads/assets), so they are only served to signed-in users.
// Copies only (never deletes); existing files are skipped. After checking the photos in the app,
// delete public/uploads/assets yourself — while it exists those files stay reachable without login.
//   node scripts/move-legacy-uploads.mjs            (dry run: lists what would be copied)
//   node scripts/move-legacy-uploads.mjs --apply
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

const apply = process.argv.includes("--apply");
const source = path.join(process.cwd(), "public", "uploads", "assets");
const root = process.env.UPLOAD_DIR?.trim() ? path.resolve(process.env.UPLOAD_DIR.trim()) : path.join(process.cwd(), "storage", "uploads");
const target = path.join(root, "assets");

if (!fs.existsSync(source)) {
  console.log(`ไม่มีโฟลเดอร์รูปเดิม (${source}) — ไม่ต้องทำอะไร`);
  process.exit(0);
}
const files = fs.readdirSync(source).filter((name) => /\.(jpe?g|png|webp)$/i.test(name));
let copied = 0;
let skipped = 0;
if (apply) fs.mkdirSync(target, { recursive: true });
for (const name of files) {
  const to = path.join(target, name);
  if (fs.existsSync(to)) { skipped += 1; continue; }
  if (apply) fs.copyFileSync(path.join(source, name), to, fs.constants.COPYFILE_EXCL);
  copied += 1;
}
console.log(`${apply ? "คัดลอกแล้ว" : "จะคัดลอก"} ${copied} ไฟล์ · มีอยู่แล้ว ${skipped} ไฟล์ · จาก ${source} → ${target}`);
if (!apply) console.log("รันซ้ำพร้อม --apply เพื่อคัดลอกจริง");
else console.log("ตรวจรูปในระบบแล้ว ให้ลบโฟลเดอร์ public/uploads/assets เอง (ขณะที่ยังอยู่ ไฟล์เดิมยังเปิดได้โดยไม่ต้องล็อกอิน)");
