# ส่วนขยายทะเบียนครุภัณฑ์นอกกลุ่ม IT

รองรับ Office, Medical, Vehicle, Building, Utility และ Other ทั้งฟอร์มเพิ่ม/แก้ไข รายละเอียด การค้นหาทะเบียนกลาง/หน่วยงาน และ CSV/Excel import, CSV export ข้อมูล IT และ URL/ID เดิมคงเดิม

## ข้อมูลเฉพาะ

- Office: วัสดุและขนาด
- Medical: เลขทะเบียนเครื่องมือแพทย์ วันที่สอบเทียบและครบกำหนด
- Vehicle: ทะเบียน/จังหวัด เลขตัวถัง/เครื่อง เชื้อเพลิง ระยะทาง ประกันภัยและภาษี
- Building: เลขอาคาร เอกสารสิทธิ์ พื้นที่ จำนวนชั้น วันที่ก่อสร้างแล้วเสร็จ
- Utility: ระบบ กำลัง/ความจุ หมายเลขมิเตอร์ วันบำรุงรักษาถัดไป
- Other: รายละเอียดเฉพาะเพิ่มเติม

ค่าทั้งหมดเป็นทางเลือก เพื่อให้ทะเบียนเก่าใช้งานต่อได้ นิยามและ validation อยู่ใน lib/asset-details.ts วันที่ใช้ ค.ศ. YYYY-MM-DD, ตัวเลขไม่ติดลบ, จำนวนชั้นเป็นจำนวนเต็ม ช่องข้อความไม่เกิน 1,000 ตัวอักษร

## การจัดเก็บและสิทธิ์

asset_subtypes เป็น master ประเภทย่อยสัมพันธ์กับกลุ่ม ผู้มีสิทธิ์ device-types.manage จัดการผ่าน /assets/subtypes สามารถเพิ่ม เปลี่ยนชื่อ และปิดใช้งาน แต่ไม่เปลี่ยนกลุ่ม/ลบชนิดที่มีประวัติ รายการเก่ายังเก็บชนิดที่ปิดใช้งานได้ แต่รายการใหม่เลือกไม่ได้

asset_extensions เก็บ JSON ที่มี schema_version=1 และ FK ไปทะเบียนหลัก/ประเภทย่อย ใช้หนึ่งแถวต่อ (asset_id, asset_class) แทนหนึ่งแถวต่อ asset_id เพื่อเก็บประวัติรายละเอียดของทุกกลุ่มเมื่อเปลี่ยนกลุ่ม ฟอร์มกลับมาแสดงข้อมูลเดิมได้เมื่อเลือกกลุ่มเดิม การค้นหาและ export ใช้เฉพาะกลุ่มปัจจุบัน การลบทะเบียนลบส่วนขยายด้วย FK cascade

createAsset/updateAsset ใช้ transaction เดียวกับรายละเอียด ผ่าน AsyncLocalStorage ใน lib/mysql.ts การแก้ไขล็อกแถวทะเบียนและส่วนขยายก่อน merge; omitted หมายถึงคงเดิม, empty string หมายถึงล้างข้อมูล รายการที่ผูก Agent ยังห้ามเปลี่ยนเป็นกลุ่มที่ Agent ไม่รองรับ

## เปิดใช้กับฐานข้อมูลจริง

1. สำรองฐานข้อมูลและทดลองบน staging ก่อน โค้ดใหม่นี้ต้องมีตารางส่วนขยายก่อนเปิดใช้งาน
2. รัน `node scripts/check-asset-extension-schema.mjs --before` เพื่อตรวจ prerequisite แบบ read-only โดยใช้ MYSQL_* จาก environment หรือ .env
3. รัน database/add_asset_class.sql หากยังไม่มี asset_class แล้วรัน database/add_asset_extensions.sql ผ่านเครื่องมือฐานข้อมูลที่ใช้ประจำ Migration เป็นแบบ additive และรันซ้ำได้ ไม่เปิดใช้งานประเภทย่อยที่เคยถูกปิดกลับเอง
4. รัน `node scripts/check-asset-extension-schema.mjs` ตรวจตาราง/คอลัมน์/FK/version
5. deploy แอป ตรวจเพิ่ม/แก้ไข/ค้นหา/export/import และสิทธิ์ใน staging ก่อนระบบจริง

ถ้าย้อนแอป ให้คงตารางใหม่และข้อมูลไว้ ห้าม DROP เพื่อ rollback แอป การเพิ่มตารางเป็น MySQL DDL ซึ่งไม่ rollback เหมือน transaction ข้อมูล

การพัฒนานี้ไม่ได้รัน migration บนฐานข้อมูลใช้งานจริง ทดสอบบน MySQL 8.4 ใน Docker แยกเท่านั้น ชุด integration ใช้ฐานข้อมูลว่างชื่อ atacs_test บน localhost โดยตั้ง ATACS_TEST_MYSQL_PORT; ไม่โหลด .env และไม่เชื่อมฐานข้อมูลจริง

## CSV และการทดสอบ

ไฟล์ตัวอย่างจาก /api/export/assets?template=csv มีคอลัมน์ใหม่ครบ ใช้ subtype_id จากคู่มือ /assets/import-guide ช่องเฉพาะประเภทใช้ชื่อใน lib/asset-details.ts เมื่อแก้ไข CSV ช่องว่างรักษาค่าเดิม ใช้ __CLEAR__ เพื่อล้าง subtype_id หรือช่องรายละเอียดเฉพาะ ห้ามกรอกช่องของกลุ่มอื่น

- `node --test tests/*.test.mjs` (integration ข้ามหากไม่กำหนดพอร์ต)
- `ATACS_TEST_MYSQL_PORT=<พอร์ต MySQL ทดสอบที่แยกไว้> node --test tests/asset-extensions.integration.test.mjs`
- `npx tsc --noEmit` และ `npm run build`

การค้นหา JSON ใช้ LIKE ภายใน EXISTS และ index asset_id/asset_class เหมาะกับทะเบียนปัจจุบัน หากข้อมูลมากควรวัด query ก่อนเพิ่ม generated columns/index ให้ช่องที่ค้นหาบ่อย ยังไม่เพิ่มการแจ้งเตือนสอบเทียบ/ประกันภัยอัตโนมัติจากวันที่เหล่านี้
