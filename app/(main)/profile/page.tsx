import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { selectRows } from "@/lib/mysql";
import type { RowDataPacket } from "mysql2/promise";
import { ProfileForm } from "./_components/profile-form";
import { ChangePasswordForm } from "./_components/change-password-form";

type UserDetailRow = RowDataPacket & {
  full_name: string;
  email: string | null;
  username: string | null;
  thaid_cid: string | null;
  role: "admin" | "officer";
  created_at: Date | string;
  last_login_at: Date | string | null;
  password_hash: string | null;
};

function formatDate(v: Date | string | null) {
  if (!v) return "–";
  return (v instanceof Date ? v.toISOString() : String(v)).slice(0, 16).replace("T", " ");
}

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let detail: UserDetailRow | null = null;

  try {
    const rows = await selectRows<UserDetailRow>(
      "SELECT full_name, email, username, thaid_cid, role, created_at, last_login_at, password_hash FROM users WHERE id = ? LIMIT 1",
      [user.id]
    );
    detail = rows[0] ?? null;
  } catch {
    /* fallback to session data */
  }

  const hasPassword = !!detail?.password_hash;
  const hasThaiD = !!detail?.thaid_cid;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">

      {/* Header */}
      <div className="glass-panel overflow-hidden rounded-2xl">
        <div className="bg-[linear-gradient(135deg,#0a4f47,#0d6f63)] px-6 py-7 text-white sm:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-2xl font-semibold">
              {user.fullName.charAt(0)}
            </div>
            <div>
              <p className="text-xl font-semibold">{user.fullName}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs">{user.role}</span>
                {hasThaiD && <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs">ThaiD</span>}
                {hasPassword && <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs">Username</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-black/6 sm:grid-cols-4">
          {[
            { label: "Email", value: detail?.email ?? user.email ?? "–" },
            { label: "Username", value: detail?.username ?? "–" },
            { label: "สมัครเมื่อ", value: formatDate(detail?.created_at ?? null) },
            { label: "เข้าใช้งานล่าสุด", value: formatDate(detail?.last_login_at ?? null) },
          ].map((item) => (
            <div key={item.label} className="px-4 py-3">
              <p className="text-xs text-[var(--muted)]">{item.label}</p>
              <p className="mt-0.5 truncate text-sm font-medium">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Edit profile */}
      <ProfileForm
        currentFullName={detail?.full_name ?? user.fullName}
        currentEmail={detail?.email ?? user.email ?? ""}
      />

      {/* Change password */}
      {hasPassword ? (
        <ChangePasswordForm />
      ) : (
        <div className="glass-panel rounded-2xl p-5 text-sm text-[var(--muted)]">
          บัญชีนี้ใช้การยืนยันตัวตนผ่าน ThaiD เท่านั้น ไม่มีรหัสผ่าน
          กรุณาติดต่อผู้ดูแลระบบหากต้องการเพิ่มการเข้าสู่ระบบแบบ Username/Password
        </div>
      )}
    </div>
  );
}
