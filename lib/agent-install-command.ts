import "server-only";

import { buildLinuxAgentInstallCommand, buildWindowsAgentInstallCommand } from "@/lib/agent-install";
import type { InstallOs } from "@/lib/agent-install-token";

export * from "@/lib/agent-install-token";

export function parseInstallOs(value: unknown): InstallOs | null {
  return value === "windows" || value === "linux" ? value : null;
}

export function buildAgentInstallCommand(os: InstallOs, token: string) {
  return os === "linux" ? buildLinuxAgentInstallCommand(token) : buildWindowsAgentInstallCommand(token);
}
