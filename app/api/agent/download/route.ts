import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ALLOWED_FILES: Record<string, { path: string; filename: string; contentType: string }> = {
  "windows-agent": {
    path: "scripts/agent/windows/atacs-agent.ps1",
    filename: "atacs-agent.ps1",
    contentType: "text/plain; charset=utf-8",
  },
  "windows-installer": {
    path: "scripts/agent/windows/install-atacs-agent.ps1",
    filename: "install-atacs-agent.ps1",
    contentType: "text/plain; charset=utf-8",
  },
  "linux-agent": {
    path: "scripts/agent/linux/atacs-agent.py",
    filename: "atacs-agent.py",
    contentType: "text/plain; charset=utf-8",
  },
  "linux-installer": {
    path: "scripts/agent/linux/install-atacs-agent.sh",
    filename: "install-atacs-agent.sh",
    contentType: "text/plain; charset=utf-8",
  },
};

export async function GET(req: NextRequest) {
  const file = req.nextUrl.searchParams.get("file") ?? "";
  const entry = ALLOWED_FILES[file];

  if (!entry) {
    return NextResponse.json({ error: "Unknown file" }, { status: 404 });
  }

  const fullPath = join(process.cwd(), entry.path);

  let content: Buffer;
  try {
    content = await readFile(fullPath);
  } catch {
    return NextResponse.json({ error: "File not found on server" }, { status: 404 });
  }

  return new NextResponse(content as unknown as BodyInit, {
    headers: {
      "Content-Type": entry.contentType,
      "Content-Disposition": `attachment; filename="${entry.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
