import { redirect } from "next/navigation";

import { MainNavbar } from "@/app/_components/main-navbar";
import { Sidebar } from "@/app/_components/sidebar";
import { getMenuVisibility } from "@/lib/app-settings";
import { getCurrentUser } from "@/lib/auth";
import { selectRows } from "@/lib/mysql";
import { listGrantedPermissions } from "@/lib/role-permissions";
import type { RowDataPacket } from "mysql2/promise";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [grantedPermissions, menuVisibility] = await Promise.all([
    listGrantedPermissions(user.role),
    getMenuVisibility(),
  ]);
  let pendingRegistrationCount = 0;

  if (grantedPermissions.includes("users.manage")) {
    try {
      const rows = await selectRows<RowDataPacket & { total: number }>(
        "SELECT COUNT(*) AS total FROM users WHERE is_active = 0 AND last_login_at IS NULL"
      );
      pendingRegistrationCount = Number(rows[0]?.total ?? 0);
    } catch {
      pendingRegistrationCount = 0;
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        user={user}
        grantedPermissions={grantedPermissions}
        pendingRegistrationCount={pendingRegistrationCount}
        menuVisibility={menuVisibility}
      />
      <div className="flex min-h-screen flex-1 flex-col overflow-x-hidden">
        <MainNavbar user={user} />
        {/* Mobile top padding to not overlap hamburger */}
        <main className="flex-1 px-4 py-6 pt-4 sm:px-6 lg:px-8 lg:pt-4">
          {children}
        </main>
        <footer className="px-4 pb-6 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-black/8 bg-white/60 px-4 py-3 text-center text-xs text-[var(--muted)] sm:text-sm">
            กลุ่มงานสุขภาพดิจิทัล สำนักงานสาธารณสุขจังหวัดสตูล
          </div>
        </footer>
      </div>
    </div>
  );
}
