"use client";

import { useTransition } from "react";

import { updateRolePermissionAction } from "@/app/(main)/admin/settings/permissions/actions";
import { showError } from "@/app/_components/ui/confirm";
import { toast } from "@/app/_components/ui/toast";
import { roleLabel } from "@/lib/app-brand";
import { APP_ROLES, type AppRole, type PermissionKey } from "@/lib/permission-definitions";

type PermissionDefinition = {
  key: PermissionKey;
  label: string;
  area: string;
};

type Props = {
  definitions: PermissionDefinition[];
  matrix: Record<AppRole, Record<PermissionKey, boolean>>;
};

const ROLE_LABEL: Record<AppRole, string> = {
  admin: roleLabel("admin"),
  officer: roleLabel("officer"),
  viewer: roleLabel("viewer"),
};

export function PermissionsMatrixClient({ definitions, matrix }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="glass-panel overflow-hidden rounded-2xl">
      <div className="border-b border-black/6 px-5 py-4">
        <h2 className="text-lg font-semibold">ตารางสิทธิ์ตามบทบาท</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          กำหนดสิทธิ์รายบทบาทและราย action ได้โดยตรง การเปลี่ยนแปลงมีผลทันที
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/6 text-xs text-[var(--muted)]">
              <th className="px-4 py-3 text-left font-medium">โมดูล / สิทธิ์</th>
              {APP_ROLES.map((role) => (
                <th key={role} className="px-4 py-3 text-center font-medium">{ROLE_LABEL[role]}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/4">
            {definitions.map((definition) => (
              <tr key={definition.key}>
                <td className="px-4 py-3 align-top">
                  <p className="text-[11px] font-medium text-[var(--muted)]">{definition.area}</p>
                  <p className="mt-1 font-medium text-[var(--foreground)]">{definition.label}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-[var(--muted)]">{definition.key}</p>
                </td>
                {APP_ROLES.map((role) => {
                  const checked = matrix[role][definition.key];
                  return (
                    <td key={role} className="px-4 py-3 text-center">
                      <button
                        type="button"
                        role="switch"
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            const form = new FormData();
                            form.set("role", role);
                            form.set("permission", definition.key);
                            form.set("isAllowed", checked ? "0" : "1");
                            const error = await updateRolePermissionAction(null, form);
                            if (error) await showError(error, "บันทึกสิทธิ์ไม่สำเร็จ");
                            else toast.success("บันทึกสิทธิ์แล้ว");
                          });
                        }}
                        aria-checked={checked}
                        aria-label={`${definition.label} สำหรับ ${ROLE_LABEL[role]}`}
                        title={checked ? "อนุญาต — กดเพื่อปิดสิทธิ์" : "ไม่อนุญาต — กดเพื่อเปิดสิทธิ์"}
                        className="group inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-xs font-medium text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span
                          aria-hidden="true"
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200 ${
                            checked ? "border-[var(--accent-strong)] bg-[var(--accent-strong)]" : "border-[var(--state-neutral-border)] bg-[var(--state-neutral-bg)]"
                          }`}
                        >
                          <span className={`absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`} />
                        </span>
                        <span className={`w-14 text-left ${checked ? "text-[var(--primary-text)]" : ""}`}>{checked ? "อนุญาต" : "ไม่อนุญาต"}</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
