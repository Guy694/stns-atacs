"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { ActionIconButton } from "@/app/_components/ui/action-icon-button";
import { confirmAction, showError } from "@/app/_components/ui/confirm";
import { toast } from "@/app/_components/ui/toast";
import { deleteAssetAction } from "@/app/(main)/assets/actions";

type Props = {
  assetId: number;
  assetName: string;
  /**
   * App path to open after a successful delete (e.g. "/assets/?toast=deleted" from the detail page, which no
   * longer exists afterwards). The router adds basePath itself. Omit to stay on the current page.
   */
  redirectTo?: string;
};

export function DeleteAssetButton({ assetId, assetName, redirectTo }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function handleClick() {
    const confirmed = await confirmAction({
      title: `ลบ "${assetName}" ?`,
      text: "รายการจะถูกนำออกจากทะเบียนและรายงาน แต่ประวัติการซ่อม ยืม โอน และจำหน่ายยังเก็บไว้ (ผู้ดูแลระบบกู้คืนได้ที่ ทรัพย์สิน › ถังขยะ)",
      confirmText: "ลบทรัพย์สิน",
      danger: true,
    });
    if (!confirmed) return;
    startTransition(async () => {
      const error = await deleteAssetAction(assetId);
      // The action may refuse with a Thai message (e.g. open repair/loan/transfer work); show it as-is.
      if (error) await showError(error, "ลบทรัพย์สินไม่สำเร็จ");
      else if (redirectTo) router.replace(redirectTo);
      else toast.success("ลบทรัพย์สินแล้ว");
    });
  }

  return (
    <ActionIconButton
      icon="trash"
      tone="danger"
      label={pending ? `กำลังลบ ${assetName}…` : `ลบ ${assetName}`}
      onClick={handleClick}
      disabled={pending}
    />
  );
}
