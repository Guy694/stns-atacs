"use client";

import { useTransition } from "react";

import { ActionIconButton } from "@/app/_components/ui/action-icon-button";
import { deleteAssetAction } from "@/app/(main)/assets/actions";

type Props = {
  assetId: number;
  assetName: string;
};

export function DeleteAssetButton({ assetId, assetName }: Props) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`ยืนยันการลบ "${assetName}" ?\nการกระทำนี้ไม่สามารถย้อนกลับได้`)) return;
    startTransition(async () => {
      await deleteAssetAction(assetId);
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
