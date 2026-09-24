import { getSchemaReport } from "@/lib/schema-check";

/**
 * แถบเตือนผู้ดูแลระบบเมื่อยังไม่ได้รัน migration บางไฟล์
 * ถ้าไม่เตือน หน้าที่เกี่ยวข้องจะแสดงข้อมูลว่างเงียบ ๆ (withSchemaFallback) โดยไม่มีใครรู้
 * แสดงเฉพาะผู้ที่จัดการระบบได้เท่านั้น
 */
export async function SchemaWarningBanner({ canManageSystem }: { canManageSystem: boolean }) {
  if (!canManageSystem) return null;

  const report = await getSchemaReport();
  if (report.unavailable || report.pending.length === 0) return null;

  return (
    <div
      role="status"
      className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <p className="font-semibold">
        ฐานข้อมูลยังไม่ได้รัน migration {report.pending.length.toLocaleString("th-TH")} ไฟล์ — บางหน้าจะแสดงข้อมูลว่างโดยไม่แจ้งข้อผิดพลาด
      </p>
      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs">
        {report.pending.slice(0, 5).map((item) => (
          <li key={item.file}>
            <span className="font-medium">{item.file}</span> — ขาด {item.missing.slice(0, 4).join(", ")}
            {item.missing.length > 4 ? ` และอีก ${item.missing.length - 4} รายการ` : ""}
          </li>
        ))}
      </ul>
      {report.pending.length > 5 && (
        <p className="mt-1 text-xs">… และอีก {(report.pending.length - 5).toLocaleString("th-TH")} ไฟล์</p>
      )}
      <p className="mt-2 text-xs">
        สำรองฐานข้อมูลก่อน แล้วรันไฟล์ในโฟลเดอร์ <code>database/</code> ตามชื่อข้างต้น (รันซ้ำได้อย่างปลอดภัย)
      </p>
    </div>
  );
}
