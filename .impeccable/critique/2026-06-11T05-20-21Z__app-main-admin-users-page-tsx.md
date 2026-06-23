---
target: app/(main)/admin/users/page.tsx
total_score: 20
p0_count: 0
p1_count: 2
timestamp: 2026-06-11T05-20-21Z
slug: app-main-admin-users-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2/4 | มี pending state แต่หลังดำเนินการไม่มีข้อความยืนยันที่ชัดเจน |
| 2 | Match System / Real World | 3/4 | ภาษาไทยตรงงาน แต่ยังผสม Role, Audit Log, Public Dashboard และ PW |
| 3 | User Control and Freedom | 2/4 | modal ยกเลิกได้ แต่ไม่มี undo และการเปลี่ยนสิทธิ์เกิดทันที |
| 4 | Consistency and Standards | 2/4 | ตารางและสถานะสม่ำเสมอ แต่ icon และภาษายังหลายรูปแบบ |
| 5 | Error Prevention | 1/4 | เปิด/ปิดบัญชีและวน Role แบบคลิกเดียว ไม่มีการยืนยัน |
| 6 | Recognition Rather Than Recall | 3/4 | label ชัดและ badge ช่วยเห็นงานค้าง |
| 7 | Flexibility and Efficiency | 1/4 | ไม่มีค้นหา กรอง bulk action หรือ keyboard accelerator |
| 8 | Aesthetic and Minimalist Design | 3/4 | แยกกลุ่มชัด แต่ action ต่อแถวแน่นและ glass effect มากเกินจำเป็น |
| 9 | Error Recovery | 2/4 | form error อ่านได้ แต่ไม่มี recovery สำหรับ action ที่คลิกผิด |
| 10 | Help and Documentation | 1/4 | มีคำอธิบายสั้น แต่ไม่มี contextual help สำหรับสิทธิ์และการอนุมัติ |
| **Total** | | **20/40** | **Acceptable - ต้องแก้ workflow เสี่ยงก่อนใช้งานจริง** |

## Anti-Patterns Verdict

**LLM assessment**: หน้านี้ไม่ดูเหมือน UI ที่สร้างแบบสุ่ม เพราะข้อมูลและสถานะสะท้อน workflow จริง แต่ยังมีลักษณะ product UI ที่ประกอบจาก utility classes มากกว่าระบบ component ที่ตั้งใจออกแบบ: ปุ่ม action สีต่างกันเรียงยาว, icon หลายสไตล์, glass panel ใช้เป็นค่าเริ่มต้น และภาษาไทย/อังกฤษปะปน

**Deterministic scan**: พบ 1 warning คือ `text-stone-600` บน `bg-emerald-100` ที่ `app/(main)/admin/users/page.tsx:103` ซึ่งทำให้สีข้อความไม่สัมพันธ์กับพื้นหลังสีเขียว

**Visual overlays**: ไม่มี overlay ที่เชื่อถือได้ เพราะ in-app browser ไม่พร้อมใช้งานในเซสชันนี้ ใช้ source review, detector และ dev-server compile log เป็น fallback

## Overall Impression

การแยกผู้ลงทะเบียนออกจากผู้ใช้งานเป็นการตัดสินใจที่ถูกต้องและ badge ใน sidebar ช่วยให้เห็นงานค้างทันที โอกาสใหญ่ที่สุดคือเปลี่ยนส่วน “จัดการ” จากชุดปุ่มอันตรายหลายปุ่ม ให้เป็น workflow ที่ชัด ป้องกันการคลิกผิด และเหมาะกับงานของเจ้าหน้าที่ IT

## What's Working

- แบ่ง “ผู้ลงทะเบียนรออนุมัติ” และ “ผู้ใช้งานระบบ” ชัดเจน ทำให้ลำดับงานตรงกับ mental model
- จำนวนรายการปรากฏทั้งหัวข้อและ sidebar ทำให้สถานะงานค้างมองเห็นได้ทันที
- ตารางใช้ semantic markup และแสดงชื่อ ตำแหน่ง หน่วยงาน และสถานะในบริบทเดียวกัน

## Priority Issues

### [P1] การเปลี่ยนสิทธิ์และเปิด/ปิดบัญชีแบบคลิกเดียว

**Why it matters**: ผู้ดูแลสามารถเปลี่ยน Role หรือปิดบัญชีผิดคนได้ทันที และปุ่มเปลี่ยน Role เป็นการวนค่าโดยไม่แสดงปลายทางทั้งหมดอย่างชัดเจน

**Fix**: ย้าย action เสี่ยงเข้าเมนู “จัดการ” หรือหน้าแก้ไข แสดงค่าปัจจุบันและค่าปลายทาง ใช้ confirmation สำหรับปิดบัญชี/เปลี่ยนสิทธิ์ และแสดง success feedback

**Suggested command**: `$impeccable harden`

### [P1] Action ต่อแถวแน่นและไม่เหมาะกับมือถือ/คีย์บอร์ด

**Why it matters**: แต่ละแถวมี 3-4 ปุ่มขนาดเล็ก ตาราง 8 คอลัมน์ต้องเลื่อนแนวนอน และ touch target ต่ำกว่าเกณฑ์ 44px

**Fix**: ให้ action หลักเพียงหนึ่งปุ่มต่อแถว ส่วน action รองอยู่ใน menu หรือ detail drawer เพิ่ม mobile row/card view และ focus-visible state

**Suggested command**: `$impeccable adapt`

### [P2] Sidebar ไม่มีการจัดกลุ่มเมนู

**Why it matters**: เมนูระดับเดียว 11 รายการเกินขีดจำกัด working memory และผสมงานทรัพย์สิน งาน Agent และงาน Admin ไว้ด้วยกัน

**Fix**: จัดกลุ่มเป็น “ภาพรวม”, “งานทรัพย์สิน”, “ระบบและความปลอดภัย” พร้อมหัวข้อที่ไม่เด่นเกินเนื้อหา

**Suggested command**: `$impeccable layout`

### [P2] Visual vocabulary ยังไม่สม่ำเสมอ

**Why it matters**: icon เป็นทั้งสัญลักษณ์ Unicode และ emoji, ภาษาไทย/อังกฤษผสม และสี indigo/violet ถูก remap เป็นเขียว ทำให้ความหมายของสีไม่ชัด

**Fix**: กำหนด icon set เดียว, แปล label ที่ผู้ใช้เห็น, สร้าง semantic tokens สำหรับ success/warning/danger/info และเลิก remap ชื่อสีเชิงความหมาย

**Suggested command**: `$impeccable document`

### [P2] Glass panel เป็น default และสร้าง visual noise

**Why it matters**: `.glass-panel` ใช้ blur พร้อม border และ shadow ขนาดใหญ่ ทำให้เครื่องมือปฏิบัติงานดูฟุ้งและลดความคมชัดของตาราง

**Fix**: ใช้พื้นทึบและเส้นแบ่งสำหรับตาราง ลด blur/shadow และเก็บ elevation ไว้เฉพาะ modal หรือ floating surface

**Suggested command**: `$impeccable quieter`

## Persona Red Flags

**Alex - เจ้าหน้าที่ IT ผู้ใช้ประจำ**: ไม่มีค้นหา กรอง หรือ bulk action; ต้องไล่ดูตารางและทำทีละคน; ปุ่มวน Role เร็วแต่เสี่ยงและคาดเดายาก

**Sam - ผู้ใช้คีย์บอร์ด/สายตาเลือนราง**: modal ไม่ใช้ dialog semantics, ไม่มี focus trap/การปิดด้วย Escape ที่ชัดเจน, ปุ่มเล็ก และ inactive navigation ใช้ `text-white/65` บนพื้นเขียวซึ่งควรตรวจ contrast

**Casey - ผู้ใช้มือถือที่ถูกรบกวนบ่อย**: ตาราง 8 คอลัมน์ต้องเลื่อนแนวนอน, action อยู่ปลายแถวและ touch target เล็ก, ไม่มี state persistence หรือ feedback ชัดหลัง action

## Minor Observations

- ปุ่มอนุมัติและ `เปิดใช้งาน` อาจปรากฏเป็นแนวคิดซ้ำกันในรายการรออนุมัติ
- empty state บอกเพียงว่าไม่มีรายการ แต่ยังไม่อธิบายว่า badge จะหายหรือควรทำอะไรต่อ
- `Admin · จัดการผู้ใช้งาน` เป็น eyebrow pattern ที่ไม่เพิ่มข้อมูลมากนัก
- ข้อความ error ฐานข้อมูลเปิดเผยชื่อ environment `MYSQL_*` ซึ่งเหมาะกับผู้ดูแลเทคนิค แต่ไม่ควรแสดงกับผู้มีสิทธิ์จัดการที่ไม่ใช่ system admin

## Questions to Consider

- งานที่ผู้ดูแลทำบ่อยที่สุดคืออนุมัติรายคน หรืออนุมัติหลายคนพร้อมกัน?
- การเปลี่ยน Role ควรเกิดในตารางจริงหรือควรอยู่ในหน้ารายละเอียดผู้ใช้?
- หน้าผู้ใช้ควรเน้น “งานที่ต้องทำวันนี้” มากกว่าการแสดงข้อมูลทุกคอลัมน์พร้อมกันหรือไม่?
