import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { loginWithPasswordAction, registerOfficerWithPasswordAction } from "@/app/auth/actions";
import { listAllFacilitiesForSelect } from "@/lib/assets";
import { getCurrentUser } from "@/lib/auth";
import { getGoogleAuthStatus } from "@/lib/google-auth";
import { getThaiIdStatus } from "@/lib/thaiid";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readQueryValue(value: string | string[] | undefined) {
  if (!value) return "";
  return Array.isArray(value) ? value[0] : value;
}

function safeNextPath(value: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  if (value.includes("\\")) return "/dashboard";
  return value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = safeNextPath(readQueryValue(params.next));
  const user = await getCurrentUser();
  if (user) redirect(nextPath);

  const error = readQueryValue(params.error);
  const notice = readQueryValue(params.notice);
  const isThaiDTab = readQueryValue(params.thaid) === "1";
  const isOfficerRegistration = readQueryValue(params.register) === "1";
  const thaiIdStatus = await getThaiIdStatus();
  const googleAuthStatus = getGoogleAuthStatus();
  const hasAltLogin = thaiIdStatus.enabled || googleAuthStatus.enabled;
  const facilities = isOfficerRegistration ? await listAllFacilitiesForSelect() : [];
  const showTestCredentials = process.env.NODE_ENV !== "production";

  return (
    <div className="min-h-screen flex" style={{ background: "var(--background)" }}>

      {/* ── Left panel (decorative) ─────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[46%] p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(145deg, #14532d 0%, #15803d 50%, #16a34a 100%)" }}
      >
        {/* Floating circles */}
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full opacity-20"
          style={{ background: "rgba(134,239,172,0.42)" }} />
        <div className="absolute top-1/3 -right-16 w-64 h-64 rounded-full opacity-15"
          style={{ background: "rgba(187,247,208,0.48)" }} />
        <div className="absolute -bottom-10 left-1/4 w-48 h-48 rounded-full opacity-20"
          style={{ background: "rgba(74,222,128,0.58)" }} />

        {/* Logo area */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-[var(--accent)]/20 flex items-center justify-center text-lg">
              <Image src="/logo.png" alt="ATACS Satun Logo" width={48} height={48} className="h-12 w-12 object-contain" />
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-tight">ATACS</p>
              <p className="text-emerald-100 text-xs">Asset Tracking and Control System</p>
            </div>
          </div>
          <h2 className="text-white text-6xl font-bold leading-snug">
            ระบบทะเบียน<br />ทรัพย์สินสารสนเทศ<br />จังหวัดสตูล
          </h2>
          <p className="text-emerald-100 mt-4 text-sm leading-7">
            สำนักงานสาธารณสุขจังหวัดสตูล
          </p>
     
        </div>

        {/* Stats strip */}
        <div className="relative z-10 grid grid-cols-3 gap-4">
          {[
            { label: "หน่วยบริการ", value: "80+" },
            { label: "ทรัพย์สิน", value: "2,000+" },
            { label: "อำเภอ", value: "7" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl p-4 text-center"
              style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)" }}>
              <p className="text-white text-2xl font-bold">{s.value}</p>
              <p className="text-emerald-100 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Bottom link */}
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-2 text-emerald-100 hover:text-white transition text-sm">
            <span>←</span> ดู Public Dashboard
          </Link>
        </div>
      </div>

      {/* ── Right panel (form) ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 sm:px-12">

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <div className="w-20 h-20 rounded-2xl bg-[var(--accent)]/20 flex items-center justify-center text-lg">
            <Image src="/logo.png" alt="ATACS Satun Logo" width={56} height={56} className="h-14 w-14 object-contain" />
          </div>
          <div>
            <p className="font-bold" style={{ color: "var(--foreground)" }}>ATACS Satun</p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>ระบบทะเบียนทรัพย์สิน สารสนเทศในสังกัด สป. จังหวัดสตูล</p>
          </div>
        </div>

        <div className="w-full max-w-md">
          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
              {isOfficerRegistration ? "ลงทะเบียนเจ้าหน้าที่" : "เข้าสู่ระบบ"}
            </h1>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              {isOfficerRegistration
                ? "กรอกข้อมูลให้ครบถ้วน จากนั้นรอผู้ดูแลระบบอนุมัติการเข้าใช้งาน"
                : "ยินดีต้อนรับกลับ — กรอก Username และรหัสผ่านเพื่อเข้าใช้งาน"}
            </p>
          </div>

          {/* Alerts */}
          {notice && (
            <div className="mb-5 rounded-2xl px-4 py-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 flex items-start gap-2">
              <span>✓</span><span>{notice}</span>
            </div>
          )}
          {error && (
            <div className="mb-5 rounded-2xl px-4 py-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 flex items-start gap-2">
              <span>⚠</span><span>{error}</span>
            </div>
          )}

          {/* Card */}
          <div className="rounded-3xl p-7 space-y-5"
            style={{
              background: "white",
              border: "1px solid var(--line)",
              boxShadow: "0 20px 60px rgba(22,163,74,0.12)",
            }}>

            {isOfficerRegistration ? (
              <>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  แบบฟอร์มนี้สำหรับเจ้าหน้าที่หน่วยบริการ บัญชีจะยังเข้าใช้งานไม่ได้จนกว่าแอดมินอนุมัติ
                </div>
                <form action={registerOfficerWithPasswordAction} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="registerFullName" className="text-sm font-semibold">ชื่อ-นามสกุล</label>
                    <input
                      id="registerFullName"
                      name="fullName"
                      type="text"
                      autoComplete="name"
                      required
                      minLength={3}
                      className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                      style={{ borderColor: "var(--line)" }}
                      placeholder="ชื่อและนามสกุลจริง"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="registerEmail" className="text-sm font-semibold">อีเมล</label>
                    <input
                      id="registerEmail"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                      style={{ borderColor: "var(--line)" }}
                      placeholder="name@example.go.th"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="registerOfficerPosition" className="text-sm font-semibold">ตำแหน่งเจ้าหน้าที่</label>
                    <input
                      id="registerOfficerPosition"
                      name="officerPosition"
                      type="text"
                      required
                      minLength={2}
                      maxLength={150}
                      className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                      style={{ borderColor: "var(--line)" }}
                      placeholder="เช่น นักวิชาการคอมพิวเตอร์"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="registerFacility" className="text-sm font-semibold">หน่วยงานที่สังกัด</label>
                    <select
                      id="registerFacility"
                      name="facilityId"
                      required
                      className="w-full rounded-2xl border bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                      style={{ borderColor: "var(--line)" }}
                    >
                      <option value="">— เลือกหน่วยงาน —</option>
                      {facilities.map((facility) => (
                        <option key={facility.id} value={facility.id}>
                          {facility.facility_name}{facility.district_name ? ` · อ.${facility.district_name}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="registerUsername" className="text-sm font-semibold">Username</label>
                    <input
                      id="registerUsername"
                      name="username"
                      type="text"
                      autoComplete="username"
                      required
                      minLength={4}
                      maxLength={50}
                      pattern="[a-zA-Z0-9._-]+"
                      className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                      style={{ borderColor: "var(--line)" }}
                      placeholder="เช่น somchai.j"
                    />
                    <p className="text-xs text-[var(--muted)]">ใช้ตัวอักษรอังกฤษ ตัวเลข จุด ขีดกลาง หรือขีดล่าง</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label htmlFor="registerPassword" className="text-sm font-semibold">รหัสผ่าน</label>
                      <input
                        id="registerPassword"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={10}
                        className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                        style={{ borderColor: "var(--line)" }}
                        placeholder="อย่างน้อย 10 ตัว"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="registerConfirmPassword" className="text-sm font-semibold">ยืนยันรหัสผ่าน</label>
                      <input
                        id="registerConfirmPassword"
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={10}
                        className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                        style={{ borderColor: "var(--line)" }}
                        placeholder="กรอกซ้ำอีกครั้ง"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-[var(--accent-strong)] py-3 text-sm font-bold text-white transition hover:opacity-90 active:scale-[0.98]"
                  >
                    ส่งคำขอลงทะเบียน
                  </button>
                </form>
                <div className="text-center">
                  <Link href="/login" className="text-sm font-semibold hover:underline" style={{ color: "var(--accent)" }}>
                    ← กลับหน้าเข้าสู่ระบบ
                  </Link>
                </div>
              </>
            ) : isThaiDTab && thaiIdStatus.enabled ? (
              <>
                <div className="flex items-center gap-3 p-3 rounded-2xl"
                  style={{ background: "rgba(22,163,74,0.08)" }}>
                  <span className="text-2xl">🪪</span>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    ยืนยันตัวตนด้วย ThaiD ผ่าน DOPA OAuth 2.0 — หากยังไม่มีบัญชีจะพาไปสมัครสมาชิกอัตโนมัติ
                  </p>
                </div>
                <>
                  <Link
                    href="/api/auth/thaiid/authorize"
                    className="flex items-center justify-center gap-2 w-full rounded-2xl py-3 text-sm font-bold text-white transition hover:opacity-90 active:scale-[0.98]"
                    style={{ background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)", boxShadow: "0 4px 16px rgba(21,128,61,0.28)" }}
                  >
                    🪪 ดำเนินการผ่าน ThaiD →
                  </Link>
                  <p className="text-xs text-center" style={{ color: "var(--muted)" }}>
                    หากไม่พบข้อมูลผู้ใช้งาน ระบบจะพาไปหน้าสมัครสมาชิกอัตโนมัติ
                  </p>
                </>
                <div className="text-center">
                  <Link href="/login" className="text-sm font-semibold hover:underline" style={{ color: "var(--accent)" }}>
                    ← กลับเข้าสู่ระบบด้วย Username
                  </Link>
                </div>
              </>
            ) : (
              <>
                <form action={loginWithPasswordAction} className="space-y-4">
                  <input type="hidden" name="next" value={nextPath} />
                  <div className="space-y-1.5">
                    <label htmlFor="username" className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      Username
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">👤</span>
                      <input
                        id="username"
                        name="username"
                        type="text"
                        autoComplete="username"
                        required
                        className="w-full rounded-2xl border pl-11 pr-4 py-3 text-sm outline-none transition"
                        style={{ borderColor: "var(--line)", color: "var(--foreground)" }}
                        placeholder="ชื่อผู้ใช้งาน"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="password" className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      รหัสผ่าน
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">🔒</span>
                      <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        className="w-full rounded-2xl border pl-11 pr-4 py-3 text-sm outline-none transition"
                        style={{ borderColor: "var(--line)", color: "var(--foreground)" }}
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-2xl py-3 text-sm font-bold text-white transition hover:opacity-90 active:scale-[0.98]"
                    style={{ background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)", boxShadow: "0 4px 16px rgba(21,128,61,0.28)" }}
                  >
                    เข้าสู่ระบบ →
                  </button>
                </form>

                {showTestCredentials ? (
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900">
                    <p className="font-semibold">บัญชีทดสอบ (สำหรับ Development)</p>
                    <ul className="mt-2 space-y-1.5">
                      <li>
                        <span className="font-medium">Admin:</span> username <code className="rounded bg-white px-1.5 py-0.5">atacs_admin</code> / password <code className="rounded bg-white px-1.5 py-0.5">Admin@2026</code>
                      </li>
                      <li>
                        <span className="font-medium">Officer:</span> username <code className="rounded bg-white px-1.5 py-0.5">nakharin</code> / password <code className="rounded bg-white px-1.5 py-0.5">Officer@2026</code>
                      </li>
                    </ul>
                  </div>
                ) : null}

                {hasAltLogin ? (
                  <>
                    {/* Divider */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px" style={{ background: "var(--line)" }} />
                      <span className="text-xs" style={{ color: "var(--muted)" }}>หรือ</span>
                      <div className="flex-1 h-px" style={{ background: "var(--line)" }} />
                    </div>

                    {/* ThaiD button */}
                    {thaiIdStatus.enabled ? (
                      <Link
                        href={`/login?thaid=1${nextPath !== "/" ? `&next=${encodeURIComponent(nextPath)}` : ""}`}
                        className="flex items-center justify-center gap-2 w-full rounded-2xl py-3 text-sm font-bold transition hover:opacity-80 active:scale-[0.98]"
                        style={{
                          border: "2px solid var(--accent)",
                          color: "var(--accent)",
                          background: "rgba(21,128,61,0.06)",
                        }}
                      >
                        <Image src="/thaid.png" alt="ThaiD" width={32} height={32} className="h-8 w-8 rounded-full" /> เข้าสู่ระบบด้วย ThaiD
                      </Link>
                    ) : null}

                    {googleAuthStatus.enabled ? (
                      <Link
                        href={`/api/auth/google/authorize${nextPath !== "/" ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
                        className="flex items-center justify-center gap-3 w-full rounded-2xl border border-stone-300 bg-white py-3 text-sm font-bold text-stone-700 transition hover:bg-stone-50 active:scale-[0.98]"
                      >
                        <span className="text-lg font-bold text-blue-600">G</span>
                        เข้าสู่ระบบด้วย Gmail
                      </Link>
                    ) : null}
                  </>
                ) : null}

                <p className="text-xs text-center" style={{ color: "var(--muted)" }}>
                  หากอีเมล Google ยังไม่มีในระบบ ระบบจะพาไปลงทะเบียนและรอแอดมินอนุมัติ
                </p>

                <Link
                  href={`/login?register=1${nextPath !== "/" ? `&next=${encodeURIComponent(nextPath)}` : ""}`}
                  className="flex items-center justify-center gap-2 w-full rounded-2xl border border-emerald-300 bg-emerald-50 py-3 text-sm font-bold text-emerald-800 transition hover:bg-emerald-100 active:scale-[0.98]"
                >
                  ลงทะเบียนเจ้าหน้าที่ใหม่ →
                </Link>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 text-center text-sm" style={{ color: "var(--muted)" }}>
            <Link href="/" className="font-semibold hover:underline" style={{ color: "var(--accent)" }}>
              ← กลับหน้า Public Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
