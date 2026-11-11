import assert from "node:assert/strict";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const v = loadTs("lib/visitor-log.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));

test("classifies private, CGNAT, loopback and public addresses", () => {
  for (const ip of ["10.1.2.3", "192.168.0.51", "172.20.0.4", "127.0.0.1", "100.64.1.1", "::1", "fd00::1", "::ffff:192.168.1.5"]) {
    assert.equal(v.classifyIp(ip), "private", ip);
  }
  assert.equal(v.classifyIp("172.32.0.1"), "public");
  assert.equal(v.classifyIp("203.150.12.9"), "public");
  assert.equal(v.classifyIp("2001:4860::8888"), "public");
  assert.equal(v.classifyIp(""), "unknown");
  assert.equal(v.classifyIp("unknown"), "unknown");
});

test("cleanPath strips the base path, query and hash, and rejects junk", () => {
  assert.equal(v.cleanPath("/stns-atacs/assets/12/?tab=1#x", "/stns-atacs"), "/assets/12/");
  assert.equal(v.cleanPath("/stns-atacs", "/stns-atacs"), "/");
  assert.equal(v.cleanPath("/scan/assets/5/", ""), "/scan/assets/5/");
  assert.equal(v.cleanPath("https://evil.example/x", ""), null);
  assert.equal(v.cleanPath("/a<script>", ""), null);
  assert.equal(v.cleanPath("/api/health/", ""), null, "API calls are not page views");
  assert.equal(v.cleanPath("/" + "a".repeat(400), "").length, 255);
});

test("areaOf: anonymous-facing pages are public, the rest staff", () => {
  for (const path of ["/", "/public/", "/login/", "/register/", "/scan/assets/7/", "/q/7", "/pending-approval/", "/maintenance/"]) {
    assert.equal(v.areaOf(path), "public", path);
  }
  for (const path of ["/dashboard/", "/assets/", "/scan/", "/admin/security/", "/agent-monitor/"]) {
    assert.equal(v.areaOf(path), "staff", path);
  }
});

test("user agent → device, browser, bot", () => {
  assert.deepEqual(plain(v.describeUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Version/17.0 Mobile Safari/604.1")), { device: "mobile", browser: "Safari", bot: false });
  assert.deepEqual(plain(v.describeUserAgent("Mozilla/5.0 (Windows NT 10.0) AppleWebKit Chrome/130 Safari/537.36 Edg/130")), { device: "desktop", browser: "Edge", bot: false });
  assert.deepEqual(plain(v.describeUserAgent("Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari Line/14.1")), { device: "mobile", browser: "LINE", bot: false });
  assert.equal(v.describeUserAgent("Googlebot/2.1 (+http://www.google.com/bot.html)").bot, true);
  assert.equal(v.describeUserAgent("").device, "other");
});

test("parses ipwho.is / ip-api.com / ipinfo.io answers", () => {
  assert.deepEqual(plain(v.parseGeoLookup({ success: true, country_code: "TH", region: "Satun", city: "Satun", latitude: 6.6238, longitude: 100.0674, connection: { isp: "TOT Public Company Limited" } })), {
    country: "TH", region: "Satun", city: "Satun", latitude: 6.6238, longitude: 100.0674, isp: "TOT Public Company Limited",
  });
  assert.deepEqual(plain(v.parseGeoLookup({ status: "success", countryCode: "SG", regionName: "Central", city: "Singapore", lat: 1.29, lon: 103.85, isp: "DigitalOcean" })), {
    country: "SG", region: "Central", city: "Singapore", latitude: 1.29, longitude: 103.85, isp: "DigitalOcean",
  });
  assert.equal(plain(v.parseGeoLookup({ country: "US", region: "California", city: "Mountain View", loc: "37.4,-122.07", org: "AS15169 Google LLC" })).isp, "AS15169 Google LLC");
  assert.equal(v.parseGeoLookup({ success: false, message: "Reserved range" }), null);
  assert.equal(v.parseGeoLookup(null), null);
});

test("lookup URL: https template with {ip}, public addresses only", () => {
  assert.equal(v.geoLookupUrl("203.150.12.9", { VISITOR_GEO_LOOKUP_URL: "https://ipwho.is/{ip}" }), "https://ipwho.is/203.150.12.9");
  assert.equal(v.geoLookupUrl("192.168.1.2", { VISITOR_GEO_LOOKUP_URL: "https://ipwho.is/{ip}" }), null);
  assert.equal(v.geoLookupUrl("203.150.12.9", { VISITOR_GEO_LOOKUP_URL: "http://ipwho.is/{ip}" }), null, "never send IPs over plain http");
  assert.equal(v.geoLookupUrl("203.150.12.9", {}), null);
});

test("Thai labels: province names in Thai, internal network, unknown", () => {
  assert.equal(v.locationLabel({ network: "public", country: "TH", region: "Satun", city: "Satun" }), "จ.สตูล, ไทย");
  assert.equal(v.locationLabel({ network: "public", country: "TH", region: "Changwat Songkhla", city: "Hat Yai" }), "Hat Yai, จ.สงขลา, ไทย");
  assert.equal(v.locationLabel({ network: "public", country: "TH", region: "Bangkok", city: "Bangkok" }), "กรุงเทพมหานคร, ไทย");
  assert.equal(v.locationLabel({ network: "public", country: "SG", region: "Central", city: "Singapore" }), "Singapore, Central, สิงคโปร์");
  assert.equal(v.locationLabel({ network: "private" }), "เครือข่ายภายใน");
  assert.equal(v.locationLabel({ network: "public" }), "ไม่ทราบตำแหน่ง");
  assert.equal(v.locationLabel(null), "ยังไม่ได้ค้นหา");
  assert.equal(v.thaiProvinceName("Phra Nakhon Si Ayutthaya"), "พระนครศรีอยุธยา");
  assert.equal(v.thaiProvinceName("Nowhere"), null);
});

test("retention defaults to 90 days and stays within sane bounds", () => {
  assert.equal(v.visitorLogRetentionDays({}), 90);
  assert.equal(v.visitorLogRetentionDays({ VISITOR_LOG_RETENTION_DAYS: "180" }), 180);
  assert.equal(v.visitorLogRetentionDays({ VISITOR_LOG_RETENTION_DAYS: "1" }), 90);
});
