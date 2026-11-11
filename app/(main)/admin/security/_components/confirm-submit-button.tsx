"use client";

import type { MouseEvent, ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { confirmAction } from "@/app/_components/ui/confirm";

/** Submit button for a server-action form that asks first (SweetAlert2, same style as the rest of the app). */
export function ConfirmSubmitButton({ message, className, children }: { message: string; className?: string; children: ReactNode }) {
  const { pending } = useFormStatus();

  async function onClick(event: MouseEvent<HTMLButtonElement>) {
    const button = event.currentTarget;
    if (button.dataset.confirmed === "1") {
      delete button.dataset.confirmed;
      return;
    }
    event.preventDefault();
    if (!(await confirmAction({ title: message, confirmText: "ยืนยัน", danger: true }))) return;
    button.dataset.confirmed = "1";
    button.form?.requestSubmit(button);
  }

  return (
    <button type="submit" onClick={onClick} disabled={pending} aria-busy={pending} className={className}>
      {children}
    </button>
  );
}
