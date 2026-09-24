import { redirect } from "next/navigation";

import { MainNavbar } from "@/app/_components/main-navbar";
import { Sidebar } from "@/app/_components/sidebar";
import { IdleLogoutGuard } from "@/app/_components/idle-logout-guard";
import { SchemaWarningBanner } from "@/app/_components/schema-warning-banner";
import { SplashScreen } from "@/app/_components/splash-screen";
import { SPLASH_SEEN_SCRIPT } from "@/lib/splash";
import { getMenuVisibility } from "@/lib/app-settings";
import { getCurrentUser } from "@/lib/auth";
import { getFacilityAgentContext } from "@/lib/facility-work-groups";
import { selectRows } from "@/lib/mysql";
import { listGrantedPermissions } from "@/lib/role-permissions";
import type { RowDataPacket } from "mysql2/promise";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [initialGrantedPermissions, menuVisibility] = await Promise.all([
    listGrantedPermissions(user.role),
    getMenuVisibility(),
  ]);
  let grantedPermissions = initialGrantedPermissions;
  let pendingRegistrationCount = 0;

  if (user.role === "officer" && grantedPermissions.includes("work-groups.manage")) {
    const facility = user.facilityId ? await getFacilityAgentContext(Number(user.facilityId)) : null;
    if (!facility?.requiresWorkGroup) {
      grantedPermissions = grantedPermissions.filter((permission) => permission !== "work-groups.manage");
    }
  }

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
    <div className="app-shell flex min-h-screen bg-[var(--background)]">
      <SplashScreen />
      {/* Must follow the splash: hides it before first paint when this session has already seen it. */}
      <script dangerouslySetInnerHTML={{ __html: SPLASH_SEEN_SCRIPT }} />
      <IdleLogoutGuard />
      <Sidebar
        user={user}
        grantedPermissions={grantedPermissions}
        pendingRegistrationCount={pendingRegistrationCount}
        menuVisibility={menuVisibility}
      />
      <div className="min-w-0 flex min-h-screen flex-1 flex-col overflow-x-hidden">
        <MainNavbar user={user} />
        {/* Mobile top padding to not overlap hamburger */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <SchemaWarningBanner canManageSystem={user.role === "admin"} />
          {children}
        </main>
        <footer className="px-4 pb-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1600px] border-t border-[var(--line)] px-4 py-4 text-center text-xs text-[var(--muted)] sm:text-sm">
            กลุ่มงานสุขภาพดิจิทัล สำนักงานสาธารณสุขจังหวัดสตูล
          </div>
        </footer>
      </div>
    </div>
  );
}
