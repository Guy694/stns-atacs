import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { loginWithPasswordAction, registerOfficerWithPasswordAction } from "@/app/auth/actions";
import { countAssets, listAllFacilitiesForSelect } from "@/lib/assets";
import { FacilitySelect } from "@/app/_components/ui/facility-select";
import { AppIcon } from "@/app/_components/ui/icon";
import { PhotoBackdrop } from "@/app/_components/ui/photo-backdrop";
import { APP_NAME, APP_SCOPE, APP_TAGLINE } from "@/lib/app-brand";
import { getCurrentUser } from "@/lib/auth";
import { withBasePath } from "@/lib/base-path";
import { safeNextPath } from "@/lib/input-guards";
import { getGoogleAuthStatus } from "@/lib/google-auth";
import { getThaiIdStatus } from "@/lib/thaiid";
import { SubmitButton } from "@/app/_components/ui/submit-button";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readQueryValue(value: string | string[] | undefined) {
  if (!value) return "";
  return Array.isArray(value) ? value[0] : value;
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
  // A4: test accounts are shown only when explicitly enabled (never by default on a dev or staging server).
  // A3: real figures instead of fixed marketing numbers; the strip is hidden if they cannot be read.
  const loginStats = await Promise.all([listAllFacilitiesForSelect(), countAssets()])
    .then(([allFacilities, assetCount]) => ({
      facilities: allFacilities.length.toLocaleString("th-TH"),
      assets: assetCount.toLocaleString("th-TH"),
      districts: new Set(allFacilities.map((facility) => facility.district_name).filter(Boolean)).size.toLocaleString("th-TH"),
    }))
    .catch(() => null);
  const showTestCredentials = process.env.NODE_ENV !== "production" && process.env.SHOW_TEST_ACCOUNTS === "1";

  return (
    <div className="min-h-screen flex" style={{ background: "var(--background)" }}>

      {/* ── Left panel (decorative) ─────────────────────────────────── */}
      {/* Full-bleed photo under a solid brand-blue veil: white text stays above 7:1 everywhere on the panel. */}
      <div className="hidden lg:flex flex-col justify-between w-[46%] p-12 relative isolate overflow-hidden bg-[#0f3f6b]">
        <PhotoBackdrop image="it-storage" opacity="opacity-60" fade="none" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[#0f3f6b]/80" />

        {/* Logo area */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-[var(--accent)]/20 flex items-center justify-center text-lg">
              <Image src={withBasePath("/logo.png")} alt="ATACS Satun Logo" width={48} height={48} className="h-12 w-12 object-contain" />
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-tight">ATACS</p>
              <p className="text-sky-100 text-xs">{APP_TAGLINE}</p>
            </div>
          </div>
          <h2 className="text-white text-6xl font-bold leading-snug">
            ระบบทะเบียน<br />ทรัพย์สินและครุภัณฑ์<br />จังหวัดสตูล
          </h2>
          <p className="text-sky-100 mt-4 text-sm leading-7">
            สำนักงานสาธารณสุขจังหวัดสตูล
          </p>
     
        </div>

        {/* Stats strip */}
        {loginStats && (
        <div className="relative z-10 grid grid-cols-3 gap-4">
          {[
            { label: "หน่วยบริการ", value: loginStats.facilities },
            { label: "ทรัพย์สิน", value: loginStats.assets },
            { label: "อำเภอ", value: loginStats.districts },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/15 bg-[#0b3357]/70 p-4 text-center">
              <p className="text-white text-2xl font-bold">{s.value}</p>
              <p className="text-sky-100 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
        )}

        {/* Bottom link */}
        {/* <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-2 text-sky-100 hover:text-white transition text-sm">
            <span>←</span> ดูหน้าข้อมูลสาธารณะ
          </Link>
        </div> */}
      </div>

      {/* ── Right panel (form) ──────────────────────────────────────── */}
      <div className="relative isolate flex-1 flex flex-col items-center justify-center overflow-hidden px-6 py-10 sm:px-12">
        {/* Phones and tablets have no photo panel: a faint strip of the same photo behind the logo only. */}
        <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-56 overflow-hidden lg:hidden">
          <PhotoBackdrop image="it-storage" opacity="opacity-[0.14]" fade="bottom" />
        </div>

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <div className="w-20 h-20 rounded-2xl bg-[var(--accent)]/20 flex items-center justify-center text-lg">
            <Image src={withBasePath("/logo.png")} alt="ATACS Satun Logo" width={56} height={56} className="h-14 w-14 object-contain" />
          </div>
          <div>
            <p className="font-bold" style={{ color: "var(--foreground)" }}>ATACS Satun</p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>{APP_NAME} · {APP_SCOPE}</p>
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
                : ""}
            </p>
          </div>

          {/* Alerts */}
          {notice && (
            <div className="mb-5 rounded-2xl px-4 py-3 text-sm text-[var(--state-info-fg)] bg-[var(--state-info-bg)] border border-[var(--state-info-border)] flex items-start gap-2">
              <AppIcon name="check" className="mt-0.5 h-4 w-4 shrink-0" /><span>{notice}</span>
            </div>
          )}
          {error && (
            <div className="mb-5 rounded-2xl px-4 py-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 flex items-start gap-2">
              <AppIcon name="warning" className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
            </div>
          )}

          {/* Card */}
          <div className="rounded-3xl p-7 space-y-5"
            style={{
              background: "white",
              border: "1px solid var(--line)",
              boxShadow: "0 20px 60px rgba(22,135,217,0.12)",
            }}>

            {isOfficerRegistration ? (
              <>
                <div className="rounded-2xl border border-[var(--state-info-border)] bg-[var(--state-info-bg)] px-4 py-3 text-sm text-[var(--state-info-fg)]">
                  แบบฟอร์มนี้สำหรับเจ้าหน้าที่หน่วยบริการ บัญชีจะยังเข้าใช้งานไม่ได้จนกว่าแอดมินอนุมัติ
                </div>
                <form action={registerOfficerWithPasswordAction} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label htmlFor="registerFirstName" className="text-sm font-semibold">ชื่อ</label>
                      <input
                        id="registerFirstName"
                        name="firstName"
                        type="text"
                        autoComplete="given-name"
                        required
                        className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                        style={{ borderColor: "var(--line)" }}
                        placeholder="ชื่อจริง"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="registerLastName" className="text-sm font-semibold">นามสกุล</label>
                      <input
                        id="registerLastName"
                        name="lastName"
                        type="text"
                        autoComplete="family-name"
                        required
                        className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                        style={{ borderColor: "var(--line)" }}
                        placeholder="นามสกุล"
                      />
                    </div>
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
                    <FacilitySelect
                      id="registerFacility"
                      name="facilityId"
                      required
                      className="[&_input]:min-h-12 [&_input]:rounded-2xl [&_input]:text-sm"
                      facilities={facilities.map((facility) => ({
                        id: facility.id,
                        name: facility.facility_name,
                        typecode: facility.typecode,
                        districtName: facility.district_name ? `อ.${facility.district_name}` : "",
                      }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="registerUsername" className="text-sm font-semibold">ชื่อผู้ใช้</label>
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
                  <SubmitButton pendingText="กำลังส่งคำขอ…"
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent-strong)] py-3 text-sm font-bold text-white transition-colors duration-200 hover:bg-[#125b86] disabled:opacity-60"
                  >
                    <AppIcon name="check" className="h-4 w-4" /> ส่งคำขอลงทะเบียน
                  </SubmitButton>
                </form>
                <div className="text-center">
                  <Link href="/login" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[var(--accent-strong)] hover:underline">
                    <AppIcon name="arrow-left" className="h-4 w-4" /> กลับหน้าเข้าสู่ระบบ
                  </Link>
                </div>
              </>
            ) : isThaiDTab && thaiIdStatus.enabled ? (
              <>
                <div className="flex items-center gap-3 p-3 rounded-2xl"
                  style={{ background: "var(--primary-soft)" }}>
                  <AppIcon name="shield" aria-hidden="true" className="h-7 w-7 shrink-0 text-[var(--primary)]" />
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    ยืนยันตัวตนด้วย ThaiD หากยังไม่มีบัญชีจะพาไปสมัครสมาชิกอัตโนมัติ
                  </p>
                </div>
                <>
                  <a
                    href={withBasePath("/api/auth/thaiid/authorize/")}
                    className="flex items-center justify-center gap-2 w-full rounded-2xl bg-[var(--accent-strong)] py-3 text-sm font-bold text-white transition-colors duration-200 hover:bg-[#125b86]"
                  >
                    <AppIcon name="shield" className="h-4 w-4" /> ดำเนินการผ่าน ThaiD
                  </a>
                  <p className="text-xs text-center" style={{ color: "var(--muted)" }}>
                    หากไม่พบข้อมูลผู้ใช้งาน ระบบจะพาไปหน้าสมัครสมาชิกอัตโนมัติ
                  </p>
                </>
                
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
                      <AppIcon name="users" aria-hidden="true" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--muted)]" />
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
                      <AppIcon name="key" aria-hidden="true" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--muted)]" />
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
                  <SubmitButton pendingText="กำลังเข้าสู่ระบบ…"
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent-strong)] py-3 text-sm font-bold text-white transition-colors duration-200 hover:bg-[#125b86] disabled:opacity-60"
                  >
                    <AppIcon name="key" className="h-4 w-4" /> เข้าสู่ระบบ
                  </SubmitButton>
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
                        className="flex items-center justify-center gap-2 w-full rounded-2xl border border-[var(--primary-soft-strong)] bg-white py-3 text-sm font-bold text-[var(--accent-strong)] transition-colors duration-200 hover:bg-[var(--primary-soft)]"
                      >
                        <Image src={withBasePath("/thaid.png")} alt="ThaiD" width={32} height={32} className="h-8 w-8 rounded-full" /> เข้าสู่ระบบด้วย ThaiD
                      </Link>
                    ) : null}

                    {googleAuthStatus.enabled ? (
                      <a
                        href={withBasePath(`/api/auth/google/authorize/${nextPath !== "/" ? `?next=${encodeURIComponent(nextPath)}` : ""}`)}
                        className="flex items-center justify-center gap-3 w-full rounded-2xl border border-stone-300 bg-white py-3 text-sm font-bold text-stone-700 transition-colors duration-200 hover:bg-stone-50"
                      >
                        <span className="text-lg font-bold text-blue-600">G</span>
                        เข้าสู่ระบบด้วย Gmail
                      </a>
                    ) : null}
                  </>
                ) : null}

                {/* <p className="text-xs text-center" style={{ color: "var(--muted)" }}>
                  หากอีเมล Google ยังไม่มีในระบบ ระบบจะพาไปลงทะเบียนและรอแอดมินอนุมัติ
                </p> */}

                <Link
                  href={`/login?register=1${nextPath !== "/" ? `&next=${encodeURIComponent(nextPath)}` : ""}`}
                  className="flex items-center justify-center gap-2 w-full rounded-2xl border border-[var(--primary-soft-strong)] bg-[var(--primary-soft)] py-3 text-sm font-bold text-[var(--primary-text)] transition-colors duration-200 hover:bg-[var(--primary-soft-strong)]"
                >
                  <AppIcon name="user" className="h-4 w-4" /> ลงทะเบียนเจ้าหน้าที่ใหม่
                </Link>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 text-center text-sm" style={{ color: "var(--muted)" }}>
            <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-[var(--accent-strong)] hover:underline">
              <AppIcon name="arrow-left" className="h-4 w-4" /> กลับหน้าข้อมูลสาธารณะ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
