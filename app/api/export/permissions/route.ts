import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { hasPermission, getRolePermissionMatrix, PERMISSION_DEFINITIONS } from "@/lib/role-permissions";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allow = user.role === "admin" || (await hasPermission(user.role, "permissions.manage"));
  if (!allow) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const matrix = await getRolePermissionMatrix();

  return NextResponse.json(
    {
      exportedAt: new Date().toISOString(),
      exportedBy: user.fullName,
      definitions: PERMISSION_DEFINITIONS,
      matrix,
    },
    {
      headers: {
        "Content-Disposition": `attachment; filename=\"atacs-permissions-${new Date().toISOString().slice(0, 10)}.json\"`,
      },
    }
  );
}
