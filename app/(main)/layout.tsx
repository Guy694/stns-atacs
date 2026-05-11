import { redirect } from "next/navigation";

import { Sidebar } from "@/app/_components/sidebar";
import { getCurrentUser } from "@/lib/auth";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <div className="flex min-h-screen flex-1 flex-col overflow-x-hidden">
        {/* Mobile top padding to not overlap hamburger */}
        <main className="flex-1 px-4 py-6 pt-14 sm:px-6 lg:px-8 lg:pt-6">
          {children}
        </main>
      </div>
    </div>
  );
}
