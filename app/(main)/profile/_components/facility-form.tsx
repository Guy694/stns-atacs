"use client";

type FacilityOption = {
  id: number;
  facility_name: string;
  district_name: string | null;
};

type Props = {
  currentFacilityId: number | null;
  facilities: FacilityOption[];
};

/**
 * SEC-21: หน่วยงานที่สังกัดเป็นตัวกำหนดขอบเขตข้อมูลที่ผู้ใช้เห็นได้
 * จึงแสดงอย่างเดียว ไม่ให้ผู้ใช้เปลี่ยนเอง (ผู้ดูแลระบบแก้ได้ที่หน้าจัดการผู้ใช้งาน)
 */
export function FacilityForm({ currentFacilityId, facilities }: Props) {
  const facility = facilities.find((item) => item.id === currentFacilityId);

  return (
    <div className="glass-panel rounded-2xl p-6">
      <h2 className="section-title text-lg font-semibold">หน่วยงานที่สังกัด</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        หน่วยงานเป็นตัวกำหนดข้อมูลที่คุณเข้าถึงได้ จึงแก้ไขได้โดยผู้ดูแลระบบเท่านั้น
      </p>

      <div className="mt-4 rounded-xl border border-black/10 bg-black/5 px-4 py-3">
        {facility ? (
          <>
            <p className="font-medium text-[var(--foreground)]">{facility.facility_name}</p>
            {facility.district_name && <p className="mt-0.5 text-sm text-[var(--muted)]">อ.{facility.district_name}</p>}
          </>
        ) : (
          <p className="text-sm text-[var(--muted)]">ยังไม่ได้กำหนดหน่วยงาน</p>
        )}
      </div>

      <p className="mt-3 text-xs text-[var(--muted)]">
        หากข้อมูลไม่ถูกต้องหรือย้ายหน่วยงาน กรุณาติดต่อผู้ดูแลระบบเพื่อแก้ไขให้
      </p>
    </div>
  );
}
