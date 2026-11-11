/**
 * Visitor log + IP location — pure helpers (no database), ported from stn-eoc lib/visitorLog.js.
 *
 * Location comes from, in order:
 *  1) proxy/CDN headers (Cloudflare cf-ipcountry…, nginx GeoIP x-geo-*), if present
 *  2) a lookup service the admin configured: VISITOR_GEO_LOOKUP_URL, e.g. https://ipwho.is/{ip}
 *     (unset = IPs never leave the server). Internal addresses are never looked up.
 * IP location is approximate (city level, mobile networks often show Bangkok).
 */
export const DEFAULT_VISITOR_LOG_DAYS = 90;

export function visitorLogRetentionDays(env: Record<string, string | undefined> = process.env) {
  const value = Number.parseInt(env.VISITOR_LOG_RETENTION_DAYS || "", 10);
  return Number.isInteger(value) && value >= 7 && value <= 3650 ? value : DEFAULT_VISITOR_LOG_DAYS;
}

export type IpNetwork = "public" | "private" | "unknown";

export function classifyIp(ip: string | null | undefined): IpNetwork {
  let value = String(ip || "").trim().toLowerCase();
  if (!value || value === "unknown") return "unknown";
  if (value.startsWith("::ffff:")) value = value.slice(7);
  if (/^(10\.|127\.|192\.168\.|169\.254\.)/.test(value)) return "private";
  const match = value.match(/^172\.(\d+)\./);
  if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return "private";
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(value)) return "private"; // CGNAT
  if (value === "::1" || /^f[cd]/.test(value) || value.startsWith("fe80")) return "private";
  return "public";
}

/** Path to store: no base path, query or hash (may carry tokens), never API calls. */
export function cleanPath(value: string | null | undefined, basePath = ""): string | null {
  let path = String(value || "").split(/[?#]/)[0].trim();
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (basePath && (path === basePath || path.startsWith(`${basePath}/`))) path = path.slice(basePath.length) || "/";
  if (/[\s<>"'`]/.test(path)) return null;
  if (/^\/(api|_next)(\/|$)/.test(path)) return null;
  return path.slice(0, 255);
}

const PUBLIC_PAGES = /^\/($|public(\/|$)|login(\/|$)|register(\/|$)|scan\/assets\/|q\/|pending-approval(\/|$)|maintenance(\/|$)|agent-download(\/|$))/;

/** Pages anyone can open vs. the signed-in staff area. */
export function areaOf(path: string): "public" | "staff" {
  return PUBLIC_PAGES.test(path) ? "public" : "staff";
}

export function referrerHost(value: string | null | undefined, ownHost = ""): string | null {
  try {
    const host = new URL(String(value || "")).hostname.toLowerCase();
    if (!host || host === ownHost.toLowerCase()) return null;
    return host.slice(0, 120);
  } catch {
    return null;
  }
}

export function describeUserAgent(userAgent: string | null | undefined) {
  const ua = String(userAgent || "");
  const bot = /bot|crawler|spider|slurp|curl|wget|python|httpclient|headless|preview/i.test(ua);
  const device = /ipad|tablet|(android(?!.*mobile))/i.test(ua) ? "tablet" : /mobi|iphone|android/i.test(ua) ? "mobile" : ua ? "desktop" : "other";
  const browser = bot
    ? "บอท/สคริปต์"
    : /edg\//i.test(ua)
      ? "Edge"
      : /line\//i.test(ua)
        ? "LINE"
        : /fban|fbav/i.test(ua)
          ? "Facebook"
          : /samsungbrowser/i.test(ua)
            ? "Samsung Internet"
            : /chrome|crios/i.test(ua)
              ? "Chrome"
              : /firefox|fxios/i.test(ua)
                ? "Firefox"
                : /safari/i.test(ua)
                  ? "Safari"
                  : "อื่น ๆ";
  return { device, browser, bot };
}

export type IpGeo = { country: string; region: string | null; city: string | null; latitude: number | null; longitude: number | null; isp: string | null };

const text = (value: unknown, max: number) => {
  const clean = String(value ?? "").trim();
  if (!clean || clean === "XX" || clean === "T1") return null;
  try {
    return decodeURIComponent(clean).slice(0, max);
  } catch {
    return clean.slice(0, max);
  }
};
const coord = (value: unknown, limit: number) => {
  const number = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(number) && Math.abs(number) <= limit ? Number(number.toFixed(6)) : null;
};

type HeaderLike = { get(name: string): string | null };

export function geoFromHeaders(headers: HeaderLike): IpGeo | null {
  const get = (name: string) => headers.get(name);
  const country = text(get("cf-ipcountry") || get("x-geo-country"), 8);
  if (!country) return null;
  return {
    country,
    region: text(get("cf-region") || get("x-geo-region"), 80),
    city: text(get("cf-ipcity") || get("x-geo-city"), 80),
    latitude: coord(get("cf-iplatitude") || get("x-geo-latitude"), 90),
    longitude: coord(get("cf-iplongitude") || get("x-geo-longitude"), 180),
    isp: null,
  };
}

/** ipwho.is / ip-api.com / ipinfo.io answers → IpGeo. */
export function parseGeoLookup(json: unknown): IpGeo | null {
  if (!json || typeof json !== "object") return null;
  const data = json as Record<string, unknown>;
  if (data.success === false || data.status === "fail") return null;
  const [locLat, locLon] = String(data.loc || "").split(",");
  const country = text(data.country_code || data.countryCode || data.country, 8);
  if (!country) return null;
  const connection = (data.connection ?? {}) as Record<string, unknown>;
  return {
    country,
    region: text(data.region || data.regionName, 80),
    city: text(data.city, 80),
    latitude: coord(data.latitude ?? data.lat ?? locLat, 90),
    longitude: coord(data.longitude ?? data.lon ?? locLon, 180),
    isp: text(connection.isp || connection.org || data.isp || data.org, 120),
  };
}

export function geoLookupUrl(ip: string, env: Record<string, string | undefined> = process.env): string | null {
  const template = String(env.VISITOR_GEO_LOOKUP_URL || "").trim();
  if (!template || !/^https:\/\//i.test(template) || !template.includes("{ip}")) return null;
  if (classifyIp(ip) !== "public") return null;
  return template.replace("{ip}", encodeURIComponent(ip));
}

const PROVINCES: Record<string, string> = {
  bangkok: "กรุงเทพมหานคร", "krung thep maha nakhon": "กรุงเทพมหานคร", "amnat charoen": "อำนาจเจริญ", "ang thong": "อ่างทอง",
  "bueng kan": "บึงกาฬ", "buri ram": "บุรีรัมย์", buriram: "บุรีรัมย์", chachoengsao: "ฉะเชิงเทรา", "chai nat": "ชัยนาท",
  chaiyaphum: "ชัยภูมิ", chanthaburi: "จันทบุรี", "chiang mai": "เชียงใหม่", "chiang rai": "เชียงราย", "chon buri": "ชลบุรี",
  chonburi: "ชลบุรี", chumphon: "ชุมพร", kalasin: "กาฬสินธุ์", "kamphaeng phet": "กำแพงเพชร", kanchanaburi: "กาญจนบุรี",
  "khon kaen": "ขอนแก่น", krabi: "กระบี่", lampang: "ลำปาง", lamphun: "ลำพูน", loei: "เลย", "lop buri": "ลพบุรี", lopburi: "ลพบุรี",
  "mae hong son": "แม่ฮ่องสอน", "maha sarakham": "มหาสารคาม", mukdahan: "มุกดาหาร", "nakhon nayok": "นครนายก", "nakhon pathom": "นครปฐม",
  "nakhon phanom": "นครพนม", "nakhon ratchasima": "นครราชสีมา", "nakhon sawan": "นครสวรรค์", "nakhon si thammarat": "นครศรีธรรมราช",
  nan: "น่าน", narathiwat: "นราธิวาส", "nong bua lam phu": "หนองบัวลำภู", "nong bua lamphu": "หนองบัวลำภู", "nong khai": "หนองคาย",
  nonthaburi: "นนทบุรี", "pathum thani": "ปทุมธานี", pattani: "ปัตตานี", "phangnga": "พังงา", "phang nga": "พังงา", phatthalung: "พัทลุง",
  phayao: "พะเยา", phetchabun: "เพชรบูรณ์", phetchaburi: "เพชรบุรี", phichit: "พิจิตร", phitsanulok: "พิษณุโลก",
  "phra nakhon si ayutthaya": "พระนครศรีอยุธยา", ayutthaya: "พระนครศรีอยุธยา", phrae: "แพร่", phuket: "ภูเก็ต", "prachin buri": "ปราจีนบุรี",
  "prachuap khiri khan": "ประจวบคีรีขันธ์", ranong: "ระนอง", ratchaburi: "ราชบุรี", rayong: "ระยอง", "roi et": "ร้อยเอ็ด", "sa kaeo": "สระแก้ว",
  "sakon nakhon": "สกลนคร", "samut prakan": "สมุทรปราการ", "samut sakhon": "สมุทรสาคร", "samut songkhram": "สมุทรสงคราม", saraburi: "สระบุรี",
  satun: "สตูล", "si sa ket": "ศรีสะเกษ", sisaket: "ศรีสะเกษ", "sing buri": "สิงห์บุรี", songkhla: "สงขลา", sukhothai: "สุโขทัย",
  "suphan buri": "สุพรรณบุรี", "surat thani": "สุราษฎร์ธานี", surin: "สุรินทร์", tak: "ตาก", trang: "ตรัง", trat: "ตราด",
  "ubon ratchathani": "อุบลราชธานี", "udon thani": "อุดรธานี", "uthai thani": "อุทัยธานี", uttaradit: "อุตรดิตถ์", yala: "ยะลา", yasothon: "ยโสธร",
};

export function thaiProvinceName(region: string | null | undefined): string | null {
  const key = String(region || "").toLowerCase().replace(/^changwat\s+/, "").replace(/\s+province$/, "").trim();
  return PROVINCES[key] ?? null;
}

const COUNTRIES: Record<string, string> = {
  TH: "ไทย", MY: "มาเลเซีย", SG: "สิงคโปร์", US: "สหรัฐอเมริกา", CN: "จีน", HK: "ฮ่องกง", JP: "ญี่ปุ่น", KR: "เกาหลีใต้",
  VN: "เวียดนาม", ID: "อินโดนีเซีย", IN: "อินเดีย", DE: "เยอรมนี", GB: "สหราชอาณาจักร", NL: "เนเธอร์แลนด์", FR: "ฝรั่งเศส",
  RU: "รัสเซีย", LA: "ลาว", MM: "เมียนมา", KH: "กัมพูชา", AU: "ออสเตรเลีย", TW: "ไต้หวัน", PH: "ฟิลิปปินส์", BR: "บราซิล", CA: "แคนาดา",
};

export const countryName = (code: string | null | undefined) => (code ? COUNTRIES[code.toUpperCase()] ?? code : null);

export type GeoRow = { network?: string | null; country?: string | null; region?: string | null; city?: string | null } | null | undefined;

/** "Hat Yai, จ.สงขลา, ไทย" · "เครือข่ายภายใน" · "ไม่ทราบตำแหน่ง" · null row = "ยังไม่ได้ค้นหา" */
export function locationLabel(row: GeoRow): string {
  if (!row) return "ยังไม่ได้ค้นหา";
  if (row.network === "private") return "เครือข่ายภายใน";
  const province = row.country === "TH" ? thaiProvinceName(row.region) : null;
  const region = province ? (province === "กรุงเทพมหานคร" ? province : `จ.${province}`) : row.region || null;
  const city = row.city && (!province || thaiProvinceName(row.city) !== province) ? row.city : null;
  const country = countryName(row.country);
  const parts = [city, region !== city ? region : null, country].filter(Boolean);
  return parts.length ? parts.join(", ") : "ไม่ทราบตำแหน่ง";
}
