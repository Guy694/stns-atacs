import { NextRequest, NextResponse } from "next/server";

const FILE_TO_STATIC_PATH: Record<string, string> = {
  "windows-agent": "/agent/windows/atacs-agent.ps1",
  "windows-installer": "/agent/windows/install-atacs-agent.ps1",
  "linux-agent": "/agent/linux/atacs-agent.py",
  "linux-installer": "/agent/linux/install-atacs-agent.sh",
};

export async function GET(req: NextRequest) {
  const file = req.nextUrl.searchParams.get("file") ?? "";
  const staticPath = FILE_TO_STATIC_PATH[file];

  if (!staticPath) {
    return NextResponse.json({ error: "Unknown file" }, { status: 404 });
  }

  const downloadUrl = new URL(staticPath, req.nextUrl.origin);
  return NextResponse.redirect(downloadUrl, { status: 307 });
}
