"use client";

// One confirmation/alert style for the whole app (SweetAlert2), instead of the browser's confirm()/alert().
import type { FormEvent } from "react";
import Swal from "sweetalert2";

const baseOptions = {
  reverseButtons: true,
  cancelButtonColor: "#6b7280",
  background: "#f8fffb",
  color: "#113127",
  customClass: {
    popup: "rounded-3xl border border-emerald-200 shadow-xl",
    title: "text-xl font-bold",
    confirmButton: "rounded-xl px-4 py-2 font-semibold",
    cancelButton: "rounded-xl px-4 py-2 font-semibold",
  },
} as const;

/** Ask before a destructive or significant action. Resolves true only when the user confirms. */
export async function confirmAction(options: { title: string; text?: string; confirmText?: string; danger?: boolean }) {
  const result = await Swal.fire({
    ...baseOptions,
    title: options.title,
    text: options.text,
    icon: options.danger ? "warning" : "question",
    showCancelButton: true,
    confirmButtonText: options.confirmText ?? "ยืนยัน",
    cancelButtonText: "ยกเลิก",
    focusCancel: true,
    confirmButtonColor: options.danger ? "#b91c1c" : "#15803d",
  });
  return result.isConfirmed;
}

/** Show a server-side error the user must notice (failed delete, failed toggle, …). */
export async function showError(message: string, title = "ทำรายการไม่สำเร็จ") {
  await Swal.fire({ ...baseOptions, title, text: message, icon: "error", confirmButtonText: "ตกลง", confirmButtonColor: "#15803d" });
}

/**
 * Confirm, then submit a <form> whose submit handler called this (onSubmit={confirmSubmit({...})}).
 * Works for server-action forms: the form is re-submitted with requestSubmit after confirmation.
 */
export function confirmSubmit(options: { title: string; text?: string; confirmText?: string; danger?: boolean }) {
  return async (event: FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    if (form.dataset.confirmed === "1") {
      delete form.dataset.confirmed;
      return;
    }
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    if (!(await confirmAction(options))) return;
    form.dataset.confirmed = "1";
    form.requestSubmit(submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement ? submitter : undefined);
  };
}
