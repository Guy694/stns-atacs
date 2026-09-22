#!/usr/bin/env bash
# Moves an installed ATACS Linux agent to a new server address without re-enrolling.
# Keeps agentId/agentKey, updates apiBaseUrl, installs the current agent script and sends one report.
# Usage (root):
#   base=https://atacs.example.go.th; curl -fsSL "$base/agent/linux/repoint-atacs-agent.sh" | sudo bash -s -- "$base"
set -euo pipefail

base="${1:-}"
base="${base%/}"
config_path="${ATACS_CONFIG_PATH:-/var/lib/atacs-agent/agent-config.json}"
agent_target="${ATACS_AGENT_PATH:-/opt/atacs-agent/atacs-agent.py}"

if [[ ! "$base" =~ ^https?:// ]]; then
  echo "usage: repoint-atacs-agent.sh https://new-server" >&2
  exit 1
fi
if [[ ! -f "$config_path" ]]; then
  echo "ไม่พบ $config_path — ใช้คำสั่งติดตั้งใหม่จากหน้า ดาวน์โหลด Agent แทน" >&2
  exit 1
fi

cp "$config_path" "${config_path}.bak"
python3 - "$config_path" "$base" <<'PY'
import json, sys
path, base = sys.argv[1], sys.argv[2]
with open(path, encoding="utf-8") as handle:
    config = json.load(handle)
print(f"apiBaseUrl: {config.get('apiBaseUrl')} -> {base}")
config["apiBaseUrl"] = base
with open(path, "w", encoding="utf-8") as handle:
    json.dump(config, handle, ensure_ascii=False, indent=2, sort_keys=True)
PY

download() { if command -v curl >/dev/null 2>&1; then curl -fsSL "$1" -o "$2"; else wget -qO "$2" "$1"; fi; }
download "$base/agent/linux/atacs-agent.py" "$agent_target"
chmod 755 "$agent_target"

if python3 "$agent_target" --config-path "$config_path"; then
  echo "ย้าย Agent ไปที่ $base เรียบร้อย"
else
  echo "ส่งข้อมูลไม่สำเร็จ ตรวจการเชื่อมต่อไปยัง $base (ค่าเดิมสำรองไว้ที่ ${config_path}.bak)" >&2
  exit 1
fi
