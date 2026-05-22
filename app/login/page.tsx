import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { loginWithPasswordAction } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/auth";
import { getThaiIdStatus } from "@/lib/thaiid";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readQueryValue(value: string | string[] | undefined) {
  if (!value) return "";
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const params = await searchParams;
  const error = readQueryValue(params.error);
  const notice = readQueryValue(params.notice);
  const isThaiDTab = readQueryValue(params.thaid) === "1";
  const thaiIdStatus = getThaiIdStatus();

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
              <p className="text-emerald-100 text-xs">Satun Health IT Assets</p>
            </div>
          </div>
          <h2 className="text-white text-3xl font-bold leading-snug">
            ระบบทะเบียน<br />ทรัพย์สินสารสนเทศ<br />จังหวัดสตูล
          </h2>
          <p className="text-emerald-100 mt-4 text-sm leading-7">
            บริหารจัดการทรัพย์สิน IT ของหน่วยบริการสาธารณสุข
            ในจังหวัดสตูลอย่างเป็นระบบ ครบวงจร
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
          <Link href="/public" className="inline-flex items-center gap-2 text-emerald-100 hover:text-white transition text-sm">
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
            <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>เข้าสู่ระบบ</h1>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              ยินดีต้อนรับกลับ — กรอก Username และรหัสผ่านเพื่อเข้าใช้งาน
            </p>
          </div>

          {/* Dev credentials hint */}
          {process.env.NODE_ENV !== "production" && (
            <div className="mb-6 rounded-2xl p-4 text-xs space-y-2"
              style={{ background: "rgba(234,179,8,0.08)", border: "1px dashed rgba(234,179,8,0.5)" }}>
              <p className="font-bold" style={{ color: "#92400e" }}>🔧 Dev — บัญชีทดสอบ</p>
              <table className="w-full border-separate" style={{ borderSpacing: "0 2px" }}>
                <thead>
                  <tr className="text-left" style={{ color: "#78350f" }}>
                    <th className="pr-3 font-semibold">Role</th>
                    <th className="pr-3 font-semibold">Username</th>
                    <th className="font-semibold">Password</th>
                  </tr>
                </thead>
                <tbody style={{ color: "#451a03" }}>
                  <tr>
                    <td className="pr-3 py-0.5">admin</td>
                    <td className="pr-3 font-mono">atacs_admin</td>
                    <td className="font-mono">Admin@2026</td>
                  </tr>
                  <tr>
                    <td className="pr-3 py-0.5">officer</td>
                    <td className="pr-3 font-mono">nakharin</td>
                    <td className="font-mono">Officer@2026</td>
                  </tr>
                  <tr>
                    <td className="pr-3 py-0.5">officer</td>
                    <td className="pr-3 font-mono">thanaphon.r</td>
                    <td className="font-mono">Staff@2026</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

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

            {isThaiDTab ? (
              <>
                <div className="flex items-center gap-3 p-3 rounded-2xl"
                  style={{ background: "rgba(22,163,74,0.08)" }}>
                  <span className="text-2xl">🪪</span>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    ยืนยันตัวตนด้วย ThaiD ผ่าน DOPA OAuth 2.0 — หากยังไม่มีบัญชีจะพาไปสมัครสมาชิกอัตโนมัติ
                  </p>
                </div>
                {thaiIdStatus.enabled ? (
                  <>
                    <Link
                      href="/api/auth/thaiid/authorize"
                      className="flex items-center justify-center gap-2 w-full rounded-2xl py-3 text-sm font-bold text-white transition hover:opacity-90 active:scale-[0.98]"
                      style={{ background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)", boxShadow: "0 4px 16px rgba(99,102,241,0.35)" }}
                    >
                      🪪 ดำเนินการผ่าน ThaiD →
                    </Link>
                    <p className="text-xs text-center" style={{ color: "var(--muted)" }}>
                      หากไม่พบข้อมูลผู้ใช้งาน ระบบจะพาไปหน้าสมัครสมาชิกอัตโนมัติ
                    </p>
                  </>
                ) : (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {thaiIdStatus.reason ?? "ThaiD ไม่พร้อมใช้งานในขณะนี้"}
                  </div>
                )}
                <div className="text-center">
                  <Link href="/login" className="text-sm font-semibold hover:underline" style={{ color: "var(--accent)" }}>
                    ← กลับเข้าสู่ระบบด้วย Username
                  </Link>
                </div>
              </>
            ) : (
              <>
                <form action={loginWithPasswordAction} className="space-y-4">
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
                    style={{ background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)", boxShadow: "0 4px 16px rgba(99,102,241,0.35)" }}
                  >
                    เข้าสู่ระบบ →
                  </button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px" style={{ background: "var(--line)" }} />
                  <span className="text-xs" style={{ color: "var(--muted)" }}>หรือ</span>
                  <div className="flex-1 h-px" style={{ background: "var(--line)" }} />
                </div>

                {/* ThaiD button */}
                {thaiIdStatus.enabled ? (
                  <Link
                    href="/login?thaid=1"
                    className="flex items-center justify-center gap-2 w-full rounded-2xl py-3 text-sm font-bold transition hover:opacity-80 active:scale-[0.98]"
                    style={{
                      border: "2px solid var(--accent)",
                      color: "var(--accent)",
                      background: "rgba(99,102,241,0.04)",
                    }}
                  >
                    <img src="thaid.png" alt="ThaiD" className="h-8 w-8 rounded-full" /> เข้าสู่ระบบด้วย ThaiD
                  </Link>
                ) : (
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-xs text-stone-600 text-center">
                    ThaiD ไม่พร้อมใช้งาน: {thaiIdStatus.reason ?? "กรุณาใช้ Username/Password ชั่วคราว"}
                  </div>
                )}

                <p className="text-xs text-center" style={{ color: "var(--muted)" }}>
                  ติดต่อผู้ดูแลระบบหากยังไม่มี Username
                </p>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 text-center text-sm" style={{ color: "var(--muted)" }}>
            <Link href="/public" className="font-semibold hover:underline" style={{ color: "var(--accent)" }}>
              ← กลับหน้า Public Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
