-- (ไม่บังคับ) จัดประเภทเหตุการณ์เก่าใหม่: Agent ที่ไม่มีในฐานข้อมูล ไม่ใช่การปลอมกุญแจ
-- ก่อน SEC8 ทุกครั้งที่ Agent ส่งกุญแจไม่ผ่านถูกบันทึกเป็น agent_invalid_credentials
-- ถ้า Agent ID นั้นไม่มีใน agent_devices เลย แปลว่าเป็นเครื่องที่ข้อมูลถูกลบ → agent_unknown_id
-- ไม่ลบข้อมูลใด ๆ แค่เปลี่ยนประเภท รันซ้ำได้

UPDATE security_events se
LEFT JOIN agent_devices ad ON ad.agent_uuid = se.identity_value
SET se.event_type = 'agent_unknown_id'
WHERE se.event_type = 'agent_invalid_credentials'
  AND se.identity_value IS NOT NULL
  AND ad.id IS NULL;

SELECT ROW_COUNT() AS reclassified;
