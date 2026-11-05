#!/usr/bin/env bash
# ATACS Linux agent: manual uninstall (works for every agent version).
# Removes the systemd timer/service (or the cron fallback), the config with the agent key,
# and the install directory created by install-atacs-agent.sh.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  sudo bash uninstall-atacs-agent.sh [--notify-server] [--install-root <path>] [--config-path <path>]

  --notify-server   If the config still exists, tell the ATACS server first so the device shows
                    "uninstalled" and its key is revoked. A failed notification does not stop the uninstall.
EOF
}

notify_server=0
install_root="/opt/atacs-agent"
config_path="/var/lib/atacs-agent/agent-config.json"
service_name="atacs-agent"
systemd_dir="${ATACS_SYSTEMD_DIR:-/etc/systemd/system}"
cron_file="${ATACS_CRON_FILE:-/etc/cron.d/${service_name}}"
cron_log_file="${ATACS_CRON_LOG_FILE:-/var/log/${service_name}.log}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --notify-server)
      notify_server=1
      shift
      ;;
    --install-root)
      install_root="${2:-}"
      shift 2
      ;;
    --config-path)
      config_path="${2:-}"
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

if [[ "$(id -u)" -ne 0 && -z "${ATACS_UNINSTALL_ALLOW_NON_ROOT:-}" ]]; then
  echo "Run this uninstaller as root or with sudo." >&2
  exit 1
fi

removed() { echo "Removed: $1"; }

remove_path() {
  if [[ -e "$1" || -L "$1" ]]; then
    rm -f -- "$1" && removed "$1"
  fi
}

if [[ "$notify_server" -eq 1 && -f "$config_path" ]]; then
  if command -v python3 >/dev/null 2>&1; then
    echo "Notifying the ATACS server..."
    # Reads apiBaseUrl/agentId/agentKey from the config; https only (http only for localhost).
    if ! python3 - "$config_path" <<'PY'
import json, sys, urllib.parse, urllib.request
config = json.load(open(sys.argv[1], encoding="utf-8"))
base = str(config.get("apiBaseUrl") or "").rstrip("/")
parsed = urllib.parse.urlparse(base)
if not (parsed.scheme == "https" or (parsed.scheme == "http" and parsed.hostname in ("localhost", "127.0.0.1"))):
    sys.exit("refusing to notify a non-https server: " + base)
request = urllib.request.Request(
    base + "/api/agent/uninstalled/",
    data=json.dumps({"reason": "manual"}).encode("utf-8"),
    headers={"Content-Type": "application/json", "x-agent-id": str(config.get("agentId") or ""), "x-agent-key": str(config.get("agentKey") or "")},
    method="POST",
)
with urllib.request.urlopen(request, timeout=30) as response:
    print("Server notified: HTTP {}".format(response.getcode()))
PY
    then
      echo "Warning: could not notify the server; continuing. Use \"ลบออกจากระบบ\" in ATACS if the device still shows as installed." >&2
    fi
  else
    echo "Warning: python3 not found; skipping server notification." >&2
  fi
fi

# Secrets first: the config holds the agent key.
remove_path "$config_path"
config_dir="$(dirname "$config_path")"
if [[ "$(basename "$config_dir")" == "$service_name" && -d "$config_dir" ]]; then
  rm -rf -- "$config_dir" && removed "$config_dir"
fi

if command -v systemctl >/dev/null 2>&1; then
  systemctl disable --now "${service_name}.timer" >/dev/null 2>&1 || true
  systemctl stop "${service_name}.service" >/dev/null 2>&1 || true
  echo "Stopped and disabled ${service_name}.timer"
fi
for unit in "${service_name}.timer" "${service_name}.service"; do
  remove_path "${systemd_dir}/${unit}"
  remove_path "${systemd_dir}/timers.target.wants/${unit}"
done
if command -v systemctl >/dev/null 2>&1; then
  systemctl daemon-reload >/dev/null 2>&1 || true
  systemctl reset-failed "${service_name}.service" >/dev/null 2>&1 || true
fi

remove_path "$cron_file"
remove_path "$cron_log_file"

case "$(cd "$install_root" 2>/dev/null && pwd -P || echo "$install_root")" in
  /|/opt|/usr|/usr/local|/var|/var/lib|/etc|/home|/root|/tmp|/bin|/sbin|/lib)
    echo "Refusing to remove ${install_root}" >&2
    ;;
  *)
    if [[ -d "$install_root" ]]; then
      if [[ "$(basename "$install_root")" == "$service_name" ]]; then
        rm -rf -- "$install_root" && removed "$install_root"
      else
        # Custom --install-root: remove only the agent's files, and the directory when it is then empty.
        rm -f -- "$install_root/atacs-agent.py" "$install_root/atacs-agent.py.bak" "$install_root/update.log" "$install_root"/.atacs-agent-update-*
        rmdir -- "$install_root" 2>/dev/null && removed "$install_root" || echo "Kept ${install_root} (not empty)"
      fi
    fi
    ;;
esac

echo "ATACS agent uninstall completed."
