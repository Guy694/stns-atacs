#!/usr/bin/env python3
"""ATACS Linux agent.

Collects hardware inventory, enrolls a device on first run, and reports the
payload to the ATACS backend using the same API contract as the Windows agent.

Compatible with Python 3.6+ (CentOS/RHEL 7-8, Ubuntu 18.04): no PEP 585/604
annotations, no dataclasses, no walrus, subprocess uses universal_newlines.
"""

import argparse
import re
import time
import getpass
import hashlib
import json
import os
import platform
import shutil
import socket
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

AGENT_VERSION = "2.2.0"
DEFAULT_CONFIG_PATH = "/var/lib/atacs-agent/agent-config.json"
# Self-update (2.2.0+): the running script replaces itself after a verified download.
AGENT_CAPABILITIES = ["self-update", "self-uninstall"]
UPDATE_MAX_BYTES = 2 * 1024 * 1024
UPDATE_TIMEOUT_SECONDS = 60
# Remote uninstall (2.2.0+): the unit/cron names and paths created by install-atacs-agent.sh.
SERVICE_NAME = "atacs-agent"
SYSTEMD_UNIT_DIR = "/etc/systemd/system"
CRON_FILE = "/etc/cron.d/atacs-agent"
CRON_LOG_FILE = "/var/log/atacs-agent.log"


def read_text_file(path: str) -> Optional[str]:
    try:
        value = Path(path).read_text(encoding="utf-8", errors="ignore").strip()
        return value or None
    except OSError:
        return None


def run_command(*args: str) -> Optional[str]:
    try:
        output = subprocess.check_output(args, stderr=subprocess.DEVNULL, universal_newlines=True)
    except (OSError, subprocess.CalledProcessError):
        return None
    return output.strip() or None


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def normalize(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


# SEC-06: the server can announce a new address, but the agent only follows it when the host is
# on this allowlist (or is the host it already reports to). Plain http is never accepted, so a
# stolen old deployment cannot redirect every agent to an attacker-controlled server.
ALLOWED_API_HOST_SUFFIXES = (
    ".moph.go.th",
)


def api_base_allowed(new_base: str, current_base: str) -> bool:
    try:
        parsed = urllib.parse.urlparse(new_base)
    except ValueError:
        return False
    if parsed.scheme != "https" or not parsed.hostname:
        return False
    host = parsed.hostname.lower()
    try:
        current_host = (urllib.parse.urlparse(current_base).hostname or "").lower()
    except ValueError:
        current_host = ""
    if current_host and host == current_host:
        return True
    return any(host == suffix.lstrip(".") or host.endswith(suffix) for suffix in ALLOWED_API_HOST_SUFFIXES)


def update_url_allowed(url: str, current_base: str) -> bool:
    """Update downloads reuse the SEC-06 allowlist (https + current host or allow-listed host).
    Plain http is accepted only for a localhost development server the agent already reports to."""
    try:
        parsed = urllib.parse.urlparse(url)
        current_host = (urllib.parse.urlparse(current_base or "").hostname or "").lower()
    except ValueError:
        return False
    if parsed.scheme == "http":
        host = (parsed.hostname or "").lower()
        return host in ("localhost", "127.0.0.1") and host == current_host
    return api_base_allowed(url, current_base)


def version_tuple(value: Any) -> tuple:
    parts = []
    for part in str(value or "").split(".")[:3]:
        match = re.match(r"\d+", part)
        parts.append(int(match.group(0)) if match else 0)
    while len(parts) < 3:
        parts.append(0)
    return tuple(parts)


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[override]
        return None


def download_limited(url: str, max_bytes: int, timeout: int) -> bytes:
    """Download with a hard size cap, an overall deadline and no redirects."""
    opener = urllib.request.build_opener(_NoRedirect)
    request = urllib.request.Request(url, headers={"User-Agent": "ATACS-Agent/" + AGENT_VERSION})
    deadline = time.time() + timeout
    chunks = []  # type: List[bytes]
    total = 0
    try:
        with opener.open(request, timeout=timeout) as response:
            if response.getcode() != 200:
                raise RuntimeError("HTTP {} from {}".format(response.getcode(), url))
            declared = response.headers.get("Content-Length")
            if declared and declared.isdigit() and int(declared) > max_bytes:
                raise RuntimeError("download is larger than {} bytes".format(max_bytes))
            while True:
                chunk = response.read(65536)
                if not chunk:
                    break
                total += len(chunk)
                if total > max_bytes:
                    raise RuntimeError("download is larger than {} bytes".format(max_bytes))
                if time.time() > deadline:
                    raise RuntimeError("download timed out after {} seconds".format(timeout))
                chunks.append(chunk)
    except urllib.error.HTTPError as exc:
        raise RuntimeError("HTTP {} from {}".format(exc.code, url)) from exc
    except urllib.error.URLError as exc:
        raise RuntimeError("download failed: {}".format(exc.reason)) from exc
    return b"".join(chunks)


def update_log(message: str, directory: Optional[str] = None) -> None:
    print("Agent update: {}".format(message))
    if not directory:
        return
    log_path = os.path.join(directory, "update.log")
    try:
        if os.path.exists(log_path) and os.path.getsize(log_path) > 256 * 1024:
            os.remove(log_path)
        with open(log_path, "a", encoding="utf-8") as handle:
            handle.write("{} {}\n".format(time_iso(), message))
    except OSError:
        pass


def self_update(update: Any, current_base: str, target: Optional[str] = None, downloader: Any = None) -> bool:
    """Replace this script with a verified newer version. Never raises: an update problem must not
    fail the inventory run. At most one attempt per run; the next scheduled run starts the new script.
    Manual rollback: cp /opt/atacs-agent/atacs-agent.py.bak /opt/atacs-agent/atacs-agent.py"""
    target_path = os.path.realpath(target or os.path.abspath(__file__))
    directory = os.path.dirname(target_path)
    temp_path = None  # type: Optional[str]
    try:
        if not isinstance(update, dict):
            update_log("refused: invalid update info", directory)
            return False
        version = str(update.get("version") or "")
        url = str(update.get("url") or "")
        expected_hash = str(update.get("sha256") or "").strip().lower()
        try:
            size = int(update.get("size") or 0)
        except (TypeError, ValueError):
            size = 0
        if not re.match(r"^\d+\.\d+\.\d+$", version):
            update_log("refused: invalid version {!r}".format(version), directory)
            return False
        if version_tuple(version) <= version_tuple(AGENT_VERSION):
            update_log("skipped: {} is not newer than {}".format(version, AGENT_VERSION), directory)
            return False
        if not re.match(r"^[0-9a-f]{64}$", expected_hash):
            update_log("refused: invalid sha256", directory)
            return False
        if size <= 0 or size > UPDATE_MAX_BYTES:
            update_log("refused: invalid size {}".format(size), directory)
            return False
        if not update_url_allowed(url, current_base):
            update_log("refused: download host is not allowed ({})".format(url), directory)
            return False

        body = (downloader or download_limited)(url, UPDATE_MAX_BYTES, UPDATE_TIMEOUT_SECONDS)
        if len(body) != size:
            raise RuntimeError("size mismatch: expected {} bytes, got {}".format(size, len(body)))
        actual_hash = hashlib.sha256(body).hexdigest()
        if actual_hash != expected_hash:
            raise RuntimeError("SHA-256 mismatch: expected {}, got {}".format(expected_hash, actual_hash))
        text = body.decode("utf-8")
        if not re.search(r'^AGENT_VERSION = "{}"$'.format(re.escape(version)), text, re.MULTILINE):
            raise RuntimeError("downloaded script does not declare version {}".format(version))
        # Refuse a script this interpreter cannot even compile (e.g. syntax newer than Python 3.6).
        compile(text, target_path, "exec")

        fd, temp_path = tempfile.mkstemp(prefix=".atacs-agent-update-", dir=directory)
        with os.fdopen(fd, "wb") as handle:
            handle.write(body)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temp_path, 0o755)
        if hasattr(os, "geteuid") and os.geteuid() == 0:
            os.chown(temp_path, 0, 0)
        shutil.copy2(target_path, target_path + ".bak")
        os.replace(temp_path, target_path)
        temp_path = None
        update_log(
            "updated {} -> {} (backup: {}.bak); the next scheduled run uses the new version".format(
                AGENT_VERSION, version, target_path
            ),
            directory,
        )
        return True
    except Exception as exc:  # noqa: BLE001 - never fail the report run because of an update
        update_log("failed: {}".format(exc), directory)
        return False
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except OSError:
                pass


def uninstall_log(message: str, directory: Optional[str] = None) -> None:
    print("Agent uninstall: {}".format(message))
    if not directory or not os.path.isdir(directory):
        return
    try:
        with open(os.path.join(directory, "update.log"), "a", encoding="utf-8") as handle:
            handle.write("{} uninstall: {}\n".format(time_iso(), message))
    except OSError:
        pass


def server_trusted_for_uninstall(base: str) -> bool:
    """Only an answer from the configured server over https (http only for a localhost dev server)
    may remove the agent. Same SEC-06 rules as updates."""
    return bool(base) and update_url_allowed(base, base)


def safe_install_dir(path: str) -> bool:
    """Never delete / or a shared system directory, and only a directory that holds the agent script."""
    if not path:
        return False
    real = os.path.realpath(path)
    if real in ("/", "/opt", "/usr", "/usr/local", "/var", "/var/lib", "/etc", "/home", "/root", "/tmp", "/bin", "/sbin", "/lib"):
        return False
    return os.path.isfile(os.path.join(real, "atacs-agent.py"))


def confirm_uninstalled(config: Dict[str, Any], reason: str = "remote", poster: Any = None) -> bool:
    """POST /api/agent/uninstalled/ with this machine's credentials; True only for {ok: true, uninstalled: true}."""
    headers = {"x-agent-id": str(config.get("agentId") or ""), "x-agent-key": str(config.get("agentKey") or "")}
    url = "{}/api/agent/uninstalled/".format(str(config.get("apiBaseUrl") or "").rstrip("/"))
    response = (poster or post_json)(url, {"reason": reason, "agentVersion": AGENT_VERSION}, headers)
    return isinstance(response, dict) and response.get("ok") is True and response.get("uninstalled") is True


def _remove_file(path: str, directory: Optional[str], removed: List[str]) -> None:
    try:
        if os.path.lexists(path):
            os.unlink(path)
            removed.append(path)
            uninstall_log("removed {}".format(path), directory)
    except OSError as exc:
        uninstall_log("could not remove {}: {}".format(path, exc), directory)


def remove_installation(
    install_dir: str,
    config_path: str,
    systemd_dir: str = SYSTEMD_UNIT_DIR,
    cron_file: str = CRON_FILE,
    cron_log_file: str = CRON_LOG_FILE,
) -> List[str]:
    """Stop/disable the timer, remove units, cron entry, config (agent key) and the install directory.
    The running oneshot service is not stopped (that would kill this process); its unit file is removed
    and systemd forgets it after daemon-reload. Returns what was removed."""
    removed = []  # type: List[str]
    install_dir = os.path.realpath(install_dir)
    uninstall_log("removing ATACS Agent from {}".format(install_dir), install_dir)

    # Secrets first: the config holds the agent key.
    _remove_file(config_path, install_dir, removed)
    config_dir = os.path.dirname(os.path.realpath(config_path))
    if os.path.basename(config_dir) == SERVICE_NAME:
        shutil.rmtree(config_dir, ignore_errors=True)
        if not os.path.exists(config_dir):
            removed.append(config_dir)
            uninstall_log("removed {}".format(config_dir), install_dir)

    timer = "{}.timer".format(SERVICE_NAME)
    service = "{}.service".format(SERVICE_NAME)
    if shutil.which("systemctl"):
        for args in (["disable", "--now", timer], ["stop", timer]):
            try:
                subprocess.run(["systemctl"] + args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60)
            except (OSError, subprocess.SubprocessError) as exc:
                uninstall_log("systemctl {} failed: {}".format(" ".join(args), exc), install_dir)
        uninstall_log("stopped and disabled {}".format(timer), install_dir)
    for unit in (timer, service):
        _remove_file(os.path.join(systemd_dir, unit), install_dir, removed)
        _remove_file(os.path.join(systemd_dir, "timers.target.wants", unit), install_dir, removed)
    if shutil.which("systemctl"):
        try:
            subprocess.run(["systemctl", "daemon-reload"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60)
            subprocess.run(["systemctl", "reset-failed", service], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60)
        except (OSError, subprocess.SubprocessError) as exc:
            uninstall_log("systemctl daemon-reload failed: {}".format(exc), install_dir)

    _remove_file(cron_file, install_dir, removed)
    _remove_file(cron_log_file, install_dir, removed)

    if safe_install_dir(install_dir):
        if os.path.basename(install_dir) == SERVICE_NAME:
            uninstall_log("removing directory {}".format(install_dir), install_dir)
            shutil.rmtree(install_dir, ignore_errors=True)
        else:
            # Custom --install-root: remove only our files, and the directory only when it is then empty.
            for name in ("atacs-agent.py", "atacs-agent.py.bak", "update.log"):
                path = os.path.join(install_dir, name)
                if os.path.lexists(path):
                    try:
                        os.unlink(path)
                    except OSError:
                        pass
            for name in os.listdir(install_dir) if os.path.isdir(install_dir) else []:
                if name.startswith(".atacs-agent-update-"):
                    try:
                        os.unlink(os.path.join(install_dir, name))
                    except OSError:
                        pass
            try:
                os.rmdir(install_dir)
            except OSError:
                pass
        if not os.path.exists(install_dir):
            removed.append(install_dir)
            print("Agent uninstall: removed {}".format(install_dir))
    else:
        uninstall_log("left {} in place (not an agent install directory)".format(install_dir), install_dir)
    print("Agent uninstall: completed")
    return removed


def self_uninstall(
    uninstall: Any,
    config: Dict[str, Any],
    config_path: str,
    install_dir: Optional[str] = None,
    poster: Any = None,
    remover: Any = None,
    trigger: str = "instruction",
) -> bool:
    """Confirm with the server, then remove this agent. Never raises. Nothing is removed unless the
    configured https server confirmed; a failed confirmation is retried on the next scheduled run."""
    directory = os.path.realpath(install_dir or os.path.dirname(os.path.abspath(__file__)))
    try:
        requested_at = str(uninstall.get("requestedAt") or "") if isinstance(uninstall, dict) else ""
        if trigger == "instruction" and not requested_at.strip():
            uninstall_log("refused: invalid uninstall instruction", directory)
            return False
        base = str(config.get("apiBaseUrl") or "").rstrip("/")
        if not server_trusted_for_uninstall(base):
            uninstall_log("refused: server address is not https ({})".format(base), directory)
            return False
        if not safe_install_dir(directory):
            uninstall_log("refused: unexpected install directory {}".format(directory), directory)
            return False
        if trigger == "instruction":
            uninstall_log("requested by the administrator at {}; confirming with {}".format(requested_at, base), directory)
        else:
            uninstall_log("server rejected this agent; checking whether the uninstall was already recorded", directory)
        try:
            confirmed = confirm_uninstalled(config, "remote", poster)
        except Exception as exc:  # noqa: BLE001 - keep the agent installed and retry next run
            uninstall_log("confirmation failed: {}; nothing was removed, will retry next run".format(exc), directory)
            return False
        if not confirmed:
            uninstall_log("server did not confirm; nothing was removed", directory)
            return False
        (remover or remove_installation)(directory, config_path)
        return True
    except Exception as exc:  # noqa: BLE001 - never fail the run because of the uninstall step
        uninstall_log("failed: {}".format(exc), directory)
        return False


def ensure_dir_for_file(path: str) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)


def load_config(path: str) -> Optional[Dict[str, Any]]:
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError:
        return None
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid config file: {path}") from exc


def save_config(path: str, config: Dict[str, Any]) -> None:
    ensure_dir_for_file(path)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(config, handle, ensure_ascii=False, indent=2, sort_keys=True)
        handle.write("\n")


def get_machine_id() -> Optional[str]:
    return read_text_file("/etc/machine-id") or read_text_file("/var/lib/dbus/machine-id")


def get_bios_uuid() -> Optional[str]:
    return read_text_file("/sys/class/dmi/id/product_uuid")


JUNK_SERIAL = re.compile(
    r"^(to be filled.*|default string|system serial number|chassis serial number|base ?board serial number|serial ?number|"
    r"not specified|not applicable|not available|none|null|n/?a|unknown|invalid|o\.?e\.?m\.?|oem|123456789|1234567890|"
    r"0123456789|[0x.\- _]+|f{8,}|[*#?]+)$",
    re.IGNORECASE,
)


def clean_serial(value: Optional[str]) -> Optional[str]:
    text = normalize(value)
    if not text or len(text) < 3 or JUNK_SERIAL.match(text):
        return None
    return text


def get_bios_serial() -> Optional[str]:
    return clean_serial(read_text_file("/sys/class/dmi/id/product_serial")) or clean_serial(
        read_text_file("/sys/class/dmi/id/board_serial")
    )


def get_primary_mac() -> Optional[str]:
    for net_path in sorted(Path("/sys/class/net").glob("*")):
        name = net_path.name
        if name == "lo":
            continue
        address = read_text_file(str(net_path / "address"))
        if address and address != "00:00:00:00:00:00":
            return address.upper()
    return None


def get_primary_ipv4() -> Optional[str]:
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
    values: Dict[str, str] = {}
    for line in os_release.splitlines():
        if "=" not in line:
            continue
        key, raw_value = line.split("=", 1)
        values[key.strip()] = raw_value.strip().strip('"')
    name = values.get("PRETTY_NAME") or values.get("NAME")
    if name:
        return name
    return platform.platform()


def get_cpu_model() -> Optional[str]:
    cpuinfo = read_text_file("/proc/cpuinfo") or ""
    for line in cpuinfo.splitlines():
        if line.lower().startswith("model name") and ":" in line:
            return line.split(":", 1)[1].strip() or None
    # ARM / some VMs have no "model name" in /proc/cpuinfo: take the single "Model name" line from
    # lscpu (never the whole multi-line output, which would end up in the asset specification).
    for line in (run_command("lscpu") or "").splitlines():
        if line.lower().startswith("model name") and ":" in line:
            return line.split(":", 1)[1].strip() or None
    for line in cpuinfo.splitlines():
        if line.lower().startswith(("hardware", "processor")) and ":" in line:
            value = line.split(":", 1)[1].strip()
            if value and not value.isdigit():
                return value
    return None


def get_ram_mb() -> Optional[int]:
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


def get_disk_usage_gb() -> Dict[str, Optional[int]]:
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


def get_current_user() -> Optional[str]:
    # Agent รันเป็น root ผ่าน systemd: ผู้ใช้ที่ต้องการคือคนที่ล็อกอินอยู่ที่เครื่อง ไม่ใช่ root
    output = run_command("who") or ""
    for line in output.splitlines():
        name = line.split()[0] if line.split() else ""
        if name and name != "root":
            return name
    for env_name in ("SUDO_USER", "LOGNAME", "USER", "USERNAME"):
        value = os.environ.get(env_name)
        if value and value != "root":
            return value
    try:
        name = getpass.getuser()
        return None if name == "root" else name
    except Exception:
        return None


def get_hostname() -> str:
    return socket.gethostname().strip() or platform.node().strip() or "unknown-host"


# UUID ที่ผู้ผลิตเมนบอร์ดราคาถูกใส่เหมือนกันทุกเครื่อง: เลขเดียวกันทั้งหมด หรือค่าตัวอย่างของ AMI BIOS
JUNK_UUIDS = {"03000200-0400-0500-0006-000700080009"}


def is_junk_uuid(value: Optional[str]) -> bool:
    text = (value or "").strip().lower()
    if not text:
        return True
    digits = text.replace("-", "")
    return len(set(digits)) <= 1 or text in JUNK_UUIDS


def get_fingerprint() -> str:
    # ไม่ใช้ชื่อเครื่องและ MAC (เปลี่ยนได้ง่าย ทำให้เกิดเครื่องซ้ำในทะเบียน)
    machine_id = get_machine_id()
    bios_uuid = get_bios_uuid()
    bios_serial = get_bios_serial()
    components = [machine_id, bios_uuid, bios_serial]
    if not any(components):
        return sha256_hex("mac|{}|{}".format(get_primary_mac() or "", get_hostname()))
    if is_junk_uuid(bios_uuid) and not bios_serial:
        # S4: UUID ขยะ + ไม่มี serial: machine-id อย่างเดียวชนกันได้ในเครื่องที่ clone image มา
        # จึงเพิ่ม MAC เฉพาะกรณีนี้ — เครื่องที่มี UUID/serial ดีอยู่แล้วได้ fingerprint เดิมทุกประการ
        components.append(get_primary_mac())
    return sha256_hex("v2|" + "|".join(component or "" for component in components))


REAL_FILESYSTEMS = {"ext2", "ext3", "ext4", "xfs", "btrfs", "zfs", "f2fs", "jfs", "reiserfs", "ntfs", "ntfs3", "vfat", "exfat"}


def get_volumes() -> List[Dict[str, Any]]:
    volumes: List[Dict[str, Any]] = []
    seen: Set[str] = set()
    for line in (read_text_file("/proc/mounts") or "").splitlines():
        parts = line.split()
        if len(parts) < 3 or parts[2] not in REAL_FILESYSTEMS or parts[0] in seen:
            continue
        mount = parts[1].replace("\\040", " ")
        if mount.startswith(("/snap/", "/var/lib/docker", "/run/")):
            continue
        try:
            stat = os.statvfs(mount)
        except OSError:
            continue
        total = stat.f_blocks * stat.f_frsize
        if total <= 0:
            continue
        seen.add(parts[0])
        volumes.append({
            "mount": mount,
            "label": None,
            "fileSystem": parts[2],
            "totalGb": round(total / 1024**3, 2),
            "freeGb": round(stat.f_bavail * stat.f_frsize / 1024**3, 2),
            "isSystem": mount == "/",
        })
    return volumes[:26]


def get_meminfo_mb(key: str) -> Optional[int]:
    for line in (read_text_file("/proc/meminfo") or "").splitlines():
        if line.startswith(f"{key}:"):
            try:
                return round(int(line.split()[1]) / 1024)
            except (IndexError, ValueError):
                return None
    return None


def get_cpu_load_percent() -> Optional[int]:
    try:
        load1 = os.getloadavg()[0]
        return min(100, round(load1 / max(os.cpu_count() or 1, 1) * 100))
    except OSError:
        return None


def get_last_boot_at() -> Optional[str]:
    uptime = read_text_file("/proc/uptime")
    if not uptime:
        return None
    from datetime import datetime, timezone
    boot = time.time() - float(uptime.split()[0])
    return datetime.fromtimestamp(boot, timezone.utc).replace(microsecond=0).isoformat()


def get_physical_disks() -> List[Dict[str, Any]]:
    output = run_command("lsblk", "-J", "-d", "-b", "-o", "NAME,MODEL,ROTA,SIZE,TYPE")
    if not output:
        return []
    try:
        devices = json.loads(output).get("blockdevices", [])
    except json.JSONDecodeError:
        return []
    disks = []
    has_smartctl = shutil.which("smartctl") is not None
    for device in devices:
        if device.get("type") != "disk":
            continue
        name = device.get("name")
        health = None
        if has_smartctl and name:
            smart = run_command("smartctl", "-H", f"/dev/{name}") or ""
            if "PASSED" in smart or ": OK" in smart:
                health = "Healthy"
            elif "FAILED" in smart:
                health = "Unhealthy"
        rota = str(device.get("rota")).lower()
        disks.append({
            "model": normalize(device.get("model")) or name,
            "mediaType": "HDD" if rota in {"1", "true"} else "SSD",
            "sizeGb": round(int(device.get("size") or 0) / 1024**3),
            "healthStatus": health,
            "predictFailure": True if health == "Unhealthy" else None,
        })
    return disks[:16]


def get_battery_health_percent() -> Optional[int]:
    for battery in sorted(Path("/sys/class/power_supply").glob("BAT*")):
        for full_name, design_name in (("energy_full", "energy_full_design"), ("charge_full", "charge_full_design")):
            full = read_text_file(str(battery / full_name))
            design = read_text_file(str(battery / design_name))
            try:
                if full and design and int(design) > 0:
                    return round(int(full) / int(design) * 100)
            except ValueError:
                continue
    return None


def get_health() -> Dict[str, Any]:
    return {
        "volumes": get_volumes(),
        "memoryTotalMb": get_meminfo_mb("MemTotal"),
        "memoryAvailableMb": get_meminfo_mb("MemAvailable"),
        "cpuLoadPercent": get_cpu_load_percent(),
        "lastBootAt": get_last_boot_at(),
        "physicalDisks": get_physical_disks(),
        "windowsActivation": None,
        "antivirus": [],
        "lastUpdateInstalledAt": None,
        "pendingReboot": Path("/var/run/reboot-required").exists(),
        "batteryHealthPercent": get_battery_health_percent(),
    }


def get_inventory_payload() -> Dict[str, Any]:
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
        "manufacturerBrand": read_text_file("/sys/class/dmi/id/sys_vendor"),
        "manufacturerModel": read_text_file("/sys/class/dmi/id/product_name"),
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
        "agentPlatform": "linux",
        "capabilities": list(AGENT_CAPABILITIES),
        "status": "online",
        "collectedAt": time_iso(),
        "health": get_health(),
    }


def time_iso() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


class HttpError(RuntimeError):
    def __init__(self, status: int, message: str) -> None:
        RuntimeError.__init__(self, message)
        self.status = status


def post_json(url: str, body: Dict[str, Any], headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
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
        raise HttpError(exc.code, "HTTP {}: {}".format(exc.code, detail or exc.reason)) from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Request failed: {exc.reason}") from exc


def enroll_agent(
    base_url: str,
    token: Optional[str],
    config_path: str,
    facility_id: Optional[int] = None,
    work_group_id: Optional[int] = None,
    work_group_name: Optional[str] = None,
    install_key: Optional[str] = None,
) -> Dict[str, Any]:
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
        f"{base_url.rstrip('/')}/api/agent/enroll/",
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


def send_inventory(config: Dict[str, Any], payload: Dict[str, Any]) -> Dict[str, Any]:
    headers = {
        "x-agent-id": str(config["agentId"]),
        "x-agent-key": str(config["agentKey"]),
    }
    return post_json(f"{str(config['apiBaseUrl']).rstrip('/')}/api/agent/report/", payload, headers=headers)


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

    has_token = bool(args.enrollment_token)
    has_static_install = bool(args.install_key) and bool(args.facility_id)
    # G8: ติดตั้งทับ (installer ส่ง --api-base-url + token/คีย์มา) ให้ลงทะเบียนใหม่ เหมือน Windows forceEnroll
    force_enroll = bool(args.api_base_url) and (has_token or has_static_install)

    if config and force_enroll and config.get("agentId") and config.get("agentKey") and (
        str(config.get("apiBaseUrl", "")).rstrip("/") == str(args.api_base_url).rstrip("/")
    ):
        # ติดตั้งทับบนเซิร์ฟเวอร์เดิม: ลองกุญแจเดิมก่อน ถ้ายังใช้ได้ไม่ต้องลงทะเบียนใหม่ (กันเครื่องซ้ำ)
        try:
            upgrade_result = send_inventory(config, get_inventory_payload())
            print("Existing enrollment is still valid (DeviceId={}); keeping it.".format(upgrade_result.get("deviceId")))
            force_enroll = False
        except HttpError as exc:
            if exc.status != 401:
                # เช่น 409 ทะเบียนที่ผูกไว้ใช้ไม่ได้: กุญแจยังใช้ได้ ไม่ต้องลงทะเบียนใหม่
                print("Existing enrollment is valid but the report failed: {}".format(exc), file=sys.stderr)
                force_enroll = False
            else:
                print("Existing enrollment was rejected ({}); enrolling again.".format(exc))
        except RuntimeError as exc:
            print("Existing enrollment check failed ({}); enrolling again.".format(exc))

    if not config or force_enroll:
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
        print("Enrolled device for facility: {}".format(config["facilityName"]))

    if args.enroll_only:
        print("Enrollment completed. Config saved to {}".format(args.config_path))
        return 0

    payload = get_inventory_payload()
    try:
        result = send_inventory(config, payload)
    except HttpError as exc:
        # The server may have recorded our uninstall while its answer was lost: the confirmation is idempotent.
        if exc.status == 401 and "AGENT_RETIRED" in str(exc):
            if self_uninstall(None, config, args.config_path, trigger="rejected"):
                return 0
        raise
    print(
        "Inventory report sent successfully. DeviceId={} AssetId={}".format(
            result.get("deviceId"), result.get("linkedAssetId")
        )
    )
    # Remote uninstall (requested by a central administrator): confirm with the server first, then remove.
    if result.get("uninstall"):
        if self_uninstall(result.get("uninstall"), config, args.config_path):
            print("ATACS Agent was uninstalled at the administrator's request.")
        # Not confirmed: retry next run; never update or move a machine that is being uninstalled.
        return 0
    # The server announces its current address after a move (e.g. Vercel -> own server); follow it once.
    new_base = normalize(result.get("apiBaseUrl"))
    current_base = str(config.get("apiBaseUrl", "")).rstrip("/")
    if new_base and new_base.rstrip("/") != current_base:
        if api_base_allowed(new_base, current_base):
            config["apiBaseUrl"] = new_base.rstrip("/")
            save_config(args.config_path, config)
            print("Server address changed; apiBaseUrl updated to {}".format(config["apiBaseUrl"]))
        else:
            # SEC-06: refuse to follow an address outside the allowlist, and keep reporting to the old one.
            print(
                "Refused server address change to {}: host is not allowed. "
                "Still reporting to {}.".format(new_base, current_base),
                file=sys.stderr,
            )
    # Auto-update (enabled per facility by the administrator): verified download, then replace this script.
    if result.get("update"):
        self_update(result.get("update"), current_base)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as error:
        print("ATACS agent error: {}".format(error), file=sys.stderr)
        raise SystemExit(1)
