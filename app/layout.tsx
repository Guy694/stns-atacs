import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import "./globals.css";

const promptFont = Prompt({
  variable: "--font-body",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ระบบทะเบียนทรัพย์สินและครุภัณฑ์ จังหวัดสตูล - ATACS Satun",
  description:
    "ระบบทะเบียนทรัพย์สินและครุภัณฑ์ จังหวัดสตูล สำหรับสำรวจ ตรวจสอบ และสรุปสถานะอุปกรณ์ของหน่วยบริการสาธารณสุข",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${promptFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
       
      </body>
    </html>
  );
}
