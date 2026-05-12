import Link from "next/link";
import { redirect } from "next/navigation";

import { loginWithPasswordAction, loginWithThaiDAction } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/auth";

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
  const tab = readQueryValue(params.tab) || "thaid";
  const isThaiDTab = tab !== "password";

  return (
    <div className="min-h-screen flex" style={{ background: "var(--background)" }}>

      {/* ── Left panel (decorative) ─────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[46%] p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(145deg, #4c1d95 0%, #4338ca 50%, #3730a3 100%)" }}
      >
        {/* Floating circles */}
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full opacity-20"
          style={{ background: "rgba(167,139,250,0.4)" }} />
        <div className="absolute top-1/3 -right-16 w-64 h-64 rounded-full opacity-15"
          style={{ background: "rgba(196,181,253,0.5)" }} />
        <div className="absolute -bottom-10 left-1/4 w-48 h-48 rounded-full opacity-20"
          style={{ background: "rgba(139,92,246,0.6)" }} />

        {/* Logo area */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-2xl backdrop-blur-sm">
              🏥
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-tight">ATACS</p>
              <p className="text-violet-200 text-xs">Satun Health IT Assets</p>
            </div>
          </div>
          <h2 className="text-white text-3xl font-bold leading-snug">
            ระบบทะเบียน<br />ทรัพย์สินสารสนเทศ<br />จังหวัดสตูล
          </h2>
          <p className="text-violet-200 mt-4 text-sm leading-7">
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
              <p className="text-violet-200 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Bottom link */}
        <div className="relative z-10">
          <Link href="/public" className="inline-flex items-center gap-2 text-violet-200 hover:text-white transition text-sm">
            <span>←</span> ดู Public Dashboard
          </Link>
        </div>
      </div>

      {/* ── Right panel (form) ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 sm:px-12">

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
            style={{ background: "var(--accent)" }}>
            🏥
          </div>
          <div>
            <p className="font-bold" style={{ color: "var(--foreground)" }}>ATACS Satun</p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>ระบบทะเบียนทรัพย์สิน IT</p>
          </div>
        </div>

        <div className="w-full max-w-md">
          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>เข้าสู่ระบบ</h1>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              ยินดีต้อนรับกลับ — เลือกวิธีการยืนยันตัวตน
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 rounded-2xl p-1 mb-6"
            style={{ background: "rgba(99,102,241,0.08)", border: "1px solid var(--line)" }}>
            <Link
              href="/login?tab=thaid"
              className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-center transition"
              style={isThaiDTab
                ? { background: "var(--accent)", color: "white", boxShadow: "0 2px 8px rgba(99,102,241,0.35)" }
                : { color: "var(--muted)" }}
            >
              🪪 ThaiD
            </Link>
            <Link
              href="/login?tab=password"
              className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-center transition"
              style={!isThaiDTab
                ? { background: "var(--accent)", color: "white", boxShadow: "0 2px 8px rgba(99,102,241,0.35)" }
                : { color: "var(--muted)" }}
            >
              🔑 Username / Password
            </Link>
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
              boxShadow: "0 20px 60px rgba(99,102,241,0.10)",
            }}>

            {isThaiDTab ? (
              <>
                <div className="flex items-center gap-3 p-3 rounded-2xl"
                  style={{ background: "rgba(99,102,241,0.06)" }}>
                  <span className="text-2xl">🪪</span>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    ยืนยันตัวตนด้วยเลขบัตรประชาชน — หากยังไม่มีบัญชีจะพาไปสมัครสมาชิกอัตโนมัติ
                  </p>
                </div>
                <form action={loginWithThaiDAction} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="thaidCid" className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      เลขบัตรประชาชน 13 หลัก
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">🪪</span>
                      <input
                        id="thaidCid"
                        name="thaidCid"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]{13}"
                        maxLength={13}
                        required
                        className="w-full rounded-2xl border pl-11 pr-4 py-3 text-sm outline-none transition"
                        style={{ borderColor: "var(--line)", color: "var(--foreground)" }}
                        placeholder="เช่น 1234567890123"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="displayName" className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      ชื่อ-นามสกุล (จาก ThaiD)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">👤</span>
                      <input
                        id="displayName"
                        name="displayName"
                        type="text"
                        required
                        className="w-full rounded-2xl border pl-11 pr-4 py-3 text-sm outline-none transition"
                        style={{ borderColor: "var(--line)", color: "var(--foreground)" }}
                        placeholder="ระบุชื่อเพื่อยืนยันตัวตนครั้งแรก"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-2xl py-3 text-sm font-bold text-white transition hover:opacity-90 active:scale-[0.98]"
                    style={{ background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)", boxShadow: "0 4px 16px rgba(99,102,241,0.35)" }}
                  >
                    ดำเนินการเข้าสู่ระบบ →
                  </button>
                </form>
                <p className="text-xs text-center" style={{ color: "var(--muted)" }}>
                  ผู้ใช้งานใหม่จะถูกพาไปหน้าสมัครสมาชิกโดยอัตโนมัติ
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 p-3 rounded-2xl"
                  style={{ background: "rgba(99,102,241,0.06)" }}>
                  <span className="text-2xl">🔑</span>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    เข้าสู่ระบบด้วย Username และรหัสผ่านที่ผู้ดูแลระบบกำหนดให้
                  </p>
                </div>
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
