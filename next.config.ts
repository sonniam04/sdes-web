import type { NextConfig } from "next";

// หน้าสำหรับ dev (/dev/components, /dev/tokens) ตั้งชื่อเป็น page.dev.tsx
// production build ไม่รู้จักนามสกุล .dev.tsx จึงไม่มี route เหล่านี้เลย
const isProd = process.env.NODE_ENV === "production";

// backend (sdes-service) — browser เรียกผ่าน origin เดียวกับเว็บ เพื่อให้ refresh cookie
// (HttpOnly, SameSite=Strict, Path=/auth) ถูกส่งไปด้วย (design D9: ไม่มี BFF แยก)
const API_ORIGIN = process.env.SDES_API_ORIGIN ?? "http://127.0.0.1:3000";
// socket.io ต่อตรงไปที่ API (rewrite ของ Next ไม่รองรับ websocket) จึงต้องอนุญาตใน connect-src
const WS_URL = process.env.NEXT_PUBLIC_SDES_WS_URL ?? "http://127.0.0.1:3000";
const wsOrigin = new URL(WS_URL);
const wsSocket = `${wsOrigin.protocol === "https:" ? "wss:" : "ws:"}//${wsOrigin.host}`;

/**
 * Content-Security-Policy (spec platform-security "Security headers")
 * - script: Next ใส่ inline script สำหรับ hydration และ dev ต้องใช้ eval (react-refresh)
 * - worker/blob: PDF.js worker และ blob URL ของไฟล์ต้นฉบับ
 */
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  `connect-src 'self' ${wsOrigin.origin} ${wsSocket}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // ส่งเมื่อใช้ HTTPS เท่านั้น — browser ไม่สนใจ HSTS บน http
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  pageExtensions: isProd ? ["tsx", "ts"] : ["dev.tsx", "tsx", "ts"],
  // dev ใช้โฟลเดอร์แยก เพื่อให้ `next build` รันได้ระหว่างที่ dev server เปิดอยู่
  distDir: isProd ? ".next" : ".next-dev",
  // image production คัดลอกเฉพาะ .next/standalone + static แล้วรัน server.js (design D3)
  output: isProd ? "standalone" : undefined,
  // ไม่ใช้ next/image (ไฟล์ต้นฉบับแสดงด้วย <img> จาก blob URL) — ปิด optimizer เพื่อไม่ต้องมี sharp ใน image
  images: { unoptimized: true },
  // ป้าย dev ของ Next บังแถบปุ่มล่างของหน้าทำงาน
  devIndicators: false,
  // ไม่บอกชื่อ framework ใน header (X-Powered-By)
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  async rewrites() {
    return [
      { source: "/auth/:path*", destination: `${API_ORIGIN}/auth/:path*` },
      { source: "/api/:path*", destination: `${API_ORIGIN}/:path*` },
    ];
  },
};

export default nextConfig;
