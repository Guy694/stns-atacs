import type { Metadata } from "next";

import { ManualReader } from "./_components/manual-reader";

export const metadata: Metadata = {
  title: "คู่มือการใช้งาน | ATACS",
  description: "คู่มือผู้ใช้ ATACS พร้อมภาพประกอบ ตั้งแต่เริ่มใช้งานจนถึงการจัดการทรัพย์สินและรายงาน",
};

// The main layout requires a signed-in user. Help is available to every role.
export default function ManualsPage() {
  return <ManualReader />;
}
