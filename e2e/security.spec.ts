// security headers + CSP ของเว็บ (spec platform-security "Security headers", phase 3 task 5.2)
import { expect, test } from "@playwright/test";

test("หน้า /login มี CSP, nosniff และห้ามฝังใน frame", async ({ request }) => {
  const r = await request.get("/login");
  const h = r.headers();
  expect(h["content-security-policy"]).toContain("default-src 'self'");
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
});

test("หน้าตรวจเอกสาร (PDF.js) ไม่มี CSP violation", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
  });
  // หน้าตัวอย่าง split-view ใช้ PDF.js + worker ชุดเดียวกับหน้าตรวจจริง
  await page.goto("/dev/review");
  await expect(page.getByTestId("pdf-page")).toBeVisible();
  await expect(page.getByRole("img", { name: /ภาพเอกสาร หน้า 1/ })).toBeVisible();
  await page.waitForTimeout(1500);
  expect(violations).toEqual([]);
});
