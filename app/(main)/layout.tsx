import { redirect } from "next/navigation";

import { MainNavbar } from "@/app/_components/main-navbar";
import { Sidebar } from "@/app/_components/sidebar";
import { IdleLogoutGuard } from "@/app/_components/idle-logout-guard";
import { AnnouncementPopup } from "@/app/_components/announcement-popup";
import { MaintenanceBanner } from "@/app/_components/maintenance-banner";
import { SchemaWarningBanner } from "@/app/_components/schema-warning-banner";
import { SplashScreen } from "@/app/_components/splash-screen";
import { SPLASH_SEEN_SCRIPT } from "@/lib/splash";
import { getAnnouncement } from "@/lib/announcement";
import { ANNOUNCEMENT_IMAGE_URL_PREFIX, isAnnouncementVisible } from "@/lib/announcement-shared";
import { APP_VERSION_LABEL } from "@/lib/app-version";
import { getMenuVisibility } from "@/lib/app-settings";
import { getCurrentUser } from "@/lib/auth";
import { canBypassMaintenance, isMaintenanceEnabled } from "@/lib/maintenance";
import { getFacilityAgentContext } from "@/lib/facility-work-groups";
import { selectRows } from "@/lib/mysql";
import { listGrantedPermissions } from "@/lib/role-permissions";
import type { RowDataPacket } from "mysql2/promise";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // ปิดปรับปรุงระบบ: ผู้ใช้ทั่วไปออกไปหน้าแจ้งสถานะ ผู้ดูแลระบบยังทำงานต่อได้
  if (!canBypassMaintenance(user) && (await isMaintenanceEnabled())) redirect("/maintenance");
  const [initialGrantedPermissions, menuVisibility, announcement] = await Promise.all([
    listGrantedPermissions(user.role),
    getMenuVisibility(),
    getAnnouncement(),
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
      {isAnnouncementVisible(announcement) && (
        <AnnouncementPopup
          revision={announcement.revision}
          title={announcement.title}
          version={announcement.version}
          message={announcement.message}
          imageUrl={announcement.imageName ? `${ANNOUNCEMENT_IMAGE_URL_PREFIX}${announcement.imageName}` : ""}
        />
      )}
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
          <MaintenanceBanner canManage={user.role === "admin"} />
          <SchemaWarningBanner canManageSystem={user.role === "admin"} />
          {children}
        </main>
        <footer className="px-4 pb-6 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-[1600px] grid-cols-1 items-center gap-1 border-t border-[var(--line)] px-4 py-4 text-xs text-[var(--muted)] sm:grid-cols-[1fr_auto_1fr] sm:text-sm">
            <span className="hidden sm:block" aria-hidden="true" />
            <span className="text-center">กลุ่มงานสุขภาพดิจิทัล สำนักงานสาธารณสุขจังหวัดสตูล</span>
            <span className="text-right font-medium tabular-nums" title="เวอร์ชันของระบบ">{APP_VERSION_LABEL}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
