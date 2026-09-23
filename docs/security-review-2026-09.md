# รายงานตรวจสอบความปลอดภัย ATACS Satun (ก.ย. 2569)

- วันที่ตรวจ: 22 กันยายน 2569 (2026-09-22)
- ขอบเขต: โค้ดทั้งโปรเจกต์ `stns-atacs` (Next.js 16, MySQL/MariaDB) — การยืนยันตัวตน, สิทธิ์การเข้าถึง, การรับข้อมูล/อัปโหลด/ส่งออก, ระบบ Agent, Docker/โครงสร้างพื้นฐาน, ไฟล์ในโปรเจกต์
- วิธีตรวจ: อ่านโค้ด (static review) ไม่ได้ทดสอบเจาะระบบจริง และยังไม่ได้แก้โค้ดใด ๆ ตามรายงานนี้
- เลขบรรทัดอ้างอิงโค้ด ณ วันที่ตรวจ อาจเลื่อนเมื่อแก้ไฟล์ ให้ค้นด้วยชื่อฟังก์ชันประกอบ
- เอกสารนี้ระบุจุดอ่อนของระบบ — เก็บใน repository แบบ private เท่านั้น

ระดับความรุนแรง: **สูง** = ถูกใช้โจมตีได้จริงด้วยบัญชีทั่วไปหรือไม่ต้องล็อกอิน · **กลาง** = ต้องมีเงื่อนไขเพิ่มหรือผลกระทบจำกัด · **ต่ำ** = เสริมความแข็งแรง

สถานะ: ☐ ยังไม่แก้ · ☑ แก้แล้ว (ใส่วันที่/commit)

> **อัปเดต 23 ก.ย. 2569:** แก้ระดับสูงครบทั้ง 7 ข้อแล้ว (SEC-01 – SEC-07) รายละเอียดอยู่ใต้หัวข้อแต่ละข้อ
> งานที่ยังต้องทำด้วยมือ: รัน `database/add_thaid_link_approval.sql`, ตรวจบัญชี seed ด้วย `database/check_seed_accounts.sql`,
> ตั้งค่า `AGENT_API_BASE_ALLOWED_HOSTS` และเปลี่ยน `ATACS_AGENT_INSTALL_KEY` เป็นคีย์รายหน่วยงาน,
> และลบไฟล์ที่รั่วออกจาก git history พร้อมเปลี่ยนรหัสผ่าน/ข้อมูลที่หลุด

---

## สรุป

| ระดับ | จำนวน | รหัส |
|---|---|---|
| สูง | 7 | SEC-01 – SEC-07 |
| กลาง | 16 | SEC-08 – SEC-23 |
| ต่ำ | 15 | SEC-24 – SEC-38 |

ข้อที่อันตรายที่สุดคือ **SEC-01 + SEC-02** ใช้ร่วมกัน: เจ้าหน้าที่ รพ.สต. คนเดียวขยายสิทธิ์ข้ามอำเภอ และฝังสคริปต์ให้ทำงานในเซสชันของแอดมินได้

ลำดับการแก้ที่แนะนำ
1. ระยะที่ 1 (ด่วน ~ครึ่งวัน ไม่ต้องแก้ฐานข้อมูล): SEC-01 – SEC-07
2. ระยะที่ 2: SEC-08 – SEC-16 (ล็อกอิน, CSV, ไฟล์นำเข้า, Agent)
3. ระยะที่ 3: SEC-17 – SEC-23 และข้อระดับต่ำ

---

## ระดับสูง

### SEC-01 ☑ เจ้าหน้าที่แก้ประเภท/อำเภอของหน่วยงานตัวเอง → ได้สิทธิ์ทั้งอำเภอ
- **แก้แล้ว:** 23 กันยายน 2569 — ล็อกการแก้ typecode/district ไว้ที่แอดมิน ทั้ง updateFacilitySelfAction และ updateFacilityAction (บันทึก audit เมื่อถูกปฏิเสธ)
- **ไฟล์:** `app/(main)/facilities/[id]/actions.ts` — `updateFacilitySelfAction` (ประมาณบรรทัด 17–50)
- **ปัญหา:** ตรวจแค่ไม่ใช่ viewer และเป็นหน่วยงานของตัวเอง ไม่ตรวจ `hasPermission(role, "facilities.manage")` และเขียน `typecode`, `districtName` จาก FormData ลงฐานข้อมูลตรง ๆ ขณะที่ `getCurrentUser()` (`lib/auth.ts` ~715–740) คำนวณ `managedAssetFacilityIds` จาก 2 ช่องนี้ (หน่วยงานประเภท "สสอ" ดูแล รพ.สต./ศสช./สอน. ทั้งอำเภอ)
- **สถานการณ์โจมตี:** เจ้าหน้าที่ รพ.สต. ส่ง `typecode=สสอ.` และ `districtName=<อำเภออื่น>` → ครั้งถัดไปได้สิทธิ์ดู/แก้/ลบ/นำเข้าครุภัณฑ์ (รวมข้อมูลเครือข่าย/IP) ยืม ซ่อม ของทุก รพ.สต. ในอำเภอนั้น
- **แนวทางแก้:** ให้เฉพาะแอดมินแก้ `typecode` และ `district_name` (ฟอร์มของเจ้าหน้าที่แก้ได้แค่ชื่อที่แสดง/พิกัด หรือไม่ให้แก้เลย) และตรวจ `facilities.manage` ทุก action; ใช้หลักเดียวกันกับ `app/(main)/admin/settings/facilities/actions.ts` (`updateFacilityAction`) ในกรณีที่ให้สิทธิ์ `facilities.manage` กับบทบาทที่ไม่ใช่แอดมิน
- **ทดสอบหลังแก้:** เจ้าหน้าที่ส่ง typecode/district ใหม่ต้องถูกปฏิเสธ และ `managedAssetFacilityIds` ไม่เปลี่ยน

### SEC-02 ☑ Stored XSS ในหน้าแผนที่
- **แก้แล้ว:** 23 กันยายน 2569 — สร้าง popup ของแผนที่ด้วย DOM + textContent แทนการต่อสตริง HTML
- **ไฟล์:** `app/(main)/map/_components/map-client.tsx` ประมาณบรรทัด 74–80
- **ปัญหา:** นำ `f.name`, `f.district_name`, `f.typecode` ต่อเป็นสตริง HTML แล้วส่งให้ Leaflet `bindPopup` ซึ่งแสดงเป็น HTML โดยไม่ escape
- **สถานการณ์โจมตี:** (ต่อจาก SEC-01) เจ้าหน้าที่ตั้งชื่อหน่วยงานเป็น `<img src=x onerror=...>` → เมื่อแอดมินเปิด `/map` สคริปต์ทำงานด้วยเซสชันแอดมิน (เรียก server action ในนามแอดมินได้ เช่น เปลี่ยนบทบาทผู้ใช้)
- **แนวทางแก้:** escape ค่าก่อนใส่ HTML หรือสร้าง popup ด้วย DOM (`document.createElement` + `textContent`); ตรวจจุดอื่นที่ใช้ `bindPopup`/`innerHTML` ด้วย; เสริมด้วย CSP (SEC-22)

### SEC-03 ☑ Install Key กลางของ Agent เปิดให้ทุกคนที่ล็อกอิน และ enroll เลือกหน่วยงานได้เอง
- **แก้แล้ว:** 23 กันยายน 2569 — หน้า/แอ็กชัน agent-download ตรวจ agent.manage และไม่ส่งคีย์ไปเบราว์เซอร์; คีย์ผูกหน่วยงานได้ด้วยรูปแบบ <facilityId>:<key>; ผู้ดูแลระดับหน่วยงานเห็นเฉพาะคีย์ของตน; จำกัด enroll 10 ครั้ง/10 นาที/IP
- **ไฟล์:**
  - `app/(main)/agent-download/page.tsx` บรรทัด ~9–11, 51 — ตรวจแค่ล็อกอิน แล้วส่ง `getPrimaryAgentInstallKey()` ไปยัง client component (เมนูถูกซ่อนด้วย `agent.manage` แต่หน้าไม่ได้ตรวจ)
  - `app/api/agent/enroll/route.ts` ~29, 42 — รับ `facilityId` จาก body
  - `app/(main)/agent-download/actions.ts` ~10–17 — สร้าง enrollment token 7 วันได้โดยไม่ตรวจ `canMutateAssets` / `agent.manage`
  - `app/(main)/admin/settings/agent/page.tsx` ~43 — แอดมินระดับหน่วยงานก็ได้ key กลางเดียวกัน
- **สถานการณ์โจมตี:** viewer/เจ้าหน้าที่หน่วยงาน A คัดลอก key แล้วเรียก `POST /api/agent/enroll` ด้วย `facilityId=B` และ fingerprint สุ่ม → สร้างเครื่องและครุภัณฑ์ปลอม (`AGT-…`) ในหน่วยงานใดก็ได้ ไม่จำกัดจำนวน
- **แนวทางแก้:** ตรวจ `agent.manage` และไม่ใช่ viewer ทั้งหน้าและ action; ไม่ส่ง key ดิบไปเบราว์เซอร์ (ใช้ enrollment token ต่อหน่วยงานแทน หรือผูก key กับหน่วยงานฝั่งเซิร์ฟเวอร์); จำกัดอัตราการ enroll

### SEC-04 ☑ ผูกบัญชี ThaiD กับบัญชีเดิมด้วยชื่อ-นามสกุลอย่างเดียว
- **แก้แล้ว:** 23 กันยายน 2569 — ผูก ThaiD อัตโนมัติได้เฉพาะบัญชีที่แอดมินเปิดสิทธิ์ (thaid_link_enabled) หรือบันทึก hash เลขบัตรไว้ล่วงหน้า และบัญชี admin ห้ามผูกอัตโนมัติเสมอ — ต้องรัน database/add_thaid_link_approval.sql
- **ไฟล์:** `lib/auth.ts` — `findOrLinkUserByVerifiedThaiD` (~381–422)
- **ปัญหา:** ถ้าบัญชีที่ใช้งานอยู่และยังไม่ผูก ThaiD มีชื่อ-นามสกุลตรงกันเพียงบัญชีเดียว ระบบผูกให้ทันที
- **สถานการณ์โจมตี:** บุคคลที่ชื่อ-นามสกุลเหมือนแอดมิน (ซึ่งยังใช้รหัสผ่านอย่างเดียว) ล็อกอิน ThaiD → ได้บัญชีแอดมินถาวร ชื่อซ้ำพบได้บ่อยและรายชื่อบุคลากรมักเปิดเผย
- **แนวทางแก้:** ผูกเฉพาะเมื่อแอดมินบันทึกเลขบัตรของบัญชีนั้นไว้ก่อน หรือให้ผู้ใช้ยืนยันด้วยรหัสผ่านเดิม/ให้แอดมินอนุมัติการผูก; บัญชีบทบาทแอดมินห้ามผูกอัตโนมัติ

### SEC-05 ☑ รหัสผ่านตั้งต้นและข้อมูลโครงสร้างภายในอยู่ในโฟลเดอร์โปรเจกต์
- **แก้แล้ว:** 23 กันยายน 2569 — seed/ดัมป์และ .vscode ถูกเอาออกจาก git index, .gitignore และ .dockerignore แล้ว; เพิ่ม database/check_seed_accounts.sql ให้ตรวจบัญชี seed ในฐานข้อมูลจริง — **ยังต้องลบออกจาก git history และเปลี่ยนรหัสผ่านที่รั่วด้วยตนเอง**
- **ไฟล์:**
  - `database/seed_users.sql` — มีบัญชี `atacs_admin` และบัญชีตัวอย่างพร้อมรหัสผ่านตั้งต้นที่อ่านได้ (ไม่ระบุค่าในเอกสารนี้)
  - `.vscode/ssh-lite-audit.json` — มี IP/พอร์ต SSH ภายในและข้อมูลเครื่องเซิร์ฟเวอร์ข้างเคียง
  - `database/stn_atacs.sql` (~140KB) และ `database/seed_assets.sql` — ต้องตรวจว่าเป็นข้อมูลจริงหรือไม่
  - `Dockerfile` คัดลอกทั้งโฟลเดอร์ `database` เข้า image
- **ความเสี่ยง:** ถ้าบัญชีจาก seed ยังอยู่ในฐานข้อมูลจริง ผู้ที่เห็นไฟล์เข้าแอดมินได้; ถ้าไฟล์เหล่านี้อยู่ใน git history จะรั่วไปกับทุกสำเนาของ repo
- **แนวทางแก้:**
  1. ตรวจในฐานข้อมูลจริงทันที: มีบัญชีจาก seed หรือไม่ → เปลี่ยนรหัส/ปิดบัญชี
  2. ลบหรือย้าย `seed_users.sql`, `.vscode/ssh-lite-audit.json` ออกจาก repo, ใส่ `.gitignore`, ถ้าเคย commit ให้ลบออกจาก history (`git filter-repo`) และเปลี่ยนรหัส/ข้อมูลที่รั่ว
  3. Dockerfile คัดลอกเฉพาะไฟล์ migration ที่จำเป็น (`database/add_*.sql`, `database/*schema*`) ไม่รวม seed/dump; เพิ่ม `database/seed_*.sql`, `database/stn_atacs.sql` ใน `.dockerignore`

### SEC-06 ☑ ฟีเจอร์ย้ายที่อยู่ Agent (`apiBaseUrl`) ไม่มีการตรวจสอบ
- **แก้แล้ว:** 23 กันยายน 2569 — agent ยอมย้ายปลายทางเฉพาะ https และโฮสต์ใน allowlist (ฝังในสคริปต์ .py/.ps1) ฝั่งเซิร์ฟเวอร์ประกาศได้เฉพาะ https และโฮสต์ใน AGENT_API_BASE_ALLOWED_HOSTS
- **ไฟล์:** `app/api/agent/report/route.ts` ~9–12, 58; `public/agent/linux/atacs-agent.py` ~367–371; `public/agent/windows/atacs-agent.ps1` ~265–277 (และสำเนาใน `scripts/agent/`)
- **ปัญหา:** Agent ยอมรับ `http://` หรือ `https://` ใด ๆ (รวมการลดจาก https เป็น http) และบันทึกถาวร ไม่มี allowlist หรือลายเซ็น
- **สถานการณ์โจมตี:** ผู้ที่ยึดโปรเจกต์ Vercel เดิมได้ (บัญชีหลุด/ชื่อ `*.vercel.app` ถูกนำไปใช้ใหม่) หรือดักเครือข่ายเมื่อใช้ http → สั่ง Agent v1.1 ทุกเครื่องไปรายงานที่เซิร์ฟเวอร์ตนเอง ได้ agent key และข้อมูลเครื่องทั้งหมด
- **แนวทางแก้:** รับเฉพาะ `https://`; ตรวจโดเมนปลายทางกับ allowlist ที่ฝังในสคริปต์ (เช่น โดเมนของ สสจ.) หรือใช้ประกาศที่ลงลายเซ็น; บันทึก log/แจ้งเตือนเมื่อ Agent ย้าย; เมื่อย้ายระบบเสร็จแล้วพิจารณาปิดฟีเจอร์นี้

### SEC-07 ☑ ฟังก์ชันเข้าสู่ระบบด้วยเลขบัตรโดยไม่ยืนยันตัวตนค้างอยู่
- **แก้แล้ว:** 23 กันยายน 2569 — ลบ loginWithThaiDAction ออกจาก app/auth/actions.ts
- **ไฟล์:** `app/auth/actions.ts` — `loginWithThaiDAction` (~71–105)
- **ปัญหา:** รับ `thaidCid` จากฟอร์มแล้วสร้างเซสชันทันที ไม่ผูกกับการยืนยัน ThaiD จริง (ต้องการแค่เลข 13 หลักและชื่อไม่ว่าง)
- **สถานะปัจจุบัน:** ไม่พบว่าหน้าใดเรียกใช้ — น่าจะเรียกไม่ได้ (ยังไม่ได้ยืนยันขณะรันจริง) แต่หากถูกนำไปผูกกับฟอร์มเมื่อใด จะเข้าบัญชีใครก็ได้ด้วยเลขบัตร (ไม่ใช่ความลับ) — ระดับ Critical แฝง
- **แนวทางแก้:** ลบฟังก์ชันนี้ ให้การสร้างเซสชัน ThaiD เกิดที่ OAuth callback เท่านั้น

---

## ระดับกลาง

### SEC-08 ☐ ไม่จำกัดการใส่รหัสผ่านผิด และ IP ปลอมได้
- **ไฟล์:** `app/auth/actions.ts` ~271–303; `lib/security.ts` ~25, 28–81
- **ปัญหา:** ล็อกอินผิดเพียงบันทึก event และแจ้ง Telegram เมื่อผิด 5 ครั้ง/10 นาที/IP แต่ไม่บล็อก; IP อ่านจาก `x-forwarded-for` ที่ไคลเอนต์ปลอมได้ถ้า proxy ไม่เขียนทับ
- **แนวทางแก้:** จำกัดครั้งต่อ username และต่อ IP (หน่วงเวลาเพิ่มขึ้น/ล็อกชั่วคราว); อ่าน IP จาก proxy ที่เชื่อถือได้เท่านั้น (Caddy ตั้ง `X-Forwarded-For` เอง)

### SEC-09 ☐ เปลี่ยน/รีเซ็ตรหัสผ่านแล้วเซสชันเดิมยังใช้ได้
- **ไฟล์:** `app/(main)/profile/actions.ts` ~74–75; `app/(main)/admin/users/actions.ts` ~405
- **แนวทางแก้:** ลบแถว `auth_sessions` อื่นของผู้ใช้เมื่อเปลี่ยนรหัส (ลบทั้งหมดเมื่อแอดมินรีเซ็ต) และออก token ใหม่ให้เซสชันปัจจุบัน

### SEC-10 ☐ Google ผูกบัญชีด้วยอีเมลที่ยังไม่ยืนยัน
- **ไฟล์:** `app/api/auth/google/callback/route.ts` ~139–145; อีเมลแก้ได้ที่ `app/(main)/profile/actions.ts` ~27
- **ปัญหา:** ค้น `LOWER(email) … LIMIT 1` แล้วผูก Google ให้ อีเมลในระบบกรอกเองและไม่ unique
- **แนวทางแก้:** ไม่ผูกด้วยอีเมลอัตโนมัติ ให้ผู้ใช้ล็อกอินวิธีเดิมก่อนแล้วกดผูก Google จากหน้าโปรไฟล์ หรือยืนยันอีเมลก่อน

### SEC-11 ☐ ไลบรารี `xlsx` 0.18.5 มีช่องโหว่ และหน้านำเข้าไม่จำกัดขนาด
- **ไฟล์:** `package.json`; `app/api/import/assets/route.ts` ~186
- **ปัญหา:** CVE-2023-30533 (prototype pollution, แก้ใน 0.19.3), CVE-2024-22363 (ReDoS, แก้ใน 0.20.2); SheetJS ไม่ออกเวอร์ชันใหม่บน npm แล้ว (`npm audit` จะไม่เตือน); ไม่จำกัดขนาดไฟล์/จำนวนแถว (มีแค่ 20MB ของ Caddy) — ไฟล์ zip bomb หรือ CSV หลายล้านแถวทำให้หน่วยความจำหมด; นามสกุลไฟล์ไม่มีผลจริงเพราะ `XLSX.read` ดูจากเนื้อหา
- **แนวทางแก้:** ติดตั้ง SheetJS ≥ 0.20.3 จาก `https://cdn.sheetjs.com/` หรือเปลี่ยนเป็น `exceljs`; ตรวจ `file.size` (≤ 5MB); `XLSX.read(..., { sheetRows: 5001 })` และปฏิเสธถ้าเกิน; รับเฉพาะ CSV (parser CSV) กับ XLSX (ตรวจ magic bytes `PK`)
- **หมายเหตุ:** โค้ดฝั่งเขียน Excel ใช้ `lib/xlsx-writer.ts` ของโปรเจกต์เอง ไม่ได้พึ่ง `xlsx`

### SEC-12 ☐ CSV/Excel formula injection ในไฟล์ส่งออก CSV
- **ไฟล์:** `escapeCsv` ใน `app/api/export/assets/route.ts` ~96, `app/api/export/audit/route.ts` ~18, `app/api/export/valuation/route.ts` ~11
- **ปัญหา:** ค่าที่ขึ้นต้นด้วย `=`, `+`, `-`, `@`, Tab, CR ถูกส่งออกตรง ๆ — ชื่อครุภัณฑ์ (หรือ hostname จาก Agent ผ่าน `lib/agent.ts` ~222) เช่น `=HYPERLINK(...)` จะทำงานเมื่อแอดมินเปิดใน Excel
- **แนวทางแก้:** ถ้าค่า (หลัง trim ซ้าย) ขึ้นต้นด้วยอักขระดังกล่าว ให้เติม `'` นำหน้าแล้วใส่เครื่องหมายคำพูด; ทำเป็นฟังก์ชันกลางใช้ทุก export
- **ไม่ได้รับผลกระทบ:** รายงาน Excel จาก `lib/xlsx-writer.ts` (เขียนเป็น inlineStr และสูตรมีแค่ SUM ที่กำหนดเอง)

### SEC-13 ☐ งานซ่อม/ยืม/ผลตรวจนับยึดหน่วยงานเดิมหลังโอนย้าย
- **ไฟล์:** `app/(main)/repairs/actions.ts` ~176; `app/(main)/loans/actions.ts` ~66, 85; `lib/inspection-results.ts` ~68 (ผ่าน `getInspectionItemContext` ใน `lib/inspection.ts` ~445)
- **ปัญหา:** ตรวจสิทธิ์จาก `facility_id` ที่บันทึกตอนสร้างรายการ และ `transferAsset` (`lib/asset-transfers.ts`) ไม่บล็อกการโอนเมื่อมีงานซ่อมค้าง/ยืมอยู่/คำขอจำหน่ายรอ/รอบตรวจนับเปิด
- **สถานการณ์:** ครุภัณฑ์โอนจาก A ไป B แล้ว เจ้าหน้าที่ A ยังปิดงานซ่อม (เปลี่ยนสถานะ), รับคืนแบบชำรุด หรือบันทึกผลตรวจ (รวมตั้งกลุ่มงานของ A) บนครุภัณฑ์ที่เป็นของ B ได้
- **แนวทางแก้:** ตรวจหน่วยงานปัจจุบันของครุภัณฑ์เพิ่ม หรือห้ามโอนขณะมีรายการค้างเหล่านี้ (แนะนำทั้งสองอย่าง)

### SEC-14 ☐ Agent: ลงทะเบียนซ้ำแย่ง key เครื่องเดิม และเพิกถอนเครื่องไม่ได้
- **ไฟล์:** `lib/agent.ts` ~461–482
- **ปัญหา:** enroll ซ้ำด้วย (หน่วยงาน, fingerprint) เดิมจะแทนที่ `agent_key_hash` ทำให้เครื่องจริงถูกตัดออกและผู้โจมตีส่งข้อมูลทับ; fingerprint คำนวณได้บนเครื่องและปรากฏในข้อความ Telegram เมื่อ enroll ล้มเหลว (`enroll/route.ts` ~59); ไม่มีโค้ดใดตั้ง `agent_devices.is_active=0` จึงเพิกถอน key ที่หลุดไม่ได้
- **แนวทางแก้:** ไม่หมุน key เมื่อ enroll ซ้ำโดยไม่ได้รับอนุมัติจากแอดมิน; เพิ่มปุ่มปิด/เพิกถอนเครื่องในหน้าตั้งค่า Agent; ไม่ส่ง fingerprint เต็มใน Telegram

### SEC-15 ☐ Agent: ข้อมูลรายงานไม่ตรวจชนิด/ขนาด และ key ที่หลุดยึดครุภัณฑ์อื่นได้
- **ไฟล์:** `lib/agent.ts` ~655–658 (`ramMb`, `disk*` ไม่แปลงเป็นตัวเลข), ~670 `findAssetCandidate`
- **ปัญหา:** รายงานที่ serial/hostname ตรงกับครุภัณฑ์ IT ที่ยังไม่ผูก จะผูกและเขียนทับชื่อ ผู้ใช้ IP serial สถานะ; ฟิลด์ `raw` เก็บ longtext ได้ถึง ~20MB ต่อครั้ง; `status`, `collectedAt` ไม่ตรวจ
- **แนวทางแก้:** ตรวจ schema ของ payload (ชนิด, ความยาว, ช่วงค่า, ขนาด `raw` ≤ ~256KB); ผูกครุภัณฑ์อัตโนมัติเฉพาะเมื่อแอดมินยืนยัน

### SEC-16 ☐ คำขอ Agent ที่ key ผิดทำให้ Telegram ท่วมได้
- **ไฟล์:** `app/api/agent/enroll/route.ts` ~56, 114; `heartbeat/route.ts` ~58; `report/route.ts` ~69
- **ปัญหา:** ทุกคำขอที่ล้มเหลวส่ง Telegram (ไม่มี `eventKey`) และ insert ฐานข้อมูล — วนยิงได้โดยไม่ต้องล็อกอิน กลบการแจ้งเตือนจริง
- **แนวทางแก้:** ใช้ `eventKey` ต่อ IP ต่อช่วงเวลา (เช่น `agent-auth-fail:<ip>:<ชั่วโมง>`) หรือแจ้งผ่านกลไกสรุป burst ใน `recordSecurityEvent` อย่างเดียว; จำกัดอัตราต่อ IP

### SEC-17 ☐ ไฟล์สำรองข้อมูลผู้อื่นในเครื่องอ่านได้และไม่เข้ารหัส
- **ไฟล์:** `docker/backup.sh`
- **ปัญหา:** ไฟล์สร้างด้วย umask ปกติ (0644) ใน `./backups` ภายในมี hash รหัสผ่าน, hash เซสชัน, CID ที่เข้ารหัส, hash ของ agent key
- **แนวทางแก้:** `umask 077` ต้นสคริปต์ และ `chmod 700` โฟลเดอร์; พิจารณาเข้ารหัสด้วย `age`/`gpg` ก่อนคัดลอกออกนอกเครื่อง

### SEC-18 ☐ Windows Agent: `agent-config.json` น่าจะอ่านได้โดยผู้ใช้ทั่วไป
- **ไฟล์:** `public/agent/windows/install-atacs-agent.ps1` ~47–48
- **ปัญหา:** `C:\ProgramData\ATACSAgent` สืบทอดสิทธิ์ `BUILTIN\Users: Read` (ยังไม่ได้ทดสอบบนเครื่องจริง) ไฟล์มี agent key; ฝั่ง Linux ตั้ง `chmod 700` แล้ว
- **แนวทางแก้:** `icacls "$dir" /inheritance:r /grant:r "SYSTEM:(OI)(CI)F" "Administrators:(OI)(CI)F"`

### SEC-19 ☐ สคริปต์ติดตั้ง/ย้าย Agent ดาวน์โหลดโค้ดมารันด้วยสิทธิ์ SYSTEM/root โดยไม่ตรวจความถูกต้อง
- **ไฟล์:** `lib/agent-install.ts`; `public/agent/*/repoint-atacs-agent.*`; `public/agent/*/install-atacs-agent.*`
- **ปัญหา:** พึ่ง TLS อย่างเดียว แต่ระบบรองรับ http (`SITE_ADDRESS=:80`) — ในเครือข่ายภายใน ผู้ดักข้อมูลรันโค้ดบนเครื่องได้; ถ้าไม่ได้ตั้ง `APP_URL` คำสั่งจะชี้ `https://stns-atacs.vercel.app`
- **แนวทางแก้:** บังคับ https สำหรับการติดตั้ง Agent; เผยแพร่ SHA-256 ของสคริปต์และให้ตัวติดตั้งตรวจก่อนรัน (หรือลงลายเซ็น Authenticode สำหรับ .ps1); ตั้ง `APP_URL` ให้ถูกทุกครั้งที่ build

### SEC-20 ☐ ไม่มี PKCE/nonce ใน OAuth (ThaiD, Google)
- **ไฟล์:** `app/api/auth/google/authorize/route.ts` ~27–32; `app/api/auth/thaiid/authorize/route.ts` ~33–37
- **หมายเหตุ:** `state` สุ่มและตรวจถูกต้องแล้ว
- **แนวทางแก้:** เพิ่ม PKCE (S256) ทั้งสองผู้ให้บริการ (ตรวจว่า ThaiD รองรับ); ใช้ nonce ถ้าตรวจ ID token

### SEC-21 ☐ เจ้าหน้าที่ที่ยังไม่มีหน่วยงานเลือกหน่วยงานเองได้ และการเปลี่ยนบทบาทไม่ตรวจหน่วยงาน
- **ไฟล์:** `app/(main)/profile/actions.ts` ~39; `app/(main)/admin/users/actions.ts` ~343 (`updateUserRoleAction`), `updateUserFacilityAction`
- **ปัญหา:** เงื่อนไข `if (user.facilityId && …)` ทำให้ officer ที่ `facility_id` เป็น NULL (เช่น แอดมินเปลี่ยน viewer → officer) เลือกหน่วยงานใดก็ได้ รวม สสอ. (ได้สิทธิ์ทั้งอำเภอ); `updateUserFacilityAction` เชื่อค่า `role` จากฟอร์ม; `newRole` ไม่ตรวจค่าขณะรัน
- **แนวทางแก้:** ให้แอดมินกำหนดหน่วยงานเท่านั้น; บังคับเลือกหน่วยงานเมื่อเปลี่ยนเป็น officer; ตรวจ `newRole ∈ {admin, officer, viewer}`; ลดเป็น viewer แล้วล้างหน่วยงานหรือจำกัดสิทธิ์ตามนั้น

### SEC-22 ☐ ไม่มี security headers (CSP, HSTS, กัน clickjacking)
- **ไฟล์:** `next.config.ts` (ไม่มี `headers()`), `docker/Caddyfile` (มีแค่ `nosniff`, `Referrer-Policy`)
- **แนวทางแก้:** ใน Caddy เพิ่ม `Strict-Transport-Security` (เฉพาะโหมด HTTPS), `X-Frame-Options DENY` / `frame-ancestors 'none'`, `Permissions-Policy`; ต่อด้วย CSP แบบ nonce ผ่าน `proxy.ts` (ต้องรองรับ inline script ของ splash screen และ tile ของ OpenStreetMap/Leaflet)

### SEC-23 ☐ หน้าดาวน์โหลด Agent และ API บางตัวไม่ตรวจสิทธิ์ตาม Permission Matrix
- **ไฟล์:** `app/api/assets/route.ts` ~10–36; `app/api/qr/asset/[id]/route.ts`; `app/api/qr/assets/route.ts`; `app/(main)/assets/[id]/page.tsx` ~155–170 (ไม่ตรวจ `assets.view`)
- **ปัญหา:** ขอบเขตหน่วยงานถูกต้อง แต่ถ้าแอดมินปิด `assets.view` ของบทบาทใด endpoint เหล่านี้ยังคืนข้อมูล
- **แนวทางแก้:** เพิ่ม `hasPermission(user.role, "assets.view")`

---

## ระดับต่ำ (เสริมความแข็งแรง)

| รหัส | สถานะ | เรื่อง | ไฟล์ | แนวทางแก้ |
|---|---|---|---|---|
| SEC-24 | ☐ | เทียบลายเซ็นตอนลงทะเบียนด้วย `!==` | `lib/auth.ts` ~181 | ใช้ `crypto.timingSafeEqual` |
| SEC-25 | ☐ | เทียบ `CRON_SECRET` ด้วย `===` | `app/api/cron/*/route.ts` ~10 | hash แล้ว `timingSafeEqual` |
| SEC-26 | ☐ | ถ้าไม่ตั้ง `THAID_CID_HASH_KEY` ใช้ key เดียวกับการเข้ารหัส CID | `lib/auth.ts` ~116–120 | บังคับให้ตั้ง key แยก |
| SEC-27 | ☐ | บอกได้ว่า username มีอยู่ (ข้อความสมัคร และล็อกอินที่ตอบเร็วกว่าเมื่อไม่มีผู้ใช้) | `app/auth/actions.ts` ~227–228, ~295 | ข้อความกลาง ๆ และรัน hash หลอกเมื่อไม่พบผู้ใช้ |
| SEC-28 | ☐ | เกณฑ์รหัสผ่านตอนเปลี่ยน/รีเซ็ต (8 ตัว) อ่อนกว่าตอนสมัคร (10 ตัว + ตัวอักษรและตัวเลข) และมีการ trim | `app/(main)/profile/actions.ts` ~58–62 | ใช้ฟังก์ชันตรวจรหัสผ่านเดียวกันทุกจุด |
| SEC-29 | ☐ | เซสชันต่ออายุไปเรื่อย ๆ ไม่มีอายุสูงสุด | `lib/auth.ts` ~748–755 | จำกัดจาก `created_at` (เช่น 7 วันตาม `AUTH_SESSION_DAYS`) |
| SEC-30 | ☐ | `/login?error=` แสดงข้อความใดก็ได้ (ใช้หลอก phishing ได้; ไม่ใช่ XSS) | `app/login/page.tsx` | รับเป็นรหัสข้อผิดพลาดแล้วแปลเป็นข้อความที่กำหนด |
| SEC-31 | ☐ | ตรวจรูปที่อัปโหลดจาก MIME ที่ไคลเอนต์ส่ง | `app/(main)/assets/actions.ts` ~58–75 | ตรวจ magic bytes หรือแปลงรูปใหม่ด้วย `sharp` (ลบ EXIF/GPS ด้วย) |
| SEC-32 | ☐ | ฟิลด์ตัวเลขใน payload Agent ไม่แปลงชนิดก่อน query | `lib/agent.ts` ~655–658 | `Number()` + ตรวจช่วง (รวมใน SEC-15) |
| SEC-33 | ☐ | การสร้าง/เพิกถอน/ผูก enrollment ของ Agent ไม่บันทึก audit log | `app/(main)/admin/settings/agent/actions.ts`, `app/(main)/agent-download/actions.ts` | เรียก `writeAuditLog` |
| SEC-34 | ☐ | ใน container ผู้ใช้ `nextjs` เป็นเจ้าของโค้ดแอป (ถูกเจาะแล้วแก้โค้ดค้างไว้ได้) | `Dockerfile` | ให้ root เป็นเจ้าของโค้ด เขียนได้เฉพาะ `/app/storage` |
| SEC-35 | ☐ | Caddy ค่าเริ่มต้น `SITE_ADDRESS=:80` (HTTP) | `docker-compose.yml`, `docker/env.example` | ใช้โดเมน + HTTPS เป็นค่าหลัก ระบุชัดว่า `:80` สำหรับทดสอบภายในเท่านั้น |
| SEC-36 | ☐ | หน้าสาธารณะ `/public` ส่งสรุปรายหน่วยงาน (จำนวน สถานะ มูลค่ารวม) ไปเบราว์เซอร์โดยไม่ต้องล็อกอิน | `app/public/page.tsx`, `app/_components/district-comparison.tsx` | ยืนยันว่าตั้งใจเปิดเผยมูลค่ารายหน่วยงาน ถ้าไม่ ให้ตัดออก |
| SEC-37 | ☐ | `lib/public-dashboard.ts` ไม่มีที่ใช้ แต่ถ้าถูกใช้จะแสดงชื่อฐานข้อมูลและข้อความ error ดิบ | `lib/public-dashboard.ts` ~180, 188 | ลบไฟล์ หรือกรองข้อความก่อนแสดง |
| SEC-38 | ☐ | ไฟล์ที่ไม่ควรอยู่ในโปรเจกต์ | `prompt`, `lint-results.json`, `scripts/tmp-agent-*.js`, `backup-before-lifecycle.sql` (0 ไบต์), `.preview-*.html` | ลบหรือย้ายออก และใส่ `.gitignore` |

---

## สิ่งที่ทำไว้ดีแล้ว (ไม่ต้องแก้)

- **รหัสผ่าน:** scrypt + salt สุ่ม 16 ไบต์ + ตรวจแบบ `timingSafeEqual` (อาจเพิ่มค่า N ของ scrypt ภายหลัง)
- **เซสชัน:** token สุ่ม เก็บเฉพาะ SHA-256 ตรวจกับฐานข้อมูลทุกคำขอ (เปลี่ยนบทบาท/ปิดบัญชีมีผลทันที) ออกจากระบบลบเซสชันจริง; cookie `httpOnly`, `SameSite=Lax`, `Secure` ใน production
- **Secret:** ไม่มีค่าสำรอง ถ้าไม่ตั้ง `AUTH_SECRET` หรือ key เข้ารหัส CID ระบบไม่ยอมทำงาน
- **เลขบัตรประชาชน:** AES-256-GCM (nonce สุ่มทุกครั้ง) + HMAC สำหรับค้นหา
- **Redirect:** `?next=` จำกัดเฉพาะ path ภายใน; Google เก็บ `next` ใน cookie httpOnly; `state` ของ OAuth ตรวจถูกต้อง; Google ต้อง `email_verified`
- **การสมัคร:** บังคับเป็น officer ที่ยังไม่เปิดใช้จนแอดมินอนุมัติ; แอดมินเปลี่ยนบทบาท/ปิดบัญชีตัวเองไม่ได้
- **SQL:** ไม่พบ SQL injection — ใช้ parameter ทุกจุด คอลัมน์เรียงลำดับมี whitelist, LIMIT ถูก clamp, `multipleStatements` ปิด (เปิดเฉพาะสคริปต์ migration)
- **สิทธิ์ตามหน่วยงาน:** ครุภัณฑ์ (สร้าง/แก้/ลบ/นำเข้า), จำหน่าย (ห้ามอนุมัติคำขอตนเอง), โอนย้าย (ตรวจต้นทาง-ปลายทาง), ตรวจนับ (รวม API ออฟไลน์ที่ตรวจ same-origin + JSON), หน้าที่โหลดตาม id, export, รูปภาพ, หน้าพิมพ์ — ตรวจจากหน่วยงานจริงของข้อมูล; งานแอดมินจำกัดแอดมิน
- **SVG/QR และ Telegram:** escape ครบ
- **อัปโหลดรูป:** เก็บนอก `public/`, ชื่อไฟล์สุ่มฝั่งเซิร์ฟเวอร์, จำกัด 5MB, route ส่งรูปตรวจชื่อไฟล์ ล็อกอิน สิทธิ์หน่วยงาน และส่ง `nosniff`
- **Agent key / enrollment token:** สุ่ม 192 บิต เก็บเป็น SHA-256, token มีวันหมดอายุและเพิกถอนได้, install key เทียบแบบ timing-safe; สคริปต์ Linux ไม่ปิดการตรวจ TLS และตั้งสิทธิ์โฟลเดอร์ config ถูกต้อง
- **Docker:** พอร์ตฐานข้อมูลผูก 127.0.0.1, root password ไม่อยู่ใน container แอป, แอปรันด้วยผู้ใช้ non-root; `.env*` และ `backups` ถูกยกเว้นทั้ง git และ Docker
- **Dependencies:** `next` 16.2.6, `mysql2`, `qrcode` ไม่พบช่องโหว่ที่ทราบ (ควรรัน `npm audit` ยืนยัน) — ยกเว้น `xlsx` (SEC-11)

---

## การตรวจซ้ำหลังแก้

- เพิ่ม unit/integration test สำหรับข้อที่แก้ (เช่น SEC-01 เจ้าหน้าที่แก้ typecode ไม่ได้, SEC-12 CSV ที่ขึ้นต้นด้วย `=` ถูก neutralize, SEC-13 หน่วยงานเดิมแก้งานซ่อมหลังโอนไม่ได้, SEC-09 เซสชันถูกลบหลังเปลี่ยนรหัส)
- รัน `npm audit` และตรวจเวอร์ชัน SheetJS หลังเปลี่ยน
- ทดสอบบนเครื่องจริง: header ด้วย `curl -I`, สิทธิ์ไฟล์ `agent-config.json` บน Windows (`icacls`), สิทธิ์ไฟล์ใน `./backups`
- อัปเดตสถานะ ☐/☑ ในเอกสารนี้พร้อมวันที่และ commit ที่แก้
