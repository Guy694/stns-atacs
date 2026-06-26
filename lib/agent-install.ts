export const AGENT_INSTALL_API_BASE_URL = "https://stns-atacs.vercel.app";
export const AGENT_INSTALL_KEY_PLACEHOLDER = "<INSTALL_KEY>";

function powerShellSingleQuote(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function shellSingleQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

type StaticInstallInput = {
  facilityId: number;
  workGroupName?: string | null;
  installKey?: string;
};

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

export function buildWindowsStaticAgentInstallCommand(input: StaticInstallInput) {
  const baseUrl = powerShellSingleQuote(AGENT_INSTALL_API_BASE_URL);
  const installKey = powerShellSingleQuote(input.installKey ?? AGENT_INSTALL_KEY_PLACEHOLDER);
  const workGroup = input.workGroupName?.trim() ? powerShellSingleQuote(input.workGroupName.trim()) : "''";

  return [
    "Set-ExecutionPolicy -Scope Process Bypass -Force",
    "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12",
    `$installKey=${installKey}`,
    `$facilityId=${input.facilityId}`,
    `$workGroup=${workGroup}`,
    `$base=${baseUrl}`,
    '$dir=Join-Path $env:TEMP "atacs-agent"',
    "New-Item -ItemType Directory -Force -Path $dir | Out-Null",
    'Invoke-WebRequest "$base/agent/windows/atacs-agent.ps1" -OutFile (Join-Path $dir "atacs-agent.ps1")',
    'Invoke-WebRequest "$base/agent/windows/install-atacs-agent.ps1" -OutFile (Join-Path $dir "install-atacs-agent.ps1")',
    'powershell -ExecutionPolicy Bypass -File (Join-Path $dir "install-atacs-agent.ps1") -ApiBaseUrl $base -InstallKey $installKey -FacilityId $facilityId -WorkGroupName $workGroup',
  ].join("; ");
}

export function buildLinuxAgentInstallCommand(enrollmentToken: string) {
  const baseUrl = shellSingleQuote(AGENT_INSTALL_API_BASE_URL);
  const token = shellSingleQuote(enrollmentToken);

  return [
    `token=${token}`,
    `base=${baseUrl}`,
    'dir="$(mktemp -d)"',
    'download() { if command -v curl >/dev/null 2>&1; then curl -fsSL "$1" -o "$2"; else wget -qO "$2" "$1"; fi; }',
    'download "$base/agent/linux/atacs-agent.py" "$dir/atacs-agent.py"',
    'download "$base/agent/linux/install-atacs-agent.sh" "$dir/install-atacs-agent.sh"',
    'sudo bash "$dir/install-atacs-agent.sh" --api-base-url "$base" --enrollment-token "$token"',
  ].join("; ");
}

export function buildLinuxStaticAgentInstallCommand(input: StaticInstallInput) {
  const baseUrl = shellSingleQuote(AGENT_INSTALL_API_BASE_URL);
  const installKey = shellSingleQuote(input.installKey ?? AGENT_INSTALL_KEY_PLACEHOLDER);
  const workGroup = input.workGroupName?.trim() ? shellSingleQuote(input.workGroupName.trim()) : "''";

  return [
    `install_key=${installKey}`,
    `facility_id=${input.facilityId}`,
    `work_group=${workGroup}`,
    `base=${baseUrl}`,
    'dir="$(mktemp -d)"',
    'download() { if command -v curl >/dev/null 2>&1; then curl -fsSL "$1" -o "$2"; else wget -qO "$2" "$1"; fi; }',
    'download "$base/agent/linux/atacs-agent.py" "$dir/atacs-agent.py"',
    'download "$base/agent/linux/install-atacs-agent.sh" "$dir/install-atacs-agent.sh"',
    'sudo bash "$dir/install-atacs-agent.sh" --api-base-url "$base" --install-key "$install_key" --facility-id "$facility_id" --work-group-name "$work_group"',
  ].join("; ");
}
