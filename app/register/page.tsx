import { redirect } from "next/navigation";

import { TopNavigation } from "@/app/_components/top-navigation";
import { registerFirstTimeAction } from "@/app/auth/actions";
import { listAllFacilitiesForSelect } from "@/lib/assets";
import { getCurrentUser, getPendingRegistrationClaim } from "@/lib/auth";
import { SubmitButton } from "@/app/_components/ui/submit-button";
import { FacilitySelect } from "@/app/_components/ui/facility-select";
import { AppIcon } from "@/app/_components/ui/icon";
import { PhotoBackdrop } from "@/app/_components/ui/photo-backdrop";

type RegisterPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readQueryValue(value: string | string[] | undefined) {
  if (!value) {
    return "";
  }

  return Array.isArray(value) ? value[0] : value;
}

function splitDisplayName(displayName: string) {
  const normalized = displayName.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return { firstName: "", lastName: "" };
  }

  const [firstName, ...rest] = normalized.split(" ");
  return {
    firstName,
    lastName: rest.join(" "),
  };
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  const claim = await getPendingRegistrationClaim();
  if (!claim) {
    redirect(`/login?error=${encodeURIComponent("กรุณาเข้าสู่ระบบด้วย ThaiD หรือ Google ก่อนการสมัครสมาชิก")}`);
  }

  const params = await searchParams;
  const error = readQueryValue(params.error);
  const notice = readQueryValue(params.notice);

  const facilities = await listAllFacilitiesForSelect();
  const { firstName, lastName } = splitDisplayName(claim.displayName);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-10 sm:px-8">
      <TopNavigation current="register" user={null} />
      <section className="mt-4 overflow-hidden rounded-[2rem] border border-[var(--line)] bg-white">
        {/* Photo only behind the heading; the form below stays on a clean surface. */}
        <div className="relative isolate overflow-hidden border-b border-[var(--line)] px-6 pb-5 pt-6 sm:px-8 sm:pt-8">
          <PhotoBackdrop image="office-desk" opacity="opacity-[0.13]" fade="left" />
          <h1 className="section-title text-3xl font-semibold sm:text-4xl">สมัครสมาชิก ATACS</h1>
          <p className="mt-3 text-sm leading-7 text-[var(--neutral-text)]">
            ลงทะเบียนครั้งแรก · ยืนยันตัวตนผ่าน {claim.provider === "google" ? "Google" : "ThaiD"} แล้ว กรุณากรอกข้อมูลให้ครบเพื่อลงทะเบียนใช้งาน
          </p>
        </div>
        <div className="px-6 pb-6 sm:px-8 sm:pb-8">

        {notice ? (
          <div className="mt-5 flex items-start gap-2 rounded-2xl border border-[var(--state-info-border)] bg-[var(--state-info-bg)] px-4 py-3 text-sm text-[var(--state-info-fg)]">
            <AppIcon name="info" className="mt-0.5 h-4 w-4 shrink-0" /><span>{notice}</span>
          </div>
        ) : null}

        {error ? (
          <div role="alert" className="mt-5 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AppIcon name="warning" className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
          </div>
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="firstName" className="block text-sm font-medium">
                ชื่อ
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                autoComplete="given-name"
                defaultValue={firstName}
                required
                className="w-full rounded-2xl border border-black/10 bg-white/90 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="lastName" className="block text-sm font-medium">
                นามสกุล
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                autoComplete="family-name"
                defaultValue={lastName}
                required
                className="w-full rounded-2xl border border-black/10 bg-white/90 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
              />
            </div>
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
            <FacilitySelect
              id="facilityId"
              name="facilityId"
              required
              className="[&_input]:min-h-12 [&_input]:rounded-2xl"
              facilities={facilities.map((f) => ({
                id: f.id,
                name: f.facility_name,
                typecode: f.typecode,
                districtName: f.district_name ? `อ.${f.district_name}` : "",
              }))}
            />
            <p className="text-xs text-[var(--muted)]">ผู้ดูแลระบบจะอนุมัติการเข้าใช้งานหลังจากสมัครสมาชิก</p>
          </div>

          <SubmitButton pendingText="กำลังส่งข้อมูล…"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent-strong)] px-4 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#125b86] disabled:opacity-60"
          >
            <AppIcon name="check" className="h-4 w-4" /> สมัครสมาชิก — รอการอนุมัติ
          </SubmitButton>
        </form>
        </div>
      </section>
    </main>
  );
}
