// หน้า /reports (task 5.4 ของ complete-missing-features, spec finance-reports) — API จำลองด้วย page.route
import { readFile } from "node:fs/promises";
import { expect, test, type Page, type Route } from "@playwright/test";

type Role = "AP_CLERK" | "AP_LEAD" | "FINANCE_EXEC" | "SYS_ADMIN";
const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const STATUSES = ["UPLOADED", "PROCESSING", "FAILED", "EXTRACTED", "VERIFIED", "PENDING_APPROVAL", "APPROVED", "REJECTED", "SYNCING", "SYNCED", "SYNC_FAILED"];
function report(from: string, to: string) {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  Object.assign(counts, { SYNCED: 12, PENDING_APPROVAL: 2, EXTRACTED: 3 });
  return {
    period: { from, to },
    months: [
      { month: "2026-10", documentCount: 2, subtotal: "11000.00", vat: "770.00", wht: "300.00", grandTotal: "11770.00" },
      { month: "2026-11", documentCount: 0, subtotal: "0.00", vat: "0.00", wht: "0.00", grandTotal: "0.00" },
      { month: "2026-12", documentCount: 11, subtotal: "6500.33", vat: "0.02", wht: "0.00", grandTotal: "6500.35" },
    ],
    totals: { documentCount: 13, subtotal: "17500.33", vat: "770.02", wht: "300.00", grandTotal: "18270.35" },
    topVendors: [
      { vendorId: "v1", name: "บริษัท ผู้ขาย หนึ่ง จำกัด", taxId: "0105536000011", branchCode: "00000", documentCount: 2, grandTotal: "10700.35" },
      { vendorId: "v2", name: "บริษัท ผู้ขาย สอง จำกัด", taxId: "0105536000022", branchCode: "00000", documentCount: 1, grandTotal: "1100.00" },
    ],
    process: { uploaded: 17, statusCounts: counts, avgSeconds: { toExtracted: 18, toVerified: 240, toSynced: 20 }, approvalRate: 0.25, noEditRate: 0.75 },
  };
}

async function mockBackend(page: Page, roles: Role[] = ["FINANCE_EXEC"]) {
  const calls: { path: string; query: Record<string, string> }[] = [];
  const user = { id: "u-me", email: "me@test.local", displayName: "ผู้ทดสอบ", roles, mustChangePassword: false };
  await page.route(/\/(auth|api)\//, async (route) => {
    const url = new URL(route.request().url());
    const query = Object.fromEntries(url.searchParams);
    calls.push({ path: url.pathname, query });
    if (url.pathname === "/auth/refresh") return json(route, 200, { accessToken: "t", expiresIn: 900, user });
    if (url.pathname === "/api/reports/summary") return json(route, 200, report(query.from!, query.to!));
    if (url.pathname === "/api/reports/summary/export")
      return route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="report-${query.from}-${query.to}.csv"` },
        body: Buffer.from("﻿เดือน,จำนวนเอกสาร\r\n2026-10,2\r\n", "utf8"),
      });
    return json(route, 404, { message: "ไม่พบ" });
  });
  return { calls };
}

test.describe("5.4 รายงาน", () => {
  test("ค่าเริ่มต้นเดือนปัจจุบัน; เปลี่ยนช่วงแล้วเรียก API ใหม่และแสดงเดือนแบบไทย", async ({ page }) => {
    const { calls } = await mockBackend(page);
    const now = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
    await page.goto("/reports");
    await expect.poll(() => calls.find((c) => c.path === "/api/reports/summary")?.query).toEqual({ from: now, to: now });
    await page.getByLabel("ตั้งแต่เดือน").fill("2026-10");
    await page.getByLabel("ถึงเดือน").fill("2026-12");
    await page.getByRole("button", { name: "แสดง" }).click();
    await expect.poll(() => calls.findLast((c) => c.path === "/api/reports/summary")?.query).toEqual({ from: "2026-10", to: "2026-12" });
    await expect(page.getByTestId("report-period")).toContainText("ต.ค. 2569 – ธ.ค. 2569");
  });

  test("ยอดรวม ตารางรายเดือน (รวมเดือนที่ไม่มีเอกสาร) และแถวรวมตรงกับข้อมูล", async ({ page }) => {
    await mockBackend(page);
    await page.goto("/reports");
    await expect(page.getByTestId("total-grand")).toHaveText("18,270.35");
    await expect(page.getByTestId("total-vat")).toHaveText("770.02");
    await expect(page.getByTestId("total-wht")).toHaveText("300.00");
    await expect(page.getByTestId("total-count")).toHaveText("13");
    const monthly = page.getByRole("region", { name: "ยอดรายเดือน" });
    await expect(monthly.locator('[data-month="2026-10"]')).toContainText("ต.ค. 2569");
    await expect(monthly.locator('[data-month="2026-10"]')).toContainText("11,770.00");
    await expect(monthly.locator('[data-month="2026-11"]')).toContainText("0.00");
    await expect(monthly.locator('[data-month="total"]')).toContainText("18,270.35");
    await expect(page.getByRole("region", { name: "ผู้ขายยอดสูงสุด" }).locator("tbody tr").first()).toContainText("10,700.35");
  });

  test("ตัวชี้วัดกระบวนการ", async ({ page }) => {
    await mockBackend(page);
    await page.goto("/reports");
    await expect(page.getByTestId("to-extracted")).toHaveText("18 วินาที");
    await expect(page.getByTestId("to-verified")).toHaveText("4 นาที");
    await expect(page.getByTestId("approval-rate")).toHaveText("25%");
    await expect(page.getByTestId("no-edit-rate")).toHaveText("75%");
    await expect(page.getByTestId("status-counts").locator('[data-count="SYNCED"]')).toContainText("12");
  });

  test("ช่วงเกิน 24 เดือนหรือกลับด้าน ถูกปฏิเสธก่อนเรียก API", async ({ page }) => {
    const { calls } = await mockBackend(page);
    await page.goto("/reports");
    await expect(page.getByTestId("total-grand")).toBeVisible();
    const before = calls.filter((c) => c.path === "/api/reports/summary").length;
    await page.getByLabel("ตั้งแต่เดือน").fill("2024-01");
    await page.getByLabel("ถึงเดือน").fill("2026-06");
    await page.getByRole("button", { name: "แสดง" }).click();
    await expect(page.getByTestId("period-error")).toHaveText("เลือกช่วงเวลาได้ไม่เกิน 24 เดือน");
    await page.getByLabel("ตั้งแต่เดือน").fill("2026-06");
    await page.getByLabel("ถึงเดือน").fill("2026-01");
    await page.getByRole("button", { name: "แสดง" }).click();
    await expect(page.getByTestId("period-error")).toHaveText("เดือนเริ่มต้องไม่หลังเดือนสิ้นสุด");
    expect(calls.filter((c) => c.path === "/api/reports/summary").length).toBe(before);
  });

  test("ส่งออก CSV ตามช่วงที่แสดงอยู่ ได้ไฟล์ที่มี BOM", async ({ page }) => {
    const { calls } = await mockBackend(page);
    await page.goto("/reports");
    await page.getByLabel("ตั้งแต่เดือน").fill("2026-10");
    await page.getByLabel("ถึงเดือน").fill("2026-12");
    await page.getByRole("button", { name: "แสดง" }).click();
    await expect(page.getByTestId("report-period")).toContainText("ธ.ค. 2569");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "ส่งออก CSV" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("report-2026-10-2026-12.csv");
    const buf = await readFile((await file.path())!);
    expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(calls.find((c) => c.path === "/api/reports/summary/export")?.query).toEqual({ from: "2026-10", to: "2026-12" });
  });

  test("Clerk ไม่เห็นเมนูรายงานและเปิดหน้าไม่ได้", async ({ page }) => {
    const { calls } = await mockBackend(page, ["AP_CLERK"]);
    await page.goto("/reports");
    await expect(page.getByText(/ไม่มีสิทธิ์/)).toBeVisible();
    await expect(page.getByRole("link", { name: "รายงาน" })).toHaveCount(0);
    expect(calls.some((c) => c.path.startsWith("/api/reports"))).toBe(false);
  });
});
