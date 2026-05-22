"use client";

import { useTransition } from "react";

import { updateRolePermissionAction } from "@/app/(main)/admin/settings/permissions/actions";
import { APP_ROLES, type AppRole, type PermissionKey } from "@/lib/role-permissions";

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
  admin: "Admin",
  officer: "Officer",
  viewer: "Viewer",
};

export function PermissionsMatrixClient({ definitions, matrix }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="glass-panel overflow-hidden rounded-2xl">
      <div className="border-b border-black/6 px-5 py-4">
        <h2 className="text-lg font-semibold">Permission Matrix</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          กำหนดสิทธิ์รายบทบาทและราย action ได้โดยตรง การเปลี่ยนแปลงมีผลทันที
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/6 bg-stone-50/70 text-xs text-[var(--muted)]">
              <th className="px-4 py-3 text-left font-medium">โมดูล / สิทธิ์</th>
              {APP_ROLES.map((role) => (
                <th key={role} className="px-4 py-3 text-center font-medium">{ROLE_LABEL[role]}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/4">
            {definitions.map((definition) => (
              <tr key={definition.key} className="transition hover:bg-white/50">
                <td className="px-4 py-3 align-top">
                  <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--muted)]">{definition.area}</p>
                  <p className="mt-1 font-medium text-[var(--foreground)]">{definition.label}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-[var(--muted)]">{definition.key}</p>
                </td>
                {APP_ROLES.map((role) => {
                  const checked = matrix[role][definition.key];
                  return (
                    <td key={role} className="px-4 py-3 text-center">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            const form = new FormData();
                            form.set("role", role);
                            form.set("permission", definition.key);
                            form.set("isAllowed", checked ? "0" : "1");
                            await updateRolePermissionAction(null, form);
                          });
                        }}
                        className={`inline-flex min-w-16 items-center justify-center rounded-full px-3 py-1 text-xs font-semibold transition ${
                          checked
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-stone-100 text-stone-500"
                        } disabled:opacity-50`}
                      >
                        {checked ? "Allow" : "Deny"}
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
