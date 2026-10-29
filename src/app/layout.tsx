import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";

// next/font ดาวน์โหลดตอน build แล้ว self-host ไม่เรียก Google ตอนผู้ใช้เปิดหน้า
const sarabun = Sarabun({
  variable: "--font-sarabun",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SDES",
  description: "ระบบอ่านเอกสารบัญชีและส่งเข้า ERP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={`${sarabun.variable} antialiased`}>{children}</body>
    </html>
  );
}
