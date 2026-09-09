"use client";

import { useTransition } from "react";

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
    <button
      onClick={handleClick}
      disabled={pending}
      className="inline-flex min-h-11 items-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
    >
      {pending ? "กำลังลบ…" : "ลบ"}
    </button>
  );
}
