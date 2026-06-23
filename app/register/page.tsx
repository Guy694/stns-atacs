import { redirect } from "next/navigation";

import { TopNavigation } from "@/app/_components/top-navigation";
import { registerFirstTimeAction } from "@/app/auth/actions";
import { listAllFacilitiesForSelect } from "@/lib/assets";
import { getCurrentUser, getPendingRegistrationClaim } from "@/lib/auth";

type RegisterPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readQueryValue(value: string | string[] | undefined) {
  if (!value) {
    return "";
  }

  return Array.isArray(value) ? value[0] : value;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  const claim = await getPendingRegistrationClaim();
  if (!claim) {
    redirect("/login?error=กรุณาเข้าสู่ระบบด้วย ThaiD หรือ Google ก่อนการสมัครสมาชิก");
  }

  const params = await searchParams;
  const error = readQueryValue(params.error);
  const notice = readQueryValue(params.notice);

  const facilities = await listAllFacilitiesForSelect();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-10 sm:px-8">
      <TopNavigation current="register" user={null} />
      <section className="glass-panel rounded-[2rem] border border-black/10 p-6 sm:p-8">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">First-time Registration</p>
        <h1 className="section-title mt-3 text-4xl font-semibold">สมัครสมาชิก ATACS</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
          ยืนยันตัวตนผ่าน {claim.provider === "google" ? "Google" : "ThaiD"} แล้ว กรุณากรอกข้อมูลให้ครบเพื่อลงทะเบียนใช้งานครั้งแรก
        </p>

        {notice ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        <form action={registerFirstTimeAction} className="mt-6 space-y-4">
          {claim.provider === "thaid" ? (
            <div className="space-y-2">
              <label htmlFor="thaidCid" className="block text-sm font-medium">
                เลขบัตรประชาชน (ThaiD)
              </label>
              <input
                id="thaidCid"
                name="thaidCid"
                type="text"
                value={claim.cid}
                readOnly
                required
                className="w-full rounded-2xl border border-black/10 bg-stone-100 px-4 py-3 text-[var(--muted)] outline-none"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label htmlFor="googleEmail" className="block text-sm font-medium">
                อีเมล Google
              </label>
              <input
                id="googleEmail"
                type="email"
                value={claim.email}
                readOnly
                className="w-full rounded-2xl border border-black/10 bg-stone-100 px-4 py-3 text-[var(--muted)] outline-none"
              />
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="fullName" className="block text-sm font-medium">
              ชื่อ-นามสกุล
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              defaultValue={claim.displayName}
              required
              className="w-full rounded-2xl border border-black/10 bg-white/90 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="officerPosition" className="block text-sm font-medium">
              ตำแหน่งเจ้าหน้าที่ <span className="text-rose-500">*</span>
            </label>
            <input
              id="officerPosition"
              name="officerPosition"
              type="text"
              required
              minLength={2}
              maxLength={150}
              className="w-full rounded-2xl border border-black/10 bg-white/90 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
              placeholder="เช่น นักวิชาการคอมพิวเตอร์"
            />
          </div>

          {claim.provider === "thaid" ? (
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium">
                อีเมล
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full rounded-2xl border border-black/10 bg-white/90 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                placeholder="name@example.go.th"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <label htmlFor="facilityId" className="block text-sm font-medium">
              หน่วยงานที่สังกัด <span className="text-rose-500">*</span>
            </label>
            <select
              id="facilityId"
              name="facilityId"
              required
              className="w-full rounded-2xl border border-black/10 bg-white/90 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
            >
              <option value="">— เลือกหน่วยงาน —</option>
              {facilities.map((f) => (
                <option key={f.id} value={String(f.id)}>
                  {f.facility_name}{f.district_name ? ` · อ.${f.district_name}` : ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-[var(--muted)]">ผู้ดูแลระบบจะอนุมัติการเข้าใช้งานหลังจากสมัครสมาชิก</p>
          </div>

          <button
            type="submit"
            className="w-full rounded-2xl bg-[var(--accent-strong)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            สมัครสมาชิก — รอการอนุมัติ
          </button>
        </form>
      </section>
    </main>
  );
}
