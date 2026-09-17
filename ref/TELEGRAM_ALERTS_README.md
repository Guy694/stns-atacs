# Telegram Alerts

## Environment variables

```env
TELEGRAM_BOT_TOKEN=telegram-bot-token
TELEGRAM_CHAT_ID=telegram-chat-or-group-id
TELEGRAM_ALERTS_ENABLED=true

# เปิด/ปิดแยกประเภท
TELEGRAM_ALERT_SECURITY=true
TELEGRAM_ALERT_REGISTRATION=true
TELEGRAM_ALERT_DATA=true
TELEGRAM_ALERT_AGENT=true
TELEGRAM_TIMEOUT_MS=5000

# จำนวนการเพิ่มข้อมูลต่อผู้ใช้และประเภทข้อมูลที่ถือว่าผิดปกติ
TELEGRAM_DATA_ALERT_THRESHOLD=50
TELEGRAM_DATA_ALERT_WINDOW_MINUTES=10

# Agent health check
CRON_SECRET=use-a-long-random-secret
AGENT_OFFLINE_MINUTES=300

# ตรวจจับเหตุการณ์ผิดปกติซ้ำ
SECURITY_ALERT_THRESHOLD=5
SECURITY_ALERT_WINDOW_MINUTES=10
```

รัน migration `database/add_telegram_alerts.sql` และ `database/add_security_events.sql` ก่อนใช้งาน

## Agent health cron

เรียก endpoint นี้ตามรอบ เช่นทุก 15 นาที:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://your-domain.example/api/cron/agent-health
```

ระบบจะแจ้งเตือนเมื่อ agent ขาดการติดต่อนานกว่า `AGENT_OFFLINE_MINUTES` และแจ้งอีกครั้งเมื่อ agent กลับมาออนไลน์

## Events

- Login สำเร็จ, login ไม่สำเร็จ, OAuth state ผิด และบัญชีรออนุมัติพยายาม login
- ผู้ใช้ลงทะเบียนใหม่
- เพิ่มข้อมูลถึงเกณฑ์ (ค่าเริ่มต้น 50 record ภายใน 10 นาที ต่อผู้ใช้และประเภทข้อมูล) แจ้งไม่เกินหนึ่งครั้งต่อช่วงเวลาคงที่ 10 นาที โดยยังเก็บ audit log ทุกครั้ง แต่ไม่ส่งข้อความสำหรับการบันทึกทั่วไป
- นำเข้า CSV/Excel แจ้งสรุปครั้งเดียวต่อไฟล์หลังประมวลผล พร้อมจำนวนทั้งหมด สำเร็จ เพิ่มใหม่ แก้ไข และข้าม/ไม่สำเร็จ ไม่แจ้งแยกแต่ละแถว แม้ไม่มีแถวสำเร็จก็ส่งสรุป (ไฟล์ที่ถูกปฏิเสธก่อนประมวลผลจะไม่ส่งสรุป)
- รายการเพิ่มใหม่จากการนำเข้ายังอยู่ในยอด audit log ย้อนหลัง หากมีการเพิ่มข้อมูลทั่วไปตามมาภายในช่วงเวลาเดียวกันจะนำยอดนี้มาประเมินด้วย
- ติดตั้ง agent, enrollment token ผิด, agent credentials ผิด
- Agent offline และกลับมา online
- Login/API/Agent/OAuth ผิดปกติซ้ำจาก IP เดียวกันตามเกณฑ์ที่ตั้งไว้

ข้อความแจ้งเตือนจะแสดงหัวข้อภาษาไทยพร้อมไอคอน แบ่งรายละเอียดเป็นรายการ และแสดงเวลาเขตประเทศไทย
