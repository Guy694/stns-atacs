import { redirect } from "next/navigation";

import PublicDashboardPage from "@/app/public/page";
import { getCurrentUser } from "@/lib/auth";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * "/" is the public provincial summary for visitors; signed-in users go straight to their dashboard.
 * The public view stays reachable for everyone at /public.
 */
export default async function HomePage(props: Props) {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect("/dashboard");
  return <PublicDashboardPage {...props} />;
}
