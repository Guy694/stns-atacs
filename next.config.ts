import type { NextConfig } from "next";

/**
 * SEC-22: security headers
 *
 * แหล่งภายนอกที่ระบบใช้จริงมีเพียง Leaflet (unpkg) และแผนที่พื้นหลังจาก OpenStreetMap
 * ที่เหลือบันเดิลมากับแอปทั้งหมด จึงล็อกได้แคบ
 *
 * หมายเหตุ 'unsafe-inline' ของ script-src: Next.js ฝังสคริปต์เริ่มต้นแบบ inline
 * (รวมสคริปต์ซ่อน splash ก่อน paint) การใช้ nonce ต้องเพิ่ม middleware และทำให้หน้าที่เป็น static
 * กลายเป็น dynamic ทั้งหมด จึงยังคง 'unsafe-inline' ไว้ก่อน — ส่วนที่กัน XSS ได้จริงคือ
 * การไม่ต่อสตริง HTML จากข้อมูลผู้ใช้ (ดู SEC-02) และ object-src/base-uri/frame-ancestors ด้านล่าง
 */
const LEAFLET_CDN = "https://unpkg.com";
const MAP_TILES = "https://*.tile.openstreetmap.org";
const IS_DEVELOPMENT = process.env.NODE_ENV === "development";

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${IS_DEVELOPMENT ? " 'unsafe-eval'" : ""} ${LEAFLET_CDN}`,
  `style-src 'self' 'unsafe-inline' ${LEAFLET_CDN}`,
  `img-src 'self' data: blob: ${LEAFLET_CDN} ${MAP_TILES}`,
  `connect-src 'self' ${LEAFLET_CDN} ${MAP_TILES}`,
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // กันการถูกฝังใน iframe ของเว็บอื่น (clickjacking)
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
];

/** HSTS ส่งเฉพาะ production (เบราว์เซอร์มองข้ามเมื่อมาทาง http อยู่แล้ว แต่ไม่ส่งตอน dev จะสะอาดกว่า) */
const HSTS_HEADER = { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" };

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (ignored by Vercel).
  output: "standalone",
  // Tiny QR stickers encode the URL in upper case (smaller QR); the short path is matched case-sensitively.
  async rewrites() {
    return [{ source: "/Q/:id(\\d+)", destination: "/q/:id" }];
  },
  async headers() {
    const headers = process.env.NODE_ENV === "production" ? [...SECURITY_HEADERS, HSTS_HEADER] : SECURITY_HEADERS;
    return [{ source: "/:path*", headers }];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
