import Link from "next/link";
import { redirect } from "next/navigation";

import { updateAnnouncementAction } from "@/app/(main)/admin/settings/announcement/actions";
import { AnnouncementPopup } from "@/app/_components/announcement-popup";
import { StatusBadge } from "@/app/_components/ui/status-badge";
import { getAnnouncement } from "@/lib/announcement";
import {
  ANNOUNCEMENT_IMAGE_URL_PREFIX,
  ANNOUNCEMENT_MESSAGE_MAX,
  ANNOUNCEMENT_TITLE_MAX,
  ANNOUNCEMENT_VERSION_MAX,
} from "@/lib/announcement-shared";
import { withBasePath } from "@/lib/base-path";
import { APP_VERSION } from "@/lib/app-version";
import { getCurrentUser } from "@/lib/auth";
import { formatThaiDateTime } from "@/lib/date-format";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
const inputClass =
  "mt-1 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]";

export default async function AnnouncementSettingsPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  const params = await searchParams;
  const notice = one(params.notice);
  const error = one(params.error);
  const preview = one(params.preview) === "1";
  const state = await getAnnouncement();
  const imageUrl = state.imageName ? withBasePath(`${ANNOUNCEMENT_IMAGE_URL_PREFIX}${state.imageName}`) : "";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
      <div>
        <p className="text-xs font-semibold tracking-[0.12em] text-[var(--accent-strong)]">ADMIN · ANNOUNCEMENT</p>
        <h1 className="section-title mt-1 text-3xl font-semibold">ประกาศ / ประชาสัมพันธ์ (popup)</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          แสดงหน้าต่างประกาศหลังผู้ใช้เข้าสู่ระบบ ใช้แจ้งข่าวหรือการอัปเดตเวอร์ชัน เปิด/ปิดได้ตลอดเวลา
        </p>
      </div>

      {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <section className="glass-panel rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">สถานะปัจจุบัน</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {state.enabled ? "ผู้ใช้จะเห็นประกาศนี้หลังเข้าสู่ระบบ" : "ไม่แสดงประกาศ"}
              {" · "}เวอร์ชันระบบ v.{APP_VERSION}
            </p>
          </div>
          <StatusBadge tone={state.enabled ? "success" : "neutral"}>{state.enabled ? "เปิดแสดงอยู่" : "ปิดอยู่"}</StatusBadge>
        </div>
        {state.updatedAt && (
          <p className="mt-3 text-xs text-[var(--muted)]">
            แก้ไขล่าสุด {formatThaiDateTime(state.updatedAt)}
            {state.updatedBy ? ` โดย ${state.updatedBy}` : ""}
          </p>
        )}
      </section>

      <form action={updateAnnouncementAction} className="glass-panel space-y-5 rounded-2xl p-6">
        <label className="flex items-center gap-3 text-sm font-semibold">
          <input type="checkbox" name="enabled" value="true" defaultChecked={state.enabled} className="h-4 w-4" />
          เปิดแสดงประกาศ popup หลังเข้าสู่ระบบ
        </label>

        <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
          <div>
            <label htmlFor="ann-title" className="block text-sm font-medium">หัวข้อ</label>
            <input id="ann-title" name="title" maxLength={ANNOUNCEMENT_TITLE_MAX} defaultValue={state.title} placeholder="เช่น อัปเดตระบบ ATACS" className={inputClass} />
          </div>
          <div>
            <label htmlFor="ann-version" className="block text-sm font-medium">เวอร์ชันที่อัปเดต (ไม่บังคับ)</label>
            <input id="ann-version" name="version" maxLength={ANNOUNCEMENT_VERSION_MAX} defaultValue={state.version} placeholder={APP_VERSION} className={inputClass} />
          </div>
        </div>

        <div>
          <label htmlFor="ann-message" className="block text-sm font-medium">ข้อความ</label>
          <textarea id="ann-message" name="message" rows={6} maxLength={ANNOUNCEMENT_MESSAGE_MAX} defaultValue={state.message} placeholder={"- เพิ่มรายงานมูลค่าคงเหลือแบบพิมพ์ A4\n- ปรับหน้าภาพรวมครุภัณฑ์คอมพิวเตอร์"} className={inputClass} />
          <p className="mt-1 text-xs text-[var(--muted)]">ไม่เกิน {ANNOUNCEMENT_MESSAGE_MAX} ตัวอักษร · ขึ้นบรรทัดใหม่ได้</p>
        </div>

        <div>
          <label htmlFor="ann-image" className="block text-sm font-medium">ภาพประกอบ (ไม่บังคับ)</label>
          <input id="ann-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block w-full text-sm" />
          <p className="mt-1 text-xs text-[var(--muted)]">JPG, PNG หรือ WebP ขนาดไม่เกิน 2 MB · เลือกไฟล์ใหม่เพื่อแทนที่ภาพเดิม</p>
          {imageUrl && (
            <div className="mt-3 flex flex-wrap items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="ภาพประกาศปัจจุบัน" className="max-h-32 rounded-lg border border-black/10" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="removeImage" /> ลบภาพนี้
              </label>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90">
            บันทึก
          </button>
          <Link href="/admin/settings/announcement?preview=1" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            ดูตัวอย่างประกาศที่บันทึกไว้
          </Link>
        </div>
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          ทุกครั้งที่กดบันทึก ผู้ใช้ที่เคยเลือก &quot;ไม่ต้องแสดงอีก&quot; จะเห็นประกาศฉบับใหม่อีกครั้ง โดย popup แสดงครั้งเดียวต่อการเปิดแท็บเบราว์เซอร์
        </p>
      </form>

      {preview && (
        <AnnouncementPopup
          preview
          revision={state.revision}
          title={state.title}
          version={state.version}
          message={state.message}
          imageUrl={imageUrl}
        />
      )}

      <div>
        <Link href="/admin/settings" className="text-sm font-semibold text-[var(--primary)] hover:underline">← กลับหน้าตั้งค่าระบบ</Link>
      </div>
    </div>
  );
}
