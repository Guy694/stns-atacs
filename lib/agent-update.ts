/**
 * อัปเดต ATACS Agent อัตโนมัติ (Agent 2.2.0 ขึ้นไป)
 *
 * เซิร์ฟเวอร์แนบ `update` = { version, url, sha256, size } ไปกับคำตอบของ /api/agent/report
 * เฉพาะเมื่อ: ผู้ดูแลเปิดให้หน่วยงานของเครื่องนั้น (agent.autoUpdate = pilot/all), เครื่องรายงานรุ่นเก่ากว่า
 * ไฟล์ใน public/agent, agent ประกาศว่าอัปเดตตัวเองได้ (capabilities: ["self-update"]) และ URL เป็น https
 * agent ตรวจ host, ขนาด, SHA-256 และเลขรุ่นในไฟล์ก่อนแทนที่ตัวเองเสมอ — เซิร์ฟเวอร์ไม่สั่งรันโค้ดใด ๆ โดยตรง
 *
 * ไฟล์นี้ไม่แตะฐานข้อมูล (การตั้งค่าส่งเข้ามาเป็นพารามิเตอร์) จึงทดสอบได้โดยตรง
 */

import crypto from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { compareVersions } from "@/lib/agent-payload";

export const AGENT_SELF_UPDATE_CAPABILITY = "self-update";
/** รุ่นแรกที่มีตัวอัปเดตตัวเอง: เครื่องที่ต่ำกว่านี้ต้องติดตั้งใหม่ด้วยมือหนึ่งครั้ง */
export const AGENT_SELF_UPDATE_MIN_VERSION = "2.2.0";
/** เพดานขนาดสคริปต์ที่ยอมแจก/ดาวน์โหลด (ฝั่ง agent ใช้ค่าเดียวกัน) */
export const AGENT_UPDATE_MAX_BYTES = 2 * 1024 * 1024;

export const AGENT_AUTO_UPDATE_SETTING_KEY = "agent.autoUpdate";
export const AGENT_AUTO_UPDATE_PILOT_SETTING_KEY = "agent.autoUpdatePilotFacilityIds";

export type AgentAutoUpdateMode = "off" | "pilot" | "all";
export type AgentAutoUpdateSettings = { mode: AgentAutoUpdateMode; pilotFacilityIds: number[] };
export type AgentPlatform = "windows" | "linux";
export type AgentUpdateArtifact = { version: string; sha256: string; size: number };
export type AgentUpdateOffer = AgentUpdateArtifact & { url: string };

export type AgentUpdateDecisionReason =
  | "offered"
  | "disabled"
  | "facility-not-enabled"
  | "no-self-update-capability"
  | "unknown-platform"
  | "up-to-date"
  | "insecure-base-url"
  | "artifact-unavailable"
  | "artifact-version-mismatch"
  | "artifact-too-large";

const SCRIPT_PATHS: Record<AgentPlatform, string> = {
  windows: "agent/windows/atacs-agent.ps1",
  linux: "agent/linux/atacs-agent.py",
};

const VERSION_PATTERNS: Record<AgentPlatform, RegExp> = {
  windows: /^\$script:AgentVersion = "(\d+\.\d+\.\d+)"/m,
  linux: /^AGENT_VERSION = "(\d+\.\d+\.\d+)"/m,
};

export function parseAgentAutoUpdateMode(value: string | null | undefined): AgentAutoUpdateMode {
  const normalized = value?.trim().toLowerCase();
  return normalized === "pilot" || normalized === "all" ? normalized : "off";
}

export function parsePilotFacilityIds(value: string | null | undefined): number[] {
  const ids = (value ?? "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((id) => Number.isSafeInteger(id) && id > 0);
  return [...new Set(ids)].sort((a, b) => a - b);
}

export function serializePilotFacilityIds(ids: number[]) {
  return parsePilotFacilityIds(ids.join(",")).join(",");
}

export function readAgentAutoUpdateSettings(values: Record<string, string | undefined>): AgentAutoUpdateSettings {
  return {
    mode: parseAgentAutoUpdateMode(values[AGENT_AUTO_UPDATE_SETTING_KEY]),
    pilotFacilityIds: parsePilotFacilityIds(values[AGENT_AUTO_UPDATE_PILOT_SETTING_KEY]),
  };
}

export function isAutoUpdateEnabledForFacility(settings: AgentAutoUpdateSettings, facilityId: number | null | undefined) {
  if (settings.mode === "all") return true;
  if (settings.mode === "pilot") return facilityId != null && settings.pilotFacilityIds.includes(Number(facilityId));
  return false;
}

/** URL ฐานที่ใช้แจกไฟล์อัปเดต: https เท่านั้น ยกเว้น http://localhost ตอนพัฒนา */
export function secureAgentUpdateBaseUrl(value: string | null | undefined): string | null {
  const text = value?.trim().replace(/\/+$/, "") ?? "";
  if (!text) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol === "https:") return text;
  if (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return text;
  return null;
}

/** เชื่อเฉพาะช่อง agentPlatform ที่ agent 2.2.0+ ส่งมา (ไม่เดาจากชื่อ OS) */
export function detectAgentPlatform(payload: unknown): AgentPlatform | null {
  if (typeof payload !== "object" || payload === null) return null;
  const value = (payload as { agentPlatform?: unknown }).agentPlatform;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized === "windows" || normalized === "linux" ? normalized : null;
}

export function readAgentScriptVersion(text: string, platform: AgentPlatform): string | null {
  return VERSION_PATTERNS[platform].exec(text)?.[1] ?? null;
}

export function agentScriptRelativePath(platform: AgentPlatform) {
  return SCRIPT_PATHS[platform];
}

export function decideAgentUpdate(input: {
  settings: AgentAutoUpdateSettings;
  facilityId: number | null | undefined;
  agentVersion: string | null | undefined;
  capabilities: string[];
  platform: AgentPlatform | null;
  baseUrl: string | null | undefined;
  artifact: AgentUpdateArtifact | null;
  latestVersion: string;
}): { update: AgentUpdateOffer | null; reason: AgentUpdateDecisionReason } {
  const refuse = (reason: AgentUpdateDecisionReason) => ({ update: null, reason });
  if (input.settings.mode === "off") return refuse("disabled");
  if (!isAutoUpdateEnabledForFacility(input.settings, input.facilityId)) return refuse("facility-not-enabled");
  if (!input.capabilities.includes(AGENT_SELF_UPDATE_CAPABILITY)) return refuse("no-self-update-capability");
  if (!input.platform) return refuse("unknown-platform");
  if (compareVersions(input.agentVersion, input.latestVersion) >= 0) return refuse("up-to-date");
  const baseUrl = secureAgentUpdateBaseUrl(input.baseUrl);
  if (!baseUrl) return refuse("insecure-base-url");
  const artifact = input.artifact;
  if (!artifact) return refuse("artifact-unavailable");
  // ไฟล์ที่ดีพลอยต้องเป็นรุ่นล่าสุดตามโค้ดเซิร์ฟเวอร์พอดี (กันแจกไฟล์ค้าง/ผิดรุ่น)
  if (compareVersions(artifact.version, input.latestVersion) !== 0) return refuse("artifact-version-mismatch");
  if (artifact.size <= 0 || artifact.size > AGENT_UPDATE_MAX_BYTES) return refuse("artifact-too-large");
  return {
    update: { version: artifact.version, url: `${baseUrl}/${SCRIPT_PATHS[input.platform]}`, sha256: artifact.sha256, size: artifact.size },
    reason: "offered",
  };
}

type ArtifactReaderDeps = {
  root: string;
  stat: (file: string) => Promise<{ mtimeMs: number; size: number }>;
  readFile: (file: string) => Promise<Buffer>;
};

/** อ่านสคริปต์จริงใน public/ แล้วคำนวณ SHA-256 ครั้งเดียว อ่านใหม่เมื่อ mtime หรือขนาดไฟล์เปลี่ยน */
export function createAgentArtifactReader(deps: ArtifactReaderDeps) {
  const cache = new Map<AgentPlatform, { mtimeMs: number; size: number; artifact: AgentUpdateArtifact | null }>();
  return async function readArtifact(platform: AgentPlatform): Promise<AgentUpdateArtifact | null> {
    const file = path.join(deps.root, "public", SCRIPT_PATHS[platform]);
    try {
      const info = await deps.stat(file);
      if (info.size <= 0 || info.size > AGENT_UPDATE_MAX_BYTES) return null;
      const cached = cache.get(platform);
      if (cached && cached.mtimeMs === info.mtimeMs && cached.size === info.size) return cached.artifact;
      const body = await deps.readFile(file);
      const version = readAgentScriptVersion(body.toString("utf8"), platform);
      const artifact = version
        ? { version, sha256: crypto.createHash("sha256").update(body).digest("hex"), size: body.length }
        : null;
      cache.set(platform, { mtimeMs: info.mtimeMs, size: info.size, artifact });
      return artifact;
    } catch {
      return null;
    }
  };
}

let defaultReader: ReturnType<typeof createAgentArtifactReader> | null = null;

function readDefaultArtifact(platform: AgentPlatform) {
  defaultReader ??= createAgentArtifactReader({ root: process.cwd(), stat, readFile });
  return defaultReader(platform);
}

/** ใช้ใน /api/agent/report: คืนข้อมูลอัปเดตหรือ null (ไม่ throw เพราะอ่านไฟล์ไม่ได้) */
export async function resolveAgentUpdateOffer(input: {
  settings: AgentAutoUpdateSettings;
  facilityId: number | null | undefined;
  agentVersion: string | null | undefined;
  capabilities: string[];
  payload: unknown;
  baseUrl: string;
  latestVersion: string;
  readArtifact?: (platform: AgentPlatform) => Promise<AgentUpdateArtifact | null>;
}) {
  const platform = detectAgentPlatform(input.payload);
  const common = { ...input, platform, artifact: null };
  // ตรวจเงื่อนไขที่ไม่ต้องอ่านไฟล์ก่อน — เครื่องส่วนใหญ่ไม่ต้องได้อัปเดต
  const precheck = decideAgentUpdate(common);
  if (precheck.reason !== "artifact-unavailable" || !platform) return precheck;
  const artifact = await (input.readArtifact ?? readDefaultArtifact)(platform);
  return decideAgentUpdate({ ...common, artifact });
}

export type AgentFleetDevice = { facilityId: number; agentVersion: string | null; isActive: boolean; uninstalledAt?: string | null };

export type AgentUpdateFleetSummary = {
  total: number;
  /** รุ่นล่าสุดแล้ว */
  upToDate: number;
  /** มีตัวอัปเดตและหน่วยงานเปิดอัปเดตอัตโนมัติ: จะอัปเดตเองในรอบรายงานถัดไป */
  autoUpdating: number;
  /** มีตัวอัปเดตแต่หน่วยงานยังไม่เปิด */
  updaterWaiting: number;
  /** รุ่นก่อน 2.2.0 (หรือไม่ทราบรุ่น): ต้องติดตั้งใหม่ด้วยมือหนึ่งครั้ง */
  needsReinstall: number;
  versions: { version: string; count: number }[];
};

export function summarizeAgentUpdateFleet(
  devices: AgentFleetDevice[],
  settings: AgentAutoUpdateSettings,
  latestVersion: string
): AgentUpdateFleetSummary {
  const summary: AgentUpdateFleetSummary = { total: 0, upToDate: 0, autoUpdating: 0, updaterWaiting: 0, needsReinstall: 0, versions: [] };
  const counts = new Map<string, number>();
  for (const device of devices) {
    if (!device.isActive || device.uninstalledAt) continue;
    summary.total += 1;
    const version = device.agentVersion?.trim() || null;
    const label = version ?? "ไม่ทราบ";
    counts.set(label, (counts.get(label) ?? 0) + 1);
    if (version && compareVersions(version, latestVersion) >= 0) summary.upToDate += 1;
    else if (!version || compareVersions(version, AGENT_SELF_UPDATE_MIN_VERSION) < 0) summary.needsReinstall += 1;
    else if (isAutoUpdateEnabledForFacility(settings, device.facilityId)) summary.autoUpdating += 1;
    else summary.updaterWaiting += 1;
  }
  summary.versions = [...counts.entries()]
    .map(([version, count]) => ({ version, count }))
    .sort((a, b) => {
      if (a.version === "ไม่ทราบ") return 1;
      if (b.version === "ไม่ทราบ") return -1;
      return compareVersions(b.version, a.version);
    });
  return summary;
}
