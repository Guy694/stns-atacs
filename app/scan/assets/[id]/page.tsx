import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

type ScanAssetPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ScanAssetPage({ params }: ScanAssetPageProps) {
  const { id } = await params;
  const assetId = Number(id);

  if (!Number.isInteger(assetId) || assetId <= 0) {
    redirect("/login");
  }

  const target = `/assets/${assetId}`;
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(target)}&notice=${encodeURIComponent("กรุณาเข้าสู่ระบบก่อนแก้ไขข้อมูลทรัพย์สิน")}`);
  }

  redirect(target);
}
