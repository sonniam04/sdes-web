// หน้า /audit (task 6.3, spec audit-trail "Audit trail viewer" / "Audit export") — API จำลองด้วย page.route
import { readFile } from "node:fs/promises";
import { expect, test, type Page, type Route } from "@playwright/test";

type Role = "AP_CLERK" | "AP_LEAD" | "FINANCE_EXEC" | "SYS_ADMIN";
const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const DOC_ID = "11111111-1111-4111-8111-111111111111";
const ev = (id: number, action: string, details: unknown, actorName: string | null = "สมชาย เสมียน") => ({
  id: String(id),
  occurredAt: "2026-10-20T03:00:00Z",
  actorType: actorName ? "USER" : "SYSTEM",
  actorUserId: actorName ? "u-clerk" : null,
  actorName,
  action,
  entityType: "document",
  entityId: DOC_ID,
  ip: "10.0.0.1",
  details,
});

/** ประวัติของ DOC-000120: แก้ field, ยืนยัน, อนุมัติ, ส่ง ERP */
const docEvents = [
  ev(104, "document.status_changed", { field: "status", before: "SYNCING", after: "SYNCED", reason: null }, null),
  ev(103, "document.status_changed", { field: "status", before: "PENDING_APPROVAL", after: "APPROVED", reason: null }, "สมหญิง หัวหน้า"),
  ev(102, "document.status_changed", { field: "status", before: "EXTRACTED", after: "PENDING_APPROVAL", reason: null }),
  ev(101, "document.field_edited", { field: "header.vatAmount", before: "700.00", after: "770.00" }),
];

async function mockBackend(page: Page, roles: Role[]) {
  const calls: { path: string; query: Record<string, string> }[] = [];
  const user = { id: "u-me", email: "me@test.local", displayName: "ผู้ทดสอบ", roles, mustChangePassword: false };
  await page.route(/\/(auth|api)\//, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const query = Object.fromEntries(url.searchParams);
    calls.push({ path: url.pathname, query });
    if (url.pathname === "/auth/refresh") return json(route, 200, { accessToken: "t", expiresIn: 900, user });
    if (url.pathname === "/api/audit-events/facets")
      return json(route, 200, { actors: [{ id: "u-clerk", displayName: "สมชาย เสมียน" }, { id: "u-lead", displayName: "สมหญิง หัวหน้า" }], actions: ["auth.login", "document.field_edited", "document.status_changed"] });
    if (url.pathname === "/api/audit-events/export")
      return route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="audit-2026-10-30.csv"' },
        body: Buffer.from("﻿เวลา (Asia/Bangkok),การกระทำ\r\n2026-10-20 10:00:00,document.field_edited\r\n", "utf8"),
      });
    if (url.pathname === "/api/audit-events") {
      if (query.docNo) return json(route, 200, { items: query.docNo === "DOC-000120" ? docEvents : [], nextBefore: null });
      // ไม่มีตัวกรอง: 2 หน้า
      if (!query.before) return json(route, 200, { items: Array.from({ length: 50 }, (_, i) => ev(500 - i, "auth.login", { ok: true })), nextBefore: "451" });
      return json(route, 200, { items: [ev(450, "settings.updated", { field: "confidenceThreshold", before: 0.85, after: 0.9 })], nextBefore: null });
    }
    return json(route, 404, { message: "ไม่พบ" });
  });
  return { calls };
}

const results = (page: Page) => page.getByRole("region", { name: "ผลการค้นหา" });

test.describe("6.3 Audit trail", () => {
  test("Exec ค้นด้วยเลขเอกสาร เห็นการแก้ field พร้อมค่าก่อน/หลัง การอนุมัติ และการส่ง ERP", async ({ page }) => {
    const { calls } = await mockBackend(page, ["FINANCE_EXEC"]);
    await page.goto("/audit");
    await page.getByLabel("เลขเอกสาร").fill("doc-000120");
    await page.getByRole("button", { name: "ค้นหา" }).click();
    const rows = results(page).locator("tbody tr");
    await expect(rows).toHaveCount(4);
    expect(calls.findLast((c) => c.path === "/api/audit-events")?.query).toMatchObject({ docNo: "DOC-000120" });
    await expect(rows.nth(3)).toContainText("แก้ข้อมูลเอกสาร");
    await expect(rows.nth(3).getByTestId("change")).toHaveText("header.vatAmount 700.00 → 770.00");
    await expect(rows.nth(1)).toContainText("สมหญิง หัวหน้า");
    await expect(rows.nth(1).getByTestId("change")).toContainText("รออนุมัติ → อนุมัติแล้ว");
    await expect(rows.nth(0)).toContainText("ระบบ");
    await expect(rows.nth(0).getByTestId("change")).toContainText("ส่ง ERP แล้ว");
    // อ่านอย่างเดียว: ไม่มีปุ่มแก้หรือลบ
    await expect(page.getByRole("button", { name: /แก้|ลบ/ })).toHaveCount(0);
  });

  test("ตัวกรองช่วงเวลา ผู้กระทำ และประเภท ถูกส่งไป API", async ({ page }) => {
    const { calls } = await mockBackend(page, ["SYS_ADMIN"]);
    await page.goto("/audit");
    await page.getByLabel("ตั้งแต่วันที่").fill("2026-10-01");
    await page.getByLabel("ถึงวันที่").fill("2026-10-31");
    await page.getByLabel("ผู้กระทำ").click();
    await page.getByRole("option", { name: "สมชาย เสมียน" }).click();
    await page.getByLabel("ประเภทการกระทำ").click();
    await page.getByRole("option", { name: "แก้ข้อมูลเอกสาร" }).click();
    await page.getByRole("button", { name: "ค้นหา" }).click();
    await expect.poll(() => calls.findLast((c) => c.path === "/api/audit-events")?.query).toMatchObject({
      from: "2026-10-01T00:00:00+07:00",
      to: "2026-10-31T23:59:59.999+07:00",
      actorUserId: "u-clerk",
      action: "document.field_edited",
    });
  });

  test("แบ่งหน้าเรียงใหม่ไปเก่า: ถัดไปและก่อนหน้า", async ({ page }) => {
    await mockBackend(page, ["SYS_ADMIN"]);
    await page.goto("/audit");
    await expect(results(page).locator("tbody tr")).toHaveCount(50);
    await expect(page.getByRole("button", { name: "ก่อนหน้า" })).toBeDisabled();
    await page.getByRole("button", { name: "ถัดไป" }).click();
    await expect(results(page).locator("tbody tr")).toHaveCount(1);
    await expect(page.getByTestId("page-info")).toContainText("หน้า 2");
    await expect(page.getByRole("button", { name: "ถัดไป" })).toBeDisabled();
    await page.getByRole("button", { name: "ก่อนหน้า" }).click();
    await expect(results(page).locator("tbody tr")).toHaveCount(50);
  });

  test("ส่งออก CSV ตามตัวกรองที่ค้นอยู่ ได้ไฟล์ UTF-8 พร้อม BOM", async ({ page }) => {
    const { calls } = await mockBackend(page, ["SYS_ADMIN"]);
    await page.goto("/audit");
    await page.getByLabel("ประเภทการกระทำ").click();
    await page.getByRole("option", { name: "แก้ข้อมูลเอกสาร" }).click();
    await page.getByRole("button", { name: "ค้นหา" }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "ส่งออก CSV" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("audit-2026-10-30.csv");
    const buf = await readFile((await file.path())!);
    expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(buf.subarray(3).toString("utf8")).toContain("เวลา (Asia/Bangkok)");
    expect(calls.find((c) => c.path === "/api/audit-events/export")?.query).toEqual({ action: "document.field_edited" });
  });

  test("Clerk ไม่เห็นเมนู และหน้าแจ้งว่าไม่มีสิทธิ์", async ({ page }) => {
    const { calls } = await mockBackend(page, ["AP_CLERK"]);
    await page.goto("/audit");
    await expect(page.getByText(/ไม่มีสิทธิ์/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Audit trail" })).toHaveCount(0);
    expect(calls.some((c) => c.path.startsWith("/api/audit-events"))).toBe(false);
  });
});
