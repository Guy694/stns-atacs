"use client";

import { useEffect } from "react";

/**
 * กันหน้าขาวเมื่อเกิดข้อผิดพลาดที่ระดับ root layout
 * ส่งรายละเอียดไปให้เซิร์ฟเวอร์บันทึก เพื่อไม่ให้ผู้ใช้เจอปัญหาโดยที่ผู้ดูแลไม่รู้
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        where: "global-error",
        name: error.name,
        message: error.message,
        digest: error.digest,
        path: typeof window === "undefined" ? null : window.location.pathname,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="th">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f4f8fc", color: "#0f172a" }}>
        <main style={{ maxWidth: "32rem", margin: "12vh auto", padding: "0 1rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>ระบบขัดข้องชั่วคราว</h1>
          <p style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "#475569" }}>
            ระบบบันทึกข้อผิดพลาดนี้ให้ผู้ดูแลแล้ว กรุณาลองใหม่อีกครั้ง หากยังไม่ได้กรุณาแจ้งผู้ดูแลระบบ
          </p>
          {error.digest && (
            <p style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#94a3b8" }}>รหัสอ้างอิง: {error.digest}</p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.25rem", minHeight: "2.75rem", padding: "0 1.25rem", borderRadius: "0.75rem",
              border: "none", background: "#0f766e", color: "#fff", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer",
            }}
          >
            ลองใหม่อีกครั้ง
          </button>
        </main>
      </body>
    </html>
  );
}
