#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  install-atacs-agent.sh --api-base-url <url> --enrollment-token <token> [--install-root <path>]
  install-atacs-agent.sh --api-base-url <url> --install-key <key> --facility-id <id> [--work-group-name <name>] [--install-root <path>]

Installs the ATACS Linux agent, performs the first enrollment, and registers
an automatic refresh job with systemd or cron.
EOF
}

api_base_url=""
enrollment_token=""
facility_id=""
work_group_name=""
install_key=""
install_root="/opt/atacs-agent"
config_path="/var/lib/atacs-agent/agent-config.json"
agent_source="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/atacs-agent.py"
agent_target="${install_root}/atacs-agent.py"
service_name="atacs-agent"
service_file="/etc/systemd/system/${service_name}.service"
timer_file="/etc/systemd/system/${service_name}.timer"
cron_file="/etc/cron.d/${service_name}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-base-url)
      api_base_url="${2:-}"
      shift 2
      ;;
    --enrollment-token)
      enrollment_token="${2:-}"
      shift 2
      ;;
    --facility-id)
      facility_id="${2:-}"
      shift 2
      ;;
    --work-group-name)
      work_group_name="${2:-}"
      shift 2
      ;;
    --install-key)
      install_key="${2:-}"
      shift 2
      ;;
    --install-root)
      install_root="${2:-}"
      agent_target="${install_root}/atacs-agent.py"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$api_base_url" || ( -z "$enrollment_token" && ( -z "$install_key" || -z "$facility_id" ) ) ]]; then
  usage >&2
  exit 1
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this installer as root or with sudo." >&2
  exit 1
fi

if [[ ! -f "$agent_source" ]]; then
  echo "Cannot find atacs-agent.py next to the installer script." >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to run the Linux agent." >&2
  exit 1
fi

mkdir -p "$install_root" "$(dirname "$config_path")"
cp "$agent_source" "$agent_target"
chmod 755 "$agent_target"

chmod 700 "$(dirname "$config_path")"

echo "Running first enrollment and inventory report..."
enroll_args=(--api-base-url "$api_base_url" --config-path "$config_path" --run-once)
if [[ -n "$enrollment_token" ]]; then
  enroll_args+=(--enrollment-token "$enrollment_token")
else
  enroll_args+=(--install-key "$install_key" --facility-id "$facility_id")
  if [[ -n "$work_group_name" ]]; then
    enroll_args+=(--work-group-name "$work_group_name")
  fi
fi
python3 "$agent_target" "${enroll_args[@]}"

if command -v systemctl >/dev/null 2>&1; then
  cat > "$service_file" <<EOF
[Unit]
Description=ATACS Linux agent inventory collector
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/bin/env python3 ${agent_target} --config-path ${config_path} --run-once
User=root
Group=root
EOF

  cat > "$timer_file" <<EOF
[Unit]
Description=Run ATACS Linux agent every 4 hours

[Timer]
OnBootSec=5m
OnUnitActiveSec=4h
Persistent=true
Unit=${service_name}.service

[Install]
WantedBy=timers.target
EOF

  systemctl daemon-reload
  systemctl enable --now "${service_name}.timer"
  echo "Scheduled timer '${service_name}.timer' created successfully."
else
  cat > "$cron_file" <<EOF
SHELL=/bin/bash
PATH=/usr/sbin:/usr/bin:/sbin:/bin
0 */4 * * * root /usr/bin/env python3 ${agent_target} --config-path ${config_path} --run-once >/var/log/${service_name}.log 2>&1
EOF
  chmod 644 "$cron_file"
  echo "systemctl not found; installed cron fallback at ${cron_file}."
fi

echo "Install completed."
echo "Files stored in ${install_root}"
echo "Config file: ${config_path}"
