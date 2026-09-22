import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

type ScanAssetPageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Target of the QR sticker. Nothing about the asset is shown without signing in: anonymous visitors go to
 * the login page and come back to the asset (with its check-in panel) afterwards.
 */
export default async function ScanAssetPage({ params }: ScanAssetPageProps) {
  const { id } = await params;
  const assetId = Number(id);

  if (!Number.isInteger(assetId) || assetId <= 0) {
    redirect("/login");
  }

  const target = `/assets/${assetId}`;
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(target)}&notice=${encodeURIComponent("กรุณาเข้าสู่ระบบก่อนสแกนตรวจนับหรือดูข้อมูลครุภัณฑ์")}`);
  }

  redirect(target);
}
