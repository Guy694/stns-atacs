/**
 * G9: จำกัดการลงทะเบียน Agent โดยไม่บล็อกการติดตั้งจำนวนมากหลัง NAT เดียวกัน
 * - นับ "ครั้งที่ล้มเหลว" (token/install key ผิด) ต่อ IP — ด่านกันเดาคีย์
 * - การลงทะเบียนที่สำเร็จนับต่อหน่วยงาน/enrollment ด้วยเพดานสูง — กัน key รั่วแล้วถูกใช้สร้างเครื่องปลอมจำนวนมาก
 * เก็บในหน่วยความจำของโปรเซส (เหมือน lib/rate-limit.ts) ใช้เป็นด่านแรกเท่านั้น
 */

export const ENROLL_WINDOW_MS = 10 * 60 * 1000;
export const ENROLL_FAILURE_LIMIT = 10;
export const ENROLL_SUCCESS_LIMIT = 300;
const MAX_KEYS = 5000;

const failures = new Map<string, number[]>();
const successes = new Map<string, number[]>();

export type EnrollLimitResult = { allowed: boolean; retryAfterSeconds: number };

function recent(store: Map<string, number[]>, key: string, now: number) {
  const hits = (store.get(key) ?? []).filter((at) => now - at < ENROLL_WINDOW_MS);
  if (hits.length) store.set(key, hits);
  else store.delete(key);
  return hits;
}

function check(store: Map<string, number[]>, key: string, limit: number, now: number): EnrollLimitResult {
  const hits = recent(store, key, now);
  if (hits.length < limit) return { allowed: true, retryAfterSeconds: 0 };
  return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((ENROLL_WINDOW_MS - (now - hits[0])) / 1000)) };
}

function record(store: Map<string, number[]>, key: string, now: number) {
  if (!store.has(key) && store.size >= MAX_KEYS) {
    for (const existing of [...store.keys()]) recent(store, existing, now);
    if (store.size >= MAX_KEYS) store.delete(store.keys().next().value as string);
  }
  const hits = recent(store, key, now);
  hits.push(now);
  store.set(key, hits);
}

export function enrollFailureAllowed(ip: string, now = Date.now()) {
  return check(failures, ip, ENROLL_FAILURE_LIMIT, now);
}

export function recordEnrollFailure(ip: string, now = Date.now()) {
  record(failures, ip, now);
}

export function enrollSuccessAllowed(scope: string, now = Date.now()) {
  return check(successes, scope, ENROLL_SUCCESS_LIMIT, now);
}

export function recordEnrollSuccess(scope: string, now = Date.now()) {
  record(successes, scope, now);
}

/** สำหรับเทสต์เท่านั้น */
export function resetEnrollLimits() {
  failures.clear();
  successes.clear();
}
