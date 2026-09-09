# Google / Gmail Login

## Environment variables

```env
GOOGLE_AUTH_ENABLED=true
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
AUTH_SECRET=use-a-long-random-secret
```

สร้าง OAuth 2.0 Client แบบ Web application ใน Google Cloud Console และเพิ่ม
`GOOGLE_CALLBACK_URL` เป็น Authorized redirect URI ให้ตรงทุกตัวอักษร

## Database

รัน migration:

```sql
SOURCE database/add_google_auth.sql;
```

## Flow

1. Google ยืนยันบัญชีและอีเมล
2. ระบบค้นหาด้วย `google_sub` ก่อน แล้วจึงค้นหาด้วยอีเมล
3. ถ้าพบผู้ใช้เดิม ระบบจะผูก Google ID กับบัญชีนั้น
4. ถ้าไม่พบ ระบบจะให้กรอกข้อมูลลงทะเบียนและสร้างบัญชีสถานะรออนุมัติ
5. แอดมินอนุมัติจากหน้า `/admin/users`
