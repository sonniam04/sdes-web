import type { NextConfig } from "next";

// หน้าสำหรับ dev (/dev/components, /dev/tokens) ตั้งชื่อเป็น page.dev.tsx
// production build ไม่รู้จักนามสกุล .dev.tsx จึงไม่มี route เหล่านี้เลย
const isProd = process.env.NODE_ENV === "production";

// backend (sdes-service) — browser เรียกผ่าน origin เดียวกับเว็บ เพื่อให้ refresh cookie
// (HttpOnly, SameSite=Strict, Path=/auth) ถูกส่งไปด้วย (design D9: ไม่มี BFF แยก)
const API_ORIGIN = process.env.SDES_API_ORIGIN ?? "http://127.0.0.1:3000";

const nextConfig: NextConfig = {
  pageExtensions: isProd ? ["tsx", "ts"] : ["dev.tsx", "tsx", "ts"],
  // dev ใช้โฟลเดอร์แยก เพื่อให้ `next build` รันได้ระหว่างที่ dev server เปิดอยู่
  distDir: isProd ? ".next" : ".next-dev",
  // ป้าย dev ของ Next บังแถบปุ่มล่างของหน้าทำงาน
  devIndicators: false,
  async rewrites() {
    return [
      { source: "/auth/:path*", destination: `${API_ORIGIN}/auth/:path*` },
      { source: "/api/:path*", destination: `${API_ORIGIN}/:path*` },
    ];
  },
};

export default nextConfig;
