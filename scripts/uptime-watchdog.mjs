#!/usr/bin/env node
// ATACS uptime watchdog — runs as container stn-atacs-watchdog next to stn-atacs-app.
// Polls the health URLs every minute; tells Telegram when the system goes down (after N failures in a row),
// reminds while it stays down, and reports recovery with the outage length.
//
// Environment:
//   WATCHDOG_URL                   internal health URL (default http://stn-atacs-app:3000/stns-atacs/api/health/)
//   WATCHDOG_PUBLIC_URL            optional public URL, e.g. https://stn.moph.go.th/stns-atacs/api/health/ (also checks nginx/TLS)
//   WATCHDOG_INTERVAL_SECONDS      60
//   WATCHDOG_FAILURES_BEFORE_ALERT 3
//   WATCHDOG_REMIND_MINUTES        30
//   WATCHDOG_TIMEOUT_SECONDS       10
//   TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (comma-separated ids allowed)
//
// Zero dependencies (Node 18+ fetch) so it runs on the stock node:22-alpine image.
import { pathToFileURL } from "node:url";

const SYSTEM = "ATACS ระบบทะเบียนครุภัณฑ์";

const int = (value, fallback) => {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export function readConfig(env = process.env) {
  return {
    targets: [
      { name: "แอป (ภายใน)", url: env.WATCHDOG_URL || "http://stn-atacs-app:3000/stns-atacs/api/health/" },
      env.WATCHDOG_PUBLIC_URL ? { name: "เว็บไซต์สาธารณะ", url: env.WATCHDOG_PUBLIC_URL } : null,
    ].filter(Boolean),
    intervalMs: int(env.WATCHDOG_INTERVAL_SECONDS, 60) * 1000,
    failuresBeforeAlert: int(env.WATCHDOG_FAILURES_BEFORE_ALERT, 3),
    remindMs: int(env.WATCHDOG_REMIND_MINUTES, 30) * 60 * 1000,
    timeoutMs: int(env.WATCHDOG_TIMEOUT_SECONDS, 10) * 1000,
    token: env.TELEGRAM_BOT_TOKEN || "",
    chatIds: [...new Set(String(env.TELEGRAM_CHAT_ID || "").split(/[\s,;]+/).filter(Boolean))],
  };
}

/**
 * Pure state machine for one target. `result` = { ok, reason }.
 * Returns the next state and, when Telegram should hear about it, notify = { kind, since, failures, reason }.
 */
export function stepTarget(state, result, now, { failuresBeforeAlert, remindMs }) {
  if (result.ok) {
    const notify = state.alerted ? { kind: "up", since: state.downSince ?? now, failures: state.failures, reason: "" } : null;
    return { state: { failures: 0, downSince: null, alerted: false, lastAlertAt: null }, notify };
  }
  const failures = state.failures + 1;
  const downSince = state.downSince ?? now;
  if (!state.alerted && failures >= failuresBeforeAlert) {
    return { state: { failures, downSince, alerted: true, lastAlertAt: now }, notify: { kind: "down", since: downSince, failures, reason: result.reason } };
  }
  if (state.alerted && now - (state.lastAlertAt ?? now) >= remindMs) {
    return { state: { failures, downSince, alerted: true, lastAlertAt: now }, notify: { kind: "still_down", since: downSince, failures, reason: result.reason } };
  }
  return { state: { ...state, failures, downSince }, notify: null };
}

const esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clock = (ms) => new Date(ms).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });

function durationText(ms) {
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} นาที`;
  const hours = Math.floor(minutes / 60);
  return `${hours} ชั่วโมง${minutes % 60 ? ` ${minutes % 60} นาที` : ""}`;
}

export function formatAlert(kind, { name, url, since, failures, reason, now }) {
  const head = {
    down: `🔴 <b>${SYSTEM} ล่ม</b>`,
    still_down: `🟠 <b>${SYSTEM} ยังล่มอยู่</b>`,
    up: `🟢 <b>${SYSTEM} กลับมาใช้งานได้</b>`,
    start: `ℹ️ <b>เริ่มเฝ้าระบบ ${SYSTEM}</b>`,
  }[kind];
  const lines = {
    down: [`${esc(name)}: ${esc(url)}`, `ตอบไม่ได้ตั้งแต่ ${clock(since)} น. (${failures} ครั้งติดกัน)`, `สาเหตุ: ${esc(reason)}`, "ตรวจ: cd ~/apps/stn-eoc && docker compose logs --tail=100 stn-atacs-app"],
    still_down: [`${esc(name)}: ${esc(url)}`, `ล่มมาแล้ว ${durationText(now - since)} (ตั้งแต่ ${clock(since)} น.)`, `สาเหตุล่าสุด: ${esc(reason)}`],
    up: [`${esc(name)}: ${esc(url)}`, `ล่มนาน ${durationText(now - since)} (${clock(since)} – ${clock(now)} น.)`],
    start: [esc(name), esc(reason)],
  }[kind];
  return [head, ...lines].join("\n");
}

async function probe(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "manual", headers: { "user-agent": "atacs-watchdog" } });
    if (response.status !== 200) return { ok: false, reason: `HTTP ${response.status}` };
    const body = await response.json().catch(() => null);
    if (body && body.status === "down") return { ok: false, reason: "ฐานข้อมูลไม่ตอบ" };
    return { ok: true, reason: "" };
  } catch (error) {
    const reason = error?.name === "AbortError" ? `ไม่ตอบภายใน ${Math.round(timeoutMs / 1000)} วินาที` : (error?.cause?.code || error?.cause?.message || error?.message || "เชื่อมต่อไม่ได้");
    return { ok: false, reason };
  } finally {
    clearTimeout(timer);
  }
}

async function sendTelegram(config, text) {
  if (!config.token || config.chatIds.length === 0) {
    console.warn("[watchdog] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set — logging only\n" + text.replace(/<[^>]+>/g, ""));
    return false;
  }
  let delivered = false;
  for (const chatId of config.chatIds) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
      });
      delivered = delivered || response.ok;
      if (!response.ok) console.warn(`[watchdog] Telegram HTTP ${response.status}`);
    } catch (error) {
      console.warn(`[watchdog] Telegram failed: ${error?.message ?? error}`);
    }
  }
  return delivered;
}

async function main() {
  const config = readConfig();
  const states = new Map(config.targets.map((target) => [target.url, { failures: 0, downSince: null, alerted: false, lastAlertAt: null }]));
  console.log(`[watchdog] watching ${config.targets.map((t) => t.url).join(", ")} every ${config.intervalMs / 1000}s`);
  const tick = async () => {
    for (const target of config.targets) {
      const now = Date.now();
      const result = await probe(target.url, config.timeoutMs);
      const { state, notify } = stepTarget(states.get(target.url), result, now, config);
      states.set(target.url, state);
      if (!result.ok) console.warn(`[watchdog] ${new Date(now).toISOString()} ${target.url} failed (${state.failures}): ${result.reason}`);
      if (notify) {
        const text = formatAlert(notify.kind, { ...target, ...notify, now });
        console.log(`[watchdog] ${notify.kind} ${target.url}`);
        await sendTelegram(config, text);
      }
    }
  };
  await tick();
  setInterval(() => void tick(), config.intervalMs);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error("[watchdog] fatal", error);
    process.exit(1);
  });
}
