#!/usr/bin/env python3
"""ATACS Linux agent.

Collects hardware inventory, enrolls a device on first run, and reports the
payload to the ATACS backend using the same API contract as the Windows agent.
"""

from __future__ import annotations

import argparse
import getpass
import hashlib
import json
import os
import platform
import shutil
import socket
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

AGENT_VERSION = "1.0.1"
DEFAULT_CONFIG_PATH = "/var/lib/atacs-agent/agent-config.json"


def read_text_file(path: str) -> str | None:
    try:
        value = Path(path).read_text(encoding="utf-8", errors="ignore").strip()
        return value or None
    except OSError:
        return None


def run_command(*args: str) -> str | None:
    try:
        output = subprocess.check_output(args, stderr=subprocess.DEVNULL, text=True)
    except (OSError, subprocess.CalledProcessError):
        return None
    return output.strip() or None


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def normalize(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def ensure_dir_for_file(path: str) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)


def load_config(path: str) -> dict[str, Any] | None:
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError:
        return None
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid config file: {path}") from exc


def save_config(path: str, config: dict[str, Any]) -> None:
    ensure_dir_for_file(path)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(config, handle, ensure_ascii=False, indent=2, sort_keys=True)
        handle.write("\n")


def get_machine_id() -> str | None:
    return read_text_file("/etc/machine-id") or read_text_file("/var/lib/dbus/machine-id")


def get_bios_uuid() -> str | None:
    return read_text_file("/sys/class/dmi/id/product_uuid")


def get_bios_serial() -> str | None:
    return read_text_file("/sys/class/dmi/id/product_serial") or read_text_file("/sys/class/dmi/id/board_serial")


def get_primary_mac() -> str | None:
    for net_path in sorted(Path("/sys/class/net").glob("*")):
        name = net_path.name
        if name == "lo":
            continue
        address = read_text_file(str(net_path / "address"))
        if address and address != "00:00:00:00:00:00":
            return address.upper()
    return None


def get_primary_ipv4() -> str | None:
    route = run_command("ip", "-4", "route", "get", "1.1.1.1")
    if route:
        tokens = route.split()
        if "src" in tokens:
            index = tokens.index("src")
            if index + 1 < len(tokens):
                return tokens[index + 1]

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            return sock.getsockname()[0]
    except OSError:
        return None


def get_os_name() -> str:
    os_release = read_text_file("/etc/os-release") or ""
    values: dict[str, str] = {}
    for line in os_release.splitlines():
        if "=" not in line:
            continue
        key, raw_value = line.split("=", 1)
        values[key.strip()] = raw_value.strip().strip('"')
    name = values.get("PRETTY_NAME") or values.get("NAME")
    if name:
        return name
    return platform.platform()


def get_cpu_model() -> str | None:
    cpuinfo = read_text_file("/proc/cpuinfo") or ""
    for line in cpuinfo.splitlines():
        if line.lower().startswith("model name") and ":" in line:
            return line.split(":", 1)[1].strip()
    return run_command("lscpu")


def get_ram_mb() -> int | None:
    meminfo = read_text_file("/proc/meminfo") or ""
    for line in meminfo.splitlines():
        if line.startswith("MemTotal:"):
            parts = line.split()
            if len(parts) >= 2:
                try:
                    kib = int(parts[1])
                    return round(kib / 1024)
                except ValueError:
                    return None
    return None


def get_disk_usage_gb() -> dict[str, int | None]:
    try:
        usage = shutil.disk_usage("/")
    except OSError:
        return {"total": None, "free": None, "used": None}
    return {
        "total": round(usage.total / (1024**3)),
        "free": round(usage.free / (1024**3)),
        "used": round(usage.used / (1024**3)),
    }


def get_device_type() -> str:
    chassis_type = read_text_file("/sys/class/dmi/id/chassis_type")
    if chassis_type in {"8", "9", "10", "14"}:
        return "Laptop"
    if chassis_type in {"3", "4", "5", "6", "7", "15", "16", "17", "21", "22", "23"}:
        return "Desktop"
    return "Computer"


def get_current_user() -> str | None:
    for env_name in ("SUDO_USER", "LOGNAME", "USER", "USERNAME"):
        value = os.environ.get(env_name)
        if value:
            return value
    try:
        return getpass.getuser()
    except Exception:
        return None


def get_hostname() -> str:
    return socket.gethostname().strip() or platform.node().strip() or "unknown-host"


def get_fingerprint() -> str:
    components = [
        get_machine_id(),
        get_bios_uuid(),
        get_bios_serial(),
        get_primary_mac(),
        get_hostname(),
    ]
    return sha256_hex("|".join(component or "" for component in components))


def get_inventory_payload() -> dict[str, Any]:
    hostname = get_hostname()
    serial_number = get_bios_serial()
    bios_serial = get_bios_serial()
    private_ip = get_primary_ipv4()
    mac_address = get_primary_mac()
    os_name = get_os_name()
    cpu_model = get_cpu_model()
    current_user = get_current_user()
    disk_usage = get_disk_usage_gb()

    return {
        "fingerprint": get_fingerprint(),
        "hostname": hostname,
        "serialNumber": serial_number,
        "biosSerial": bios_serial,
        "deviceType": get_device_type(),
        "manufacturerBrand": None,
        "manufacturerModel": None,
        "operatingSystem": os_name,
        "operatingSystemVersion": platform.release(),
        "privateIp": private_ip,
        "macAddress": mac_address,
        "currentUser": current_user,
        "cpuModel": cpu_model,
        "ramMb": get_ram_mb(),
        "diskTotalGb": disk_usage["total"],
        "diskFreeGb": disk_usage["free"],
        "diskUsedGb": disk_usage["used"],
        "locationDetail": hostname,
        "agentVersion": AGENT_VERSION,
        "status": "online",
        "collectedAt": time_iso(),
    }


def time_iso() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def post_json(url: str, body: dict[str, Any], headers: dict[str, str] | None = None) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", **(headers or {})},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = response.read().decode("utf-8")
            return json.loads(payload) if payload else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"HTTP {exc.code}: {detail or exc.reason}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Request failed: {exc.reason}") from exc


def enroll_agent(
    base_url: str,
    token: str | None,
    config_path: str,
    facility_id: int | None = None,
    work_group_id: int | None = None,
    work_group_name: str | None = None,
    install_key: str | None = None,
) -> dict[str, Any]:
    if not base_url:
        raise RuntimeError("ApiBaseUrl is required for enrollment.")
    has_token = bool(token)
    has_static_install = bool(install_key) and bool(facility_id)
    if not has_token and not has_static_install:
        raise RuntimeError("EnrollmentToken or InstallKey + FacilityId is required for enrollment.")

    payload = get_inventory_payload()
    body = {
        "fingerprint": payload["fingerprint"],
        "hostname": payload["hostname"],
        "agentVersion": payload["agentVersion"],
    }
    if has_token:
        body["enrollmentToken"] = token
    else:
        body["installKey"] = install_key
        body["facilityId"] = facility_id
        if work_group_id:
            body["workGroupId"] = work_group_id
        elif work_group_name:
            body["workGroupName"] = work_group_name

    response = post_json(
        f"{base_url.rstrip('/')}/api/agent/enroll",
        body,
    )

    config = {
        "apiBaseUrl": base_url.rstrip("/"),
        "facilityId": response["facilityId"],
        "facilityName": response["facilityName"],
        "agentId": response["agentId"],
        "agentKey": response["agentKey"],
        "deviceId": response["deviceId"],
        "enrolledAt": time_iso(),
    }
    save_config(config_path, config)
    return config


def send_inventory(config: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    headers = {
        "x-agent-id": str(config["agentId"]),
        "x-agent-key": str(config["agentKey"]),
    }
    return post_json(f"{str(config['apiBaseUrl']).rstrip('/')}/api/agent/report", payload, headers=headers)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="ATACS Linux agent")
    parser.add_argument("--api-base-url", dest="api_base_url")
    parser.add_argument("--enrollment-token", dest="enrollment_token")
    parser.add_argument("--facility-id", dest="facility_id", type=int)
    parser.add_argument("--work-group-id", dest="work_group_id", type=int)
    parser.add_argument("--work-group-name", dest="work_group_name")
    parser.add_argument("--install-key", dest="install_key")
    parser.add_argument("--config-path", dest="config_path", default=DEFAULT_CONFIG_PATH)
    parser.add_argument("--run-once", action="store_true")
    parser.add_argument("--enroll-only", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config = load_config(args.config_path)

    if not config:
        has_token = bool(args.enrollment_token)
        has_static_install = bool(args.install_key) and bool(args.facility_id)
        if not args.api_base_url or (not has_token and not has_static_install):
            print(
                "Enrollment requires --api-base-url and either --enrollment-token or --install-key + --facility-id on first run.",
                file=sys.stderr,
            )
            return 1
        config = enroll_agent(
            args.api_base_url,
            args.enrollment_token,
            args.config_path,
            args.facility_id,
            args.work_group_id,
            args.work_group_name,
            args.install_key,
        )
        print(f"Enrolled device for facility: {config['facilityName']}")

    if args.enroll_only:
        print(f"Enrollment completed. Config saved to {args.config_path}")
        return 0

    payload = get_inventory_payload()
    result = send_inventory(config, payload)
    print(
        f"Inventory report sent successfully. DeviceId={result.get('deviceId')} "
        f"AssetId={result.get('linkedAssetId')}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
