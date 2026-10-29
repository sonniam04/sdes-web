import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3100",
    // ใช้ Edge/Chrome ที่ติดตั้งในเครื่อง; บน CI ตั้ง PW_CHANNEL=chromium
    channel: process.env.PW_CHANNEL ?? "msedge",
    viewport: { width: 1366, height: 768 },
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
  },
  webServer: {
    command: "pnpm dev --port 3100",
    url: "http://localhost:3100/dev/components",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
