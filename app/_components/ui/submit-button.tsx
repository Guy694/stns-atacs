"use client";

// Submit button for server-action forms: disabled while the form is submitting (no double submit),
// optional pending label, and an optional SweetAlert confirmation before submitting.
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { confirmAction } from "@/app/_components/ui/confirm";

type Props = {
  children: ReactNode;
  pendingText?: ReactNode;
  className?: string;
  style?: CSSProperties;
  name?: string;
  value?: string;
  disabled?: boolean;
  ariaLabel?: string;
  confirm?: { title: string; text?: string; confirmText?: string; danger?: boolean };
};

export function SubmitButton({ children, pendingText, className, style, name, value, disabled, ariaLabel, confirm }: Props) {
  const { pending, data } = useFormStatus();
  // With several submit buttons in one form, only the one that was pressed shows the pending label.
  const isThisButton = pending && (!name || data?.get(name) === value);

  async function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (!confirm) return;
    event.preventDefault();
    const button = event.currentTarget;
    if (!(await confirmAction(confirm))) return;
    button.form?.requestSubmit(button);
  }

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={disabled || pending}
      aria-busy={isThisButton || undefined}
      aria-label={ariaLabel}
      onClick={confirm ? handleClick : undefined}
      className={`${className ?? ""} disabled:cursor-not-allowed disabled:opacity-60`}
      style={style}
    >
      {isThisButton && pendingText ? pendingText : children}
    </button>
  );
}
