import Link from "next/link";
import { redirect } from "next/navigation";

import { TopNavigation } from "@/app/_components/top-navigation";
import { loginWithPasswordAction, loginWithThaiDAction } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/auth";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readQueryValue(value: string | string[] | undefined) {
  if (!value) {
    return "";
  }

  return Array.isArray(value) ? value[0] : value;
}

function tabClass(isActive: boolean) {
  return [
    "flex-1 rounded-2xl px-4 py-2.5 text-sm font-semibold transition",
    isActive
      ? "bg-[var(--accent-strong)] text-white shadow-sm"
      : "bg-transparent text-[var(--muted)] hover:text-[var(--foreground)]",
  ].join(" ");
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/");
  }

  const params = await searchParams;
  const error = readQueryValue(params.error);
  const notice = readQueryValue(params.notice);
  const tab = readQueryValue(params.tab) || "thaid";
  const isThaiDTab = tab !== "password";

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-10 sm:px-8">
      <TopNavigation current="login" user={null} />
      <section className="glass-panel rounded-[2rem] border border-black/10 p-6 sm:p-8">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">ATACS Authentication</p>
        <h1 className="section-title mt-3 text-4xl font-semibold">เข้าสู่ระบบ</h1>

        {/* Tab switcher */}
        <div className="mt-5 flex gap-1 rounded-2xl border border-black/8 bg-black/4 p-1">
          <Link href="/login?tab=thaid" className={tabClass(isThaiDTab)}>
            ThaiD
          </Link>
          <Link href="/login?tab=password" className={tabClass(!isThaiDTab)}>
            Username / Password
          </Link>
        </div>

        {notice ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {isThaiDTab ? (
          <>
            <p className="mt-5 text-sm leading-7 text-[var(--muted)]">
              ยืนยันตัวตนด้วยเลขบัตรประชาชนจาก ThaiD หากระบบไม่พบบัญชี จะพาไปหน้าสมัครสมาชิกอัตโนมัติ
            </p>
            <form action={loginWithThaiDAction} className="mt-5 space-y-4">
              <div className="space-y-2">
                <label htmlFor="thaidCid" className="block text-sm font-medium">
                  เลขบัตรประชาชน (ThaiD)
                </label>
                <input
                  id="thaidCid"
                  name="thaidCid"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{13}"
                  maxLength={13}
                  required
                  className="w-full rounded-2xl border border-black/10 bg-white/90 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                  placeholder="เช่น 1234567890123"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="displayName" className="block text-sm font-medium">
                  ชื่อ-นามสกุลจาก ThaiD
                </label>
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  required
                  className="w-full rounded-2xl border border-black/10 bg-white/90 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                  placeholder="ระบุชื่อเพื่อยืนยันตัวตนครั้งแรก"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-2xl bg-[var(--accent-strong)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              >
                ดำเนินการเข้าสู่ระบบด้วย ThaiD
              </button>
            </form>
            <p className="mt-5 text-sm text-[var(--muted)]">
              หากเป็นผู้ใช้งานครั้งแรก ระบบจะพาไปหน้าสมัครสมาชิกทันทีหลังตรวจสอบ ThaiD
            </p>
          </>
        ) : (
          <>
            <p className="mt-5 text-sm leading-7 text-[var(--muted)]">
              เข้าสู่ระบบด้วย Username และรหัสผ่านที่ผู้ดูแลระบบกำหนดไว้
            </p>
            <form action={loginWithPasswordAction} className="mt-5 space-y-4">
              <div className="space-y-2">
                <label htmlFor="username" className="block text-sm font-medium">
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  className="w-full rounded-2xl border border-black/10 bg-white/90 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                  placeholder="ชื่อผู้ใช้งาน"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium">
                  รหัสผ่าน
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-2xl border border-black/10 bg-white/90 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-2xl bg-[var(--accent-strong)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              >
                เข้าสู่ระบบ
              </button>
            </form>
            <p className="mt-5 text-sm text-[var(--muted)]">
              หากยังไม่มี username กรุณาติดต่อผู้ดูแลระบบ หรือใช้ช่องทาง ThaiD แทน
            </p>
          </>
        )}

        <div className="mt-4 text-sm text-[var(--muted)]">
          กลับหน้าแรก{" "}
          <Link href="/public" className="font-semibold text-[var(--accent-strong)]">
            ATACS Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}