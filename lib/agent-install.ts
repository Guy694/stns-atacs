export const AGENT_INSTALL_API_BASE_URL = "https://stns-atacs.vercel.app";

function powerShellSingleQuote(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

export function buildWindowsAgentInstallCommand(enrollmentToken: string) {
  const baseUrl = powerShellSingleQuote(AGENT_INSTALL_API_BASE_URL);
  const token = powerShellSingleQuote(enrollmentToken);

  return [
    "Set-ExecutionPolicy -Scope Process Bypass -Force",
    "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12",
    `$token=${token}`,
    `$base=${baseUrl}`,
    '$dir=Join-Path $env:TEMP "atacs-agent"',
    "New-Item -ItemType Directory -Force -Path $dir | Out-Null",
    'Invoke-WebRequest "$base/agent/windows/atacs-agent.ps1" -OutFile (Join-Path $dir "atacs-agent.ps1")',
    'Invoke-WebRequest "$base/agent/windows/install-atacs-agent.ps1" -OutFile (Join-Path $dir "install-atacs-agent.ps1")',
    'powershell -ExecutionPolicy Bypass -File (Join-Path $dir "install-atacs-agent.ps1") -ApiBaseUrl $base -EnrollmentToken $token',
  ].join("; ");
}
