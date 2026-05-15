import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { selectRows } from "@/lib/mysql";
import type { RowDataPacket } from "mysql2/promise";
import { AgentDownloadPanel } from "./_components/agent-download-panel";

type FacilityRow = RowDataPacket & { name: string };

export default async function AgentDownloadPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let facilityName = "–";
  if (user.facilityId) {
    try {
      const rows = await selectRows<FacilityRow>(
        "SELECT name FROM health_facilities WHERE id = ? LIMIT 1",
        [user.facilityId]
      );
      if (rows[0]) facilityName = rows[0].name;
    } catch {
      // ignore
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--muted)]">ATACS Agent</p>
        <h1 className="section-title mt-1 text-3xl font-semibold">ดาวน์โหลด Agent</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          ติดตั้ง ATACS Agent บนเครื่องคอมพิวเตอร์ของหน่วยงาน เพื่อรายงาน inventory อัตโนมัติ
        </p>
      </div>

      {!user.facilityId ? (
        <div className="glass-panel rounded-2xl px-6 py-8 text-center">
          <p className="text-2xl mb-2">🏥</p>
          <p className="font-medium">บัญชีของคุณยังไม่ได้ผูกกับหน่วยงาน</p>
          <p className="mt-1 text-sm text-[var(--muted)]">กรุณาติดต่อผู้ดูแลระบบเพื่อกำหนดหน่วยงานที่สังกัดก่อน</p>
        </div>
      ) : (
        <AgentDownloadPanel facilityName={facilityName} />
      )}
    </div>
  );
}
