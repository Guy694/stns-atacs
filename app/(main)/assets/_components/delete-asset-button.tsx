"use client";

import { useTransition } from "react";

import { ActionIconButton } from "@/app/_components/ui/action-icon-button";
import { confirmAction, showError } from "@/app/_components/ui/confirm";
import { deleteAssetAction } from "@/app/(main)/assets/actions";

type Props = {
  assetId: number;
  assetName: string;
};

export function DeleteAssetButton({ assetId, assetName }: Props) {
  const [pending, startTransition] = useTransition();

  async function handleClick() {
    const confirmed = await confirmAction({
      title: `ลบ "${assetName}" ?`,
      text: "การกระทำนี้ไม่สามารถย้อนกลับได้",
      confirmText: "ลบทรัพย์สิน",
      danger: true,
    });
    if (!confirmed) return;
    startTransition(async () => {
      const error = await deleteAssetAction(assetId);
      if (error) await showError(error, "ลบทรัพย์สินไม่สำเร็จ");
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
