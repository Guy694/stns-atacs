# 🔧 ThaiID Troubleshooting Guide

## ปัญหา: connect ETIMEDOUT

### สาเหตุที่เป็นไปได้

1. **ปัญหา Network/Firewall**
   - Server ไม่สามารถเชื่อมต่อไปยัง ThaiID API (https://imauth.bora.dopa.go.th) ได้
   - Firewall หรือ Security Group บล็อกการเชื่อมต่อออกไป
   - DNS resolution ล้มเหลว

2. **ปัญหา Server Configuration**
   - Proxy settings ไม่ถูกต้อง
   - SSL/TLS certificate ไม่ valid
   - Network timeout สั้นเกินไป

3. **ปัญหา ThaiID Service**
   - บริการ ThaiID ไม่สามารถเข้าถึงได้ชั่วคราว
   - API endpoint เปลี่ยนแปลง

---

## ✅ การแก้ไขที่ทำไปแล้ว

### 1. เพิ่ม Timeout Configuration
```javascript
// เพิ่ม AbortController สำหรับ timeout 30 วินาที
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000);

const response = await fetch(url, {
    signal: controller.signal
});
```

### 2. เพิ่ม Error Handling
- จับ error `AbortError` และแสดงข้อความที่เข้าใจง่าย
- แสดงคำแนะนำในการแก้ไข
- เพิ่ม fallback ให้ใช้ username/password แทน

### 3. ปรับปรุงการแสดง Error Message
- แสดงข้อความ error แบบหลายบรรทัด (multiline)
- เพิ่มคำแนะนำการแก้ไข
- ใช้ emoji เพื่อความชัดเจน

---

## 🔍 การตรวจสอบปัญหา

### 1. ตรวจสอบการเชื่อมต่อจาก Server

**Windows (PowerShell):**
```powershell
# ทดสอบ DNS resolution
nslookup imauth.bora.dopa.go.th

# ทดสอบการเชื่อมต่อ
Test-NetConnection imauth.bora.dopa.go.th -Port 443

# ทดสอบ HTTP request (ถ้ามี curl)
curl -v https://imauth.bora.dopa.go.th/api/v2/oauth2/auth/
```

**Linux:**
```bash
# ทดสอบ DNS
dig imauth.bora.dopa.go.th

# ทดสอบการเชื่อมต่อ
curl -v --connect-timeout 30 https://imauth.bora.dopa.go.th/api/v2/oauth2/auth/

# ตรวจสอบ firewall
sudo iptables -L -n
```

### 2. ตรวจสอบ Environment Variables
```powershell
# ตรวจสอบว่ามีค่าครบถ้วน
echo $env:CLIENT_ID
echo $env:CLIENT_SECRET
echo $env:APIKEY
echo $env:CALLBACK
```

### 3. ตรวจสอบ Logs
- เปิด Developer Console ในเบราว์เซอร์
- ตรวจสอบ Network tab เพื่อดู request/response
- ตรวจสอบ Server logs สำหรับ error details

---

## 🛠️ วิธีแก้ไข

### แนวทาง 1: ใช้ ngrok หรือ Tunneling Service (สำหรับ Development)

หากคุณใช้ localhost และ ThaiID ไม่สามารถ callback กลับมาได้:

```powershell
# ติดตั้ง ngrok
# Download from: https://ngrok.com/download

# เริ่ม tunnel
ngrok http 3000

# แล้ว update CALLBACK ใน .env.local ให้เป็น ngrok URL
# CALLBACK=https://your-ngrok-url.ngrok.io/api/auth/thaiid/callback
```

### แนวทาง 2: ตั้งค่า Proxy (ถ้ามี Corporate Proxy)

**สำหรับ Node.js:**
```javascript
// ใน callback/route.js
const HttpsProxyAgent = require('https-proxy-agent');

const agent = new HttpsProxyAgent('http://proxy.example.com:8080');

const response = await fetch(THAIID_CONFIG.tokenUrl, {
    method: 'POST',
    agent: agent, // เพิ่ม proxy agent
    headers: {...},
    body: tokenParams.toString()
});
```

### แนวทาง 3: เพิ่ม Retry Logic

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            return response;
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            console.log(`Retry ${i + 1}/${maxRetries}...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}
```

### แนวทาง 4: ตรวจสอบ Firewall/Security Group

**Windows Firewall:**
```powershell
# อนุญาตให้ Node.js เชื่อมต่อออก
New-NetFirewallRule -DisplayName "Node.js Outbound" -Direction Outbound -Program "C:\Program Files\nodejs\node.exe" -Action Allow
```

**Linux (ufw):**
```bash
# อนุญาตการเชื่อมต่อออก
sudo ufw allow out 443/tcp
```

### แนวทาง 5: ใช้ Alternative Authentication

หากไม่สามารถใช้ ThaiID ได้ในขณะนี้:
- ใช้ username/password authentication แทน
- รอให้บริการ ThaiID กลับมาปกติ
- ติดต่อทีม DOPA เพื่อสอบถามสถานะบริการ

---

## 📝 Checklist สำหรับแก้ปัญหา

- [ ] ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต
- [ ] ทดสอบ DNS resolution
- [ ] ตรวจสอบ Firewall/Security Group settings
- [ ] ตรวจสอบ Environment Variables (CLIENT_ID, CLIENT_SECRET, APIKEY, CALLBACK)
- [ ] ทดสอบ ThaiID API โดยตรงจาก Server (curl)
- [ ] ตรวจสอบ Server logs สำหรับข้อมูลเพิ่มเติม
- [ ] ลอง restart application
- [ ] ติดต่อทีม DOPA หากปัญหายังคงมีอยู่

---

## 📞 ติดต่อฝ่ายสนับสนุน

**DOPA (กรมการปกครอง):**
- เว็บไซต์: https://imauth.bora.dopa.go.th
- อีเมล: support@dopa.go.th (ตรวจสอบจากเอกสารอย่างเป็นทางการ)

**ระบบ EOC:**
- ติดต่อผู้ดูแลระบบท้องถิ่น
- ตรวจสอบ logs ที่ Terminal

---

## 🔄 การ Monitor และ Logging

### เพิ่ม Logging เพิ่มเติม

```javascript
console.log('ThaiID Request:', {
    timestamp: new Date().toISOString(),
    url: THAIID_CONFIG.tokenUrl,
    timeout: 30000,
    hasClientId: !!THAIID_CONFIG.clientId,
    hasApiKey: !!THAIID_CONFIG.apiKey
});
```

### ตรวจสอบ Response Time

```javascript
const startTime = Date.now();
try {
    const response = await fetch(...);
    const duration = Date.now() - startTime;
    console.log(`Request completed in ${duration}ms`);
} catch (error) {
    const duration = Date.now() - startTime;
    console.log(`Request failed after ${duration}ms:`, error.message);
}
```

---

## 💡 Tips สำหรับ Production

1. **ใช้ Health Check Endpoint**
   - สร้าง endpoint สำหรับตรวจสอบการเชื่อมต่อ ThaiID
   - Alert เมื่อเชื่อมต่อล้มเหลว

2. **Implement Circuit Breaker Pattern**
   - หยุดส่ง request ชั่วคราวเมื่อ ThaiID ไม่ตอบสนอง
   - ลดโหลดบน API และเพิ่มประสิทธิภาพ

3. **Cache Configuration**
   - Cache public key หรือ configuration จาก ThaiID
   - ลดการเรียก API ที่ไม่จำเป็น

4. **Monitoring**
   - ติดตั้ง monitoring tools (e.g., Prometheus, Grafana)
   - ตั้ง alerts สำหรับ timeout errors

---

อัพเดทล่าสุด: 29 ธันวาคม 2025
