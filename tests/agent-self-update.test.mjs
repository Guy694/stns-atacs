import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const agentPy = new URL("../public/agent/linux/atacs-agent.py", import.meta.url).pathname;

// Exercises the real Linux self_update() against a temp install dir with an injected downloader
// (no network): only a hash-verified, newer, correctly versioned script may replace the agent.
const HARNESS = String.raw`
import hashlib, importlib.util, json, os, shutil, stat, sys, tempfile
spec = importlib.util.spec_from_file_location("atacs_agent", sys.argv[1])
agent = importlib.util.module_from_spec(spec)
spec.loader.exec_module(agent)
source = open(sys.argv[1], "rb").read()
newer = source.replace(('AGENT_VERSION = "' + agent.AGENT_VERSION + '"').encode(), b'AGENT_VERSION = "9.9.9"')
base = "https://stn.moph.go.th/stns-atacs"
url = base + "/agent/linux/atacs-agent.py"

def run(body, update, current=base):
    root = tempfile.mkdtemp()
    target = os.path.join(root, "atacs-agent.py")
    open(target, "wb").write(source)
    os.chmod(target, 0o700)
    calls = []
    def downloader(u, cap, timeout):
        calls.append([u, cap, timeout])
        return body
    ok = agent.self_update(update, current, target=target, downloader=downloader)
    result = {
        "ok": ok,
        "replaced": open(target, "rb").read() == body,
        "backup": os.path.exists(target + ".bak") and open(target + ".bak", "rb").read() == source,
        "mode": oct(stat.S_IMODE(os.stat(target).st_mode)),
        "leftovers": sorted(n for n in os.listdir(root) if n.startswith(".atacs-agent-update-")),
        "downloads": len(calls),
        "cap": calls[0][1] if calls else None,
        "log": os.path.exists(os.path.join(root, "update.log")),
    }
    shutil.rmtree(root)
    return result

good = {"version": "9.9.9", "url": url, "sha256": hashlib.sha256(newer).hexdigest(), "size": len(newer)}
same_version = source
bad = b'AGENT_VERSION = "9.9.9"\ndef (:\n'
print(json.dumps({
    "good": run(newer, good),
    "hashMismatch": run(newer + b"#", dict(good, size=len(newer) + 1)),
    "sizeMismatch": run(newer, dict(good, size=len(newer) + 5)),
    "http": run(newer, dict(good, url=url.replace("https", "http"))),
    "foreignHost": run(newer, dict(good, url="https://evil.example.com/atacs-agent.py")),
    "notNewer": run(newer, dict(good, version=agent.AGENT_VERSION)),
    "missingVersionString": run(same_version, {"version": "9.9.9", "url": url, "sha256": hashlib.sha256(same_version).hexdigest(), "size": len(same_version)}),
    "tooLarge": run(newer, dict(good, size=3 * 1024 * 1024)),
    "badSyntax": run(bad, {"version": "9.9.9", "url": url, "sha256": hashlib.sha256(bad).hexdigest(), "size": len(bad)}),
    "garbage": run(newer, "nope"),
    "localhostDev": run(newer, dict(good, url="http://localhost:3000/agent/linux/atacs-agent.py"), current="http://localhost:3000"),
    "payload": {"capabilities": agent.AGENT_CAPABILITIES},
}))
`;

function runHarness() {
  const result = spawnSync("python3", ["-B", "-c", HARNESS, agentPy], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout.trim().split("\n").filter((line) => line.startsWith("{")).at(-1));
}

test("Linux agent self_update replaces itself only with a verified newer script", { skip: spawnSync("python3", ["--version"]).status !== 0 }, () => {
  const r = runHarness();
  assert.deepEqual(r.good, { ok: true, replaced: true, backup: true, mode: "0o755", leftovers: [], downloads: 1, cap: 2 * 1024 * 1024, log: true });
  for (const name of ["hashMismatch", "sizeMismatch", "missingVersionString", "badSyntax"]) {
    assert.equal(r[name].ok, false, name);
    if (name !== "missingVersionString") assert.equal(r[name].replaced, false, name);
    assert.equal(r[name].backup, false, `${name}: no backup/replace step reached`);
    assert.equal(r[name].mode, "0o700", `${name}: original untouched`);
    assert.deepEqual(r[name].leftovers, [], `${name}: temp file cleaned up`);
    assert.equal(r[name].downloads, 1, name);
  }
  for (const name of ["http", "foreignHost", "notNewer", "tooLarge", "garbage"]) {
    assert.equal(r[name].ok, false, name);
    assert.equal(r[name].downloads, 0, `${name}: refused before downloading`);
  }
  assert.equal(r.localhostDev.ok, true, "http allowed only for the localhost dev server it reports to");
  assert.deepEqual(r.payload.capabilities, ["self-update", "self-uninstall"]);
});

test("Linux agent stays Python 3.6 compatible", { skip: spawnSync("python3", ["--version"]).status !== 0 }, () => {
  const check = spawnSync("python3", ["-B", "-c", "import ast,sys; ast.parse(open(sys.argv[1]).read(), feature_version=(3, 6))", agentPy], { encoding: "utf8" });
  assert.equal(check.status, 0, check.stderr);
  const source = read("public/agent/linux/atacs-agent.py");
  assert.doesNotMatch(source, /:=/, "no walrus");
  assert.doesNotMatch(source, /f"[^"]*\{[^}]*=\}/, "no f-string = specifier");
  assert.match(source, /"agentPlatform": "linux"/);
  assert.match(source, /"capabilities": list\(AGENT_CAPABILITIES\)/);
  assert.match(source, /os\.replace\(temp_path, target_path\)/);
  assert.match(source, /os\.chmod\(temp_path, 0o755\)/);
  assert.match(source, /os\.chown\(temp_path, 0, 0\)/);
  assert.match(source, /\.bak/);
});

test("Windows agent self-update: PS 5.1 APIs, verification before replace, never fails the run", () => {
  const ps = read("public/agent/windows/atacs-agent.ps1");
  assert.match(ps, /agentPlatform = "windows"/);
  assert.match(ps, /\$script:AgentCapabilities = @\("self-update", "self-uninstall"\)/);
  assert.match(ps, /\$script:UpdateMaxBytes = 2MB/);
  assert.match(ps, /Get-FileHash -LiteralPath \$temp -Algorithm SHA256/);
  assert.match(ps, /AllowAutoRedirect = \$false/);
  assert.match(ps, /Test-UpdateUrlAllowed/);
  assert.match(ps, /Test-ApiBaseAllowed -NewBase \$Url/);
  assert.match(ps, /\[System\.Management\.Automation\.Language\.Parser\]::ParseFile\(\$temp/);
  assert.match(ps, /Copy-Item -LiteralPath \$target -Destination "\$target\.bak" -Force/);
  assert.match(ps, /Move-Item -LiteralPath \$temp -Destination \$target -Force/);
  // Order: hash + version string checked before the backup/replace step.
  assert.ok(ps.indexOf("SHA-256 mismatch") < ps.indexOf("Move-Item -LiteralPath $temp"));
  assert.ok(ps.indexOf("does not declare version") < ps.indexOf("Move-Item -LiteralPath $temp"));
  // The user's ACL fix stays: reset inherited ACLs, then SYSTEM + Administrators only.
  assert.match(ps, /icacls\.exe \$dir \/reset \/T \/C \/Q/);
  assert.match(ps, /\/inheritance:r \/grant:r "\*S-1-5-18:\(OI\)\(CI\)F" "\*S-1-5-32-544:\(OI\)\(CI\)F"/);
  // Update is attempted after the report, inside its own try/catch, once.
  const main = ps.slice(ps.lastIndexOf("$result = Send-Inventory"));
  assert.equal(main.match(/Invoke-AgentSelfUpdate -Update/g)?.length, 1);
  assert.match(main, /try \{ Invoke-AgentSelfUpdate[^\n]*\}\s*\n\s*catch \{ Write-Warning/);
  // New PowerShell code keeps to ASCII so PS 5.1 reading a BOM-less file as ANSI cannot change its meaning.
  const updateBlock = ps.slice(ps.indexOf("function Compare-AgentVersion"), ps.indexOf("function Ensure-Directory"));
  assert.doesNotMatch(updateBlock, /[^\x00-\x7f]/);
});

test("PowerShell agent parses (when pwsh is installed)", { skip: spawnSync("pwsh", ["-v"]).status !== 0 }, () => {
  for (const file of ["atacs-agent.ps1", "install-atacs-agent.ps1", "repoint-atacs-agent.ps1", "uninstall-atacs-agent.ps1"]) {
    const path = new URL(`../public/agent/windows/${file}`, import.meta.url).pathname;
    const result = spawnSync("pwsh", ["-NoProfile", "-Command", `$e=$null;$t=$null;[void][System.Management.Automation.Language.Parser]::ParseFile('${path}',[ref]$t,[ref]$e);if($e.Count){$e|%{$_.ToString()};exit 1}`], { encoding: "utf8" });
    assert.equal(result.status, 0, `${file}: ${result.stdout}${result.stderr}`);
  }
});
