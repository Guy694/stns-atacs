# 🔧 แก้ไข: ThaiID Login โดนดีดกลับหน้า Login

## ปัญหาที่พบ

1. ❌ **เข้าสู่ระบบด้วย ThaiID แล้วโดนดีดกลับมาหน้า login**
2. ❌ **connect ETIMEDOUT** เมื่อเชื่อมต่อกับ ThaiID API

---

## สาเหตุ

### ปัญหาหลัก: Session Management ไม่สอดคล้องกัน

1. **ThaiID Callback** บันทึก session ใน **Cookie** (`user_session`)
2. **AuthContext** อ่าน session จาก **localStorage** (`sessionToken`)
3. เมื่อ redirect ไป `/dashboard` → AuthContext ไม่พบ session → redirect กลับ `/login`

### ปัญหารอง: Timeout ไม่มีการจัดการ

- ไม่มี timeout configuration สำหรับ fetch() 
- ไม่มี error handling สำหรับ ETIMEDOUT

---

## ✅ การแก้ไขที่ทำไปแล้ว

### 1. เพิ่ม Timeout Configuration ([callback/route.js](app/api/auth/thaiid/callback/route.js))

```javascript
// เพิ่ม AbortController สำหรับ timeout 30 วินาที
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000);

const response = await fetch(THAIID_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {...},
    body: tokenParams.toString(),
    signal: controller.signal
});

clearTimeout(timeout);
```

**จัดการ Abort Error:**
```javascript
catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
        throw new Error('การเชื่อมต่อ ThaiID หมดเวลา (timeout) กรุณาลองใหม่อีกครั้ง');
    }
    throw error;
}
```

### 2. ปรับปรุง Error Display ([login/page.jsx](app/login/page.jsx))

```jsx
// แสดง error แบบหลายบรรทัด
<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
    <div className="flex items-start gap-2">
        <span className="text-lg">⚠️</span>
        <div className="flex-1 whitespace-pre-line">{error}</div>
    </div>
</div>
```

**เพิ่ม Error Handler สำหรับ ETIMEDOUT:**
```jsx
if (decodedMessage.includes('timeout') || decodedMessage.includes('ETIMEDOUT')) {
    setError('⏱️ การเชื่อมต่อ ThaiID หมดเวลา\n\n' +
            'สาเหตุที่เป็นไปได้:\n' +
            '• เครือข่ายอินเทอร์เน็ตไม่เสถียร\n' +
            '• บริการ ThaiID ไม่สามารถเข้าถึงได้ชั่วคราว\n' +
            '• Server ไม่สามารถเชื่อมต่อกับ ThaiID API\n\n' +
            'คำแนะนำ:\n' +
            '✓ ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต\n' +
            '✓ ลองใหม่อีกครั้งในอีกสักครู่\n' +
            '✓ หรือใช้ username/password แทน');
}
```

### 3. แก้ไข Session Management ([AuthContext.jsx](context/AuthContext.jsx))

**เพิ่มการตรวจสอบ session จาก Cookie:**

```javascript
const validateSession = async () => {
    try {
        // 1. ตรวจสอบจาก localStorage ก่อน (username/password login)
        const sessionToken = localStorage.getItem("sessionToken");
        const storedUser = localStorage.getItem("user");
        
        if (sessionToken && storedUser) {
            const response = await fetch('/api/auth/validate', {...});
            if (data.success && data.user) {
                setUser(data.user);
                return;
            }
        }

        // 2. ตรวจสอบจาก cookie (ThaiID login)
        const cookieResponse = await fetch('/api/auth/session');
        const cookieData = await cookieResponse.json();

        if (cookieData.success && cookieData.user) {
            // บันทึกลง localStorage เพื่อใช้งานต่อ
            setUser(cookieData.user);
            localStorage.setItem("user", JSON.stringify(cookieData.user));
            
            const thaiIdToken = `thaiid_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            localStorage.setItem("sessionToken", thaiIdToken);
            return;
        }

        // 3. ไม่พบ session
        localStorage.removeItem("sessionToken");
        localStorage.removeItem("user");
        setUser(null);
    } catch (error) {
        console.error('Error validating session:', error);
        setUser(null);
    } finally {
        setLoading(false);
    }
};
```

**ปรับปรุง logout ให้ลบ cookie:**

```javascript
const logout = async () => {
    try {
        // ลบ session จาก server
        await fetch('/api/auth/logout', {...});
        
        // ลบ cookie (สำหรับ ThaiID)
        document.cookie = 'user_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        
    } finally {
        setUser(null);
        localStorage.removeItem("sessionToken");
        localStorage.removeItem("user");
    }
};
```

### 4. ปรับปรุง ThaiID Callback Page ([auth/thaiid/callback/page.jsx](app/auth/thaiid/callback/page.jsx))

**เพิ่มการบันทึก session ลง localStorage:**

```javascript
const handleCallback = async () => {
    const response = await fetch('/api/auth/session');
    const data = await response.json();

    if (data.success && data.user) {
        // บันทึกลง localStorage
        localStorage.setItem("user", JSON.stringify(data.user));
        
        const sessionToken = `thaiid_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        localStorage.setItem("sessionToken", sessionToken);
        
        // เซ็ต user ใน AuthContext
        setUser(data.user);
        
        // Redirect ตามสถานะ
        if (data.user.isApproved === false) {
            router.push('/auth/thaiid/pending');
        } else if (data.user.isNewUser) {
            router.push('/auth/thaiid/registration');
        } else {
            router.push('/dashboard');
        }
    }
};
```

### 5. ปรับปรุง Logout API ([api/auth/logout/route.js](app/api/auth/logout/route.js))

**เพิ่มการลบ cookie:**

```javascript
const response = NextResponse.json({
    success: true,
    message: 'ออกจากระบบสำเร็จ'
});

// ลบ cookie
response.cookies.set('user_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0
});

return response;
```

---

## 🎯 ผลลัพธ์

### ✅ ที่ทำงานแล้ว

1. ✅ Login ด้วย ThaiID สำเร็จ → ไม่โดนดีดกลับหน้า login
2. ✅ Session ทำงานร่วมกันได้ทั้ง Cookie และ localStorage
3. ✅ Timeout error แสดงข้อความที่เข้าใจง่าย พร้อมคำแนะนำ
4. ✅ Logout ลบ session ทั้งหมดออกอย่างสมบูรณ์
5. ✅ รองรับทั้ง username/password และ ThaiID login

### 📋 Flow การทำงานใหม่

```
ThaiID Login
    ↓
/api/auth/thaiid/authorize (redirect ไป ThaiID)
    ↓
ThaiID Authentication
    ↓
/api/auth/thaiid/callback (บันทึก cookie)
    ↓
/auth/thaiid/callback (frontend)
    ↓
อ่าน cookie → บันทึก localStorage → setUser()
    ↓
Redirect ตามสถานะ:
  • isApproved = false → /auth/thaiid/pending
  • isNewUser = true → /auth/thaiid/registration
  • ปกติ → /dashboard
    ↓
Dashboard เช็ค AuthContext.user
    ↓
✅ พบ user → แสดงหน้า dashboard
```

---

## 🧪 วิธีทดสอบ

### 1. ทดสอบ ThaiID Login

```bash
1. เข้า http://localhost:3000/login
2. คลิก "เข้าสู่ระบบด้วย ThaiID"
3. Login ด้วย ThaiID
4. ตรวจสอบว่า redirect ไป dashboard โดยไม่โดนดีดกลับ
```

### 2. ทดสอบ Session Persistence

```bash
1. Login ด้วย ThaiID
2. Refresh หน้า dashboard
3. ตรวจสอบว่ายังคง login อยู่
4. ตรวจสอบ localStorage และ cookie ใน DevTools
```

### 3. ทดสอบ Logout

```bash
1. Login ด้วย ThaiID
2. คลิก Logout
3. ตรวจสอบว่า:
   - localStorage ถูกลบ
   - cookie ถูกลบ
   - redirect กลับ /login
   - ไม่สามารถเข้า /dashboard ได้
```

### 4. ทดสอบ Timeout Error

```bash
# จำลอง network delay
1. เปิด DevTools → Network tab
2. เลือก "Slow 3G" หรือ "Offline"
3. คลิก "เข้าสู่ระบบด้วย ThaiID"
4. ตรวจสอบว่าแสดง timeout error พร้อมคำแนะนำ
```

---

## 📝 สิ่งที่ควรทราบ

### Cookie vs localStorage

| Feature | Cookie | localStorage |
|---------|--------|--------------|
| ใช้สำหรับ | ThaiID Login | Username/Password |
| Accessible | Server & Client | Client only |
| Security | httpOnly, secure | ถูก XSS ได้ง่ายกว่า |
| Expiry | maxAge 24 hours | Manual removal |
| Size Limit | ~4KB | ~5-10MB |

### Session Token Format

```javascript
// Username/Password Login
sessionToken: "uuid-from-database"

// ThaiID Login
sessionToken: "thaiid_{timestamp}_{random}"
```

### User Object Structure

```javascript
{
    id: 123,
    username: "thaiid_12345678",
    fullName: "นาย ทดสอบ ระบบ",
    role: "staff",
    isApproved: true,
    isNewUser: false,
    loginMethod: "thaiid",
    permissions: {...},
    thaiIdData: {
        name: "นาย ทดสอบ ระบบ",
        given_name: "ทดสอบ",
        family_name: "ระบบ",
        birthdate: "1990-01-01",
        ...
    }
}
```

---

## 🔐 Security Considerations

1. **Cookie Security**
   - `httpOnly: true` - ป้องกัน JavaScript access
   - `secure: true` - ส่งผ่าน HTTPS เท่านั้น (production)
   - `sameSite: 'lax'` - ป้องกัน CSRF

2. **PID Hashing**
   - เลขบัตรประชาชนถูก hash ด้วย SHA-256
   - ไม่เก็บ PID แบบ plain text ในฐานข้อมูล

3. **Session Expiry**
   - Cookie: 24 ชั่วโมง
   - localStorage: ไม่หมดอายุอัตโนมัติ (ต้องลบเอง)

---

## 📚 ไฟล์ที่เกี่ยวข้อง

- ✅ [app/api/auth/thaiid/callback/route.js](app/api/auth/thaiid/callback/route.js) - Timeout + Error handling
- ✅ [app/auth/thaiid/callback/page.jsx](app/auth/thaiid/callback/page.jsx) - localStorage integration
- ✅ [context/AuthContext.jsx](context/AuthContext.jsx) - Hybrid session management
- ✅ [app/login/page.jsx](app/login/page.jsx) - Error display
- ✅ [app/api/auth/logout/route.js](app/api/auth/logout/route.js) - Cookie cleanup
- ✅ [app/api/auth/session/route.js](app/api/auth/session/route.js) - Cookie reading

---

## 🎉 สรุป

ระบบ ThaiID Login ตอนนี้:
- ✅ ไม่โดนดีดกลับหน้า login แล้ว
- ✅ รองรับทั้ง Cookie และ localStorage
- ✅ จัดการ timeout error อย่างเหมาะสม
- ✅ แสดง error message ที่เข้าใจง่าย
- ✅ ปลอดภัยตามมาตรฐาน

อัพเดทล่าสุด: 29 ธันวาคม 2025
