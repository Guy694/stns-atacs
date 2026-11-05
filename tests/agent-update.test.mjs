import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const payload = loadTs("lib/agent-payload.ts");
const update = loadTs("lib/agent-update.ts", { "node:fs/promises": {} });
const plain = (value) => JSON.parse(JSON.stringify(value));

const artifact = (version = "2.3.0") => ({ version, sha256: "a".repeat(64), size: 1234 });
const baseInput = (overrides = {}) => ({
  settings: { mode: "all", pilotFacilityIds: [] },
  facilityId: 10,
  agentVersion: "2.2.0",
  capabilities: ["self-update"],
  platform: "windows",
  baseUrl: "https://stn.moph.go.th/stns-atacs",
  artifact: artifact(),
  latestVersion: "2.3.0",
  ...overrides,
});

test("compareVersions orders x.y.z numerically and treats junk as older", () => {
  const { compareVersions } = payload;
  assert.equal(compareVersions("2.1.0", "2.2.0"), -1);
  assert.equal(compareVersions("2.2.0", "2.2.0"), 0);
  assert.equal(compareVersions("2.10.0", "2.9.9"), 1);
  assert.equal(compareVersions("2.2", "2.2.0"), 0);
  assert.equal(compareVersions(null, "2.2.0"), -1);
  assert.equal(compareVersions("garbage", "0.0.1"), -1);
});

test("cleanAgentCapabilities accepts a list (or a single string) of known short tokens", () => {
  const { cleanAgentCapabilities } = payload;
  assert.deepEqual(plain(cleanAgentCapabilities(["self-update", "SELF-UPDATE", "x y", 3])), ["self-update"]);
  assert.deepEqual(plain(cleanAgentCapabilities("self-update")), ["self-update"]);
  assert.deepEqual(plain(cleanAgentCapabilities(undefined)), []);
  assert.deepEqual(plain(cleanAgentCapabilities({ a: 1 })), []);
  assert.equal(cleanAgentCapabilities(Array(100).fill("a")).length, 1);
});

test("auto-update settings parse with off as the default", () => {
  const { parseAgentAutoUpdateMode, parsePilotFacilityIds, readAgentAutoUpdateSettings, serializePilotFacilityIds } = update;
  assert.equal(parseAgentAutoUpdateMode(null), "off");
  assert.equal(parseAgentAutoUpdateMode("bogus"), "off");
  assert.equal(parseAgentAutoUpdateMode(" PILOT "), "pilot");
  assert.equal(parseAgentAutoUpdateMode("all"), "all");
  assert.deepEqual(plain(parsePilotFacilityIds("3, 1,3,x,-2,0, 12")), [1, 3, 12]);
  assert.deepEqual(plain(parsePilotFacilityIds(null)), []);
  assert.equal(serializePilotFacilityIds([12, 3, 3, 1]), "1,3,12");
  assert.deepEqual(plain(readAgentAutoUpdateSettings({})), { mode: "off", pilotFacilityIds: [] });
  assert.deepEqual(
    plain(readAgentAutoUpdateSettings({ "agent.autoUpdate": "pilot", "agent.autoUpdatePilotFacilityIds": "5,2" })),
    { mode: "pilot", pilotFacilityIds: [2, 5] }
  );
});

test("facility gating: off never, pilot only listed facilities, all every facility", () => {
  const { isAutoUpdateEnabledForFacility } = update;
  assert.equal(isAutoUpdateEnabledForFacility({ mode: "off", pilotFacilityIds: [10] }, 10), false);
  assert.equal(isAutoUpdateEnabledForFacility({ mode: "pilot", pilotFacilityIds: [10] }, 10), true);
  assert.equal(isAutoUpdateEnabledForFacility({ mode: "pilot", pilotFacilityIds: [10] }, 11), false);
  assert.equal(isAutoUpdateEnabledForFacility({ mode: "all", pilotFacilityIds: [] }, 11), true);
});

test("update base URL must be https (http only for localhost dev)", () => {
  const { secureAgentUpdateBaseUrl } = update;
  assert.equal(secureAgentUpdateBaseUrl("https://stn.moph.go.th/stns-atacs/"), "https://stn.moph.go.th/stns-atacs");
  assert.equal(secureAgentUpdateBaseUrl("http://stn.moph.go.th/stns-atacs"), null);
  assert.equal(secureAgentUpdateBaseUrl("http://10.0.0.5:3000"), null);
  assert.equal(secureAgentUpdateBaseUrl("http://localhost:3000"), "http://localhost:3000");
  assert.equal(secureAgentUpdateBaseUrl("http://localhost.evil.com"), null);
  assert.equal(secureAgentUpdateBaseUrl("ftp://localhost"), null);
  assert.equal(secureAgentUpdateBaseUrl("not a url"), null);
});

test("decideAgentUpdate offers the right script when every rule holds", () => {
  const result = update.decideAgentUpdate(baseInput());
  assert.equal(result.reason, "offered");
  assert.deepEqual(plain(result.update), {
    version: "2.3.0",
    url: "https://stn.moph.go.th/stns-atacs/agent/windows/atacs-agent.ps1",
    sha256: "a".repeat(64),
    size: 1234,
  });
  const linux = update.decideAgentUpdate(baseInput({ platform: "linux" }));
  assert.equal(linux.update.url, "https://stn.moph.go.th/stns-atacs/agent/linux/atacs-agent.py");
});

test("decideAgentUpdate refuses for each failing rule", () => {
  const cases = [
    [{ settings: { mode: "off", pilotFacilityIds: [10] } }, "disabled"],
    [{ settings: { mode: "pilot", pilotFacilityIds: [99] } }, "facility-not-enabled"],
    [{ capabilities: [] }, "no-self-update-capability"],
    [{ platform: null }, "unknown-platform"],
    [{ agentVersion: "2.3.0" }, "up-to-date"],
    [{ agentVersion: "9.0.0" }, "up-to-date"],
    [{ baseUrl: "http://stn.moph.go.th/stns-atacs" }, "insecure-base-url"],
    [{ artifact: null }, "artifact-unavailable"],
    [{ artifact: artifact("2.2.5") }, "artifact-version-mismatch"],
    [{ artifact: { ...artifact(), size: 3 * 1024 * 1024 } }, "artifact-too-large"],
  ];
  for (const [overrides, reason] of cases) {
    const result = update.decideAgentUpdate(baseInput(overrides));
    assert.equal(result.update, null, reason);
    assert.equal(result.reason, reason);
  }
});

test("detectAgentPlatform only trusts the explicit agentPlatform field", () => {
  const { detectAgentPlatform } = update;
  assert.equal(detectAgentPlatform({ agentPlatform: "windows" }), "windows");
  assert.equal(detectAgentPlatform({ agentPlatform: "Linux" }), "linux");
  assert.equal(detectAgentPlatform({ agentPlatform: "mac" }), null);
  assert.equal(detectAgentPlatform({ operatingSystem: "Windows 11" }), null);
  assert.equal(detectAgentPlatform(null), null);
});

test("readAgentScriptVersion reads the version line from each script", () => {
  const { readAgentScriptVersion } = update;
  assert.equal(readAgentScriptVersion('x\n$script:AgentVersion = "2.2.0"\n', "windows"), "2.2.0");
  assert.equal(readAgentScriptVersion('x\nAGENT_VERSION = "2.2.0"\n', "linux"), "2.2.0");
  assert.equal(readAgentScriptVersion("nothing", "linux"), null);
  assert.equal(readAgentScriptVersion(read("public/agent/windows/atacs-agent.ps1"), "windows"), payload.AGENT_LATEST_VERSION);
  assert.equal(readAgentScriptVersion(read("public/agent/linux/atacs-agent.py"), "linux"), payload.AGENT_LATEST_VERSION);
});

test("artifact reader hashes the real file once and re-reads only when mtime/size change", async () => {
  const files = { "/root/public/agent/windows/atacs-agent.ps1": { mtimeMs: 1, body: Buffer.from('$script:AgentVersion = "2.2.0"\n') } };
  let reads = 0;
  const reader = update.createAgentArtifactReader({
    root: "/root",
    stat: async (file) => {
      if (!files[file]) throw new Error("ENOENT");
      return { mtimeMs: files[file].mtimeMs, size: files[file].body.length };
    },
    readFile: async (file) => {
      reads += 1;
      return files[file].body;
    },
  });
  const first = await reader("windows");
  const expected = crypto.createHash("sha256").update(files["/root/public/agent/windows/atacs-agent.ps1"].body).digest("hex");
  assert.deepEqual(plain(first), { version: "2.2.0", sha256: expected, size: files["/root/public/agent/windows/atacs-agent.ps1"].body.length });
  await reader("windows");
  assert.equal(reads, 1, "cached while mtime and size are unchanged");

  files["/root/public/agent/windows/atacs-agent.ps1"] = { mtimeMs: 2, body: Buffer.from('$script:AgentVersion = "2.3.0"\n') };
  const second = await reader("windows");
  assert.equal(reads, 2);
  assert.equal(second.version, "2.3.0");

  assert.equal(await reader("linux"), null, "missing file -> no update, no throw");
});

test("artifact reader refuses files above the 2 MB cap", async () => {
  const reader = update.createAgentArtifactReader({
    root: "/root",
    stat: async () => ({ mtimeMs: 1, size: 3 * 1024 * 1024 }),
    readFile: async () => { throw new Error("must not read an oversized file"); },
  });
  assert.equal(await reader("linux"), null);
});

test("real public scripts hash to what the reader reports (same bytes agents download)", async () => {
  const fsp = await import("node:fs/promises");
  const reader = update.createAgentArtifactReader({ root: new URL("../", import.meta.url).pathname, stat: fsp.stat, readFile: fsp.readFile });
  for (const [platform, file] of [["windows", "public/agent/windows/atacs-agent.ps1"], ["linux", "public/agent/linux/atacs-agent.py"]]) {
    const info = await reader(platform);
    const bytes = fs.readFileSync(new URL(`../${file}`, import.meta.url));
    assert.equal(info.sha256, crypto.createHash("sha256").update(bytes).digest("hex"));
    assert.equal(info.size, bytes.length);
    assert.equal(info.version, payload.AGENT_LATEST_VERSION);
  }
});

test("summarizeAgentUpdateFleet counts versions, auto-updatable and reinstall-needed devices", () => {
  const devices = [
    { facilityId: 1, agentVersion: "2.0.1", isActive: true },
    { facilityId: 1, agentVersion: "2.1.0", isActive: true },
    { facilityId: 1, agentVersion: "2.2.0", isActive: true },
    { facilityId: 2, agentVersion: "2.2.0", isActive: true },
    { facilityId: 2, agentVersion: "2.3.0", isActive: true },
    { facilityId: 2, agentVersion: null, isActive: true },
    { facilityId: 2, agentVersion: "2.1.0", isActive: false },
  ];
  const summary = update.summarizeAgentUpdateFleet(devices, { mode: "pilot", pilotFacilityIds: [1] }, "2.3.0");
  assert.deepEqual(plain(summary), {
    total: 6,
    upToDate: 1,
    autoUpdating: 1,
    updaterWaiting: 1,
    needsReinstall: 3,
    versions: [
      { version: "2.3.0", count: 1 },
      { version: "2.2.0", count: 2 },
      { version: "2.1.0", count: 1 },
      { version: "2.0.1", count: 1 },
      { version: "ไม่ทราบ", count: 1 },
    ],
  });
});

test("report route attaches update info without letting update errors fail the report", () => {
  const route = read("app/api/agent/report/route.ts");
  assert.match(route, /resolveAgentUpdateOffer/);
  assert.match(route, /getAgentAutoUpdateSettings/);
  assert.match(route, /update\s*\?\s*\{\s*update\s*\}/);
  assert.match(route, /catch \(updateError\)/);
});
