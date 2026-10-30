// หน้า /admin/sync (task 6.2, spec operations-monitoring) — API จำลองด้วย page.route
import { expect, test, type Page, type Route } from "@playwright/test";

type Role = "AP_CLERK" | "AP_LEAD" | "FINANCE_EXEC" | "SYS_ADMIN";
const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const STATUSES = ["UPLOADED", "PROCESSING", "FAILED", "EXTRACTED", "VERIFIED", "PENDING_APPROVAL", "APPROVED", "REJECTED", "SYNCING", "SYNCED", "SYNC_FAILED"];
const failedDoc = (n: number) => ({
  id: `f${n}`,
  docNo: `DOC-00020${n}`,
  vendorName: `ผู้ขาย ${n}`,
  grandTotal: `${n}070.00`,
  attempts: 3,
  syncError: "Odoo ไม่ตอบสนอง (503)",
  failedAt: `2026-10-30T0${n}:00:00Z`,
});

async function mockBackend(page: Page, roles: Role[]) {
  const failed = [failedDoc(1), failedDoc(2), failedDoc(3), failedDoc(4)];
  let syncing = 1;
  let overviewCalls = 0;
  const calls: { method: string; path: string; body?: { ids?: string[] } }[] = [];
  const user = { id: "u-me", email: "me@test.local", displayName: "ผู้ทดสอบ", roles, mustChangePassword: false };
  await page.route(/\/(auth|api)\//, async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const body = req.postData() ? JSON.parse(req.postData()!) : undefined;
    calls.push({ method: req.method(), path, body });
    if (path === "/auth/refresh") return json(route, 200, { accessToken: "t", expiresIn: 900, user });
    if (path === "/api/ops/overview") {
      overviewCalls++;
      const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
      counts.SYNC_FAILED = failed.length;
      counts.SYNCING = syncing;
      counts.SYNCED = 12;
      return json(route, 200, { counts, queues: { extract: 2, sync: syncing }, lastSyncedAt: "2026-10-30T02:15:00Z", autoSync: true, connected: true, serverTime: new Date().toISOString() });
    }
    if (path === "/api/ops/sync-failed") return json(route, 200, { items: failed });
    if (path === "/api/documents/resend") {
      const ids: string[] = body.ids;
      for (const id of ids) failed.splice(failed.findIndex((f) => f.id === id), 1);
      syncing += ids.length;
      return json(route, 200, { results: ids.map((id) => ({ id, ok: true })) });
    }
    return json(route, 404, { message: "ไม่พบ" });
  });
  return { calls, overviewCalls: () => overviewCalls };
}

test.describe("6.2 ติดตามคิวและการส่ง ERP", () => {
  test("Admin เห็นจำนวนตามสถานะ งานค้าง และสถานะการส่งอัตโนมัติ", async ({ page }) => {
    await mockBackend(page, ["SYS_ADMIN"]);
    await page.goto("/admin/sync");
    await expect(page.getByTestId("count-SYNC_FAILED")).toHaveText("4");
    await expect(page.getByTestId("count-SYNCING")).toHaveText("1");
    await expect(page.getByTestId("auto-sync")).toHaveText("เปิด");
    await expect(page.getByTestId("queue-extract")).toHaveText("2");
    await expect(page.getByTestId("last-synced")).toHaveText("30/10/2569 09:15");
  });

  test("รายการที่ล้มเหลวเรียงเก่าไปใหม่ พร้อมจำนวนครั้งและเหตุผลล่าสุด", async ({ page }) => {
    await mockBackend(page, ["SYS_ADMIN"]);
    await page.goto("/admin/sync");
    const rows = page.getByRole("region", { name: "ส่ง ERP ไม่สำเร็จ" }).locator("tbody tr");
    await expect(rows).toHaveCount(4);
    await expect(rows.first()).toContainText("DOC-000201");
    await expect(rows.first()).toContainText("ผู้ขาย 1");
    await expect(rows.first()).toContainText("1,070.00");
    await expect(rows.first()).toContainText("Odoo ไม่ตอบสนอง (503)");
  });

  test("เลือก 3 รายการ ส่งใหม่และยืนยัน → ทั้ง 3 หายจากรายการ และ SYNCING เพิ่มขึ้น", async ({ page }) => {
    const { calls } = await mockBackend(page, ["SYS_ADMIN"]);
    await page.goto("/admin/sync");
    for (const n of [1, 2, 3]) await page.getByLabel(`เลือก DOC-00020${n}`).check();
    await page.getByRole("button", { name: "ส่งใหม่ (3)" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("DOC-000201, DOC-000202, DOC-000203");
    await dialog.getByRole("button", { name: "ส่งใหม่" }).click();
    await expect(page.getByText("ส่งใหม่แล้ว 3 ฉบับ", { exact: true })).toBeVisible();
    expect(calls.find((c) => c.path === "/api/documents/resend")?.body).toEqual({ ids: ["f1", "f2", "f3"] });
    const rows = page.getByRole("region", { name: "ส่ง ERP ไม่สำเร็จ" }).locator("tbody tr");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("DOC-000204");
    await expect(page.getByTestId("count-SYNCING")).toHaveText("4");
  });

  test("ยกเลิกในกล่องยืนยัน = ไม่ส่ง", async ({ page }) => {
    const { calls } = await mockBackend(page, ["SYS_ADMIN"]);
    await page.goto("/admin/sync");
    await page.getByLabel("เลือกทั้งหมด").check();
    await page.getByRole("button", { name: "ส่งใหม่ (4)" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(calls.some((c) => c.path === "/api/documents/resend")).toBe(false);
  });

  test("Finance Exec เห็นตัวเลขและรายการ แต่ไม่มีปุ่มส่งใหม่หรือช่องเลือก", async ({ page }) => {
    await mockBackend(page, ["FINANCE_EXEC"]);
    await page.goto("/admin/sync");
    await expect(page.getByTestId("count-SYNC_FAILED")).toHaveText("4");
    await expect(page.getByRole("region", { name: "ส่ง ERP ไม่สำเร็จ" }).locator("tbody tr")).toHaveCount(4);
    await expect(page.getByRole("button", { name: /ส่งใหม่/ })).toHaveCount(0);
    await expect(page.getByRole("checkbox")).toHaveCount(0);
  });

  test("Clerk ไม่เห็นเมนูและไม่เรียก API ติดตาม", async ({ page }) => {
    const { calls } = await mockBackend(page, ["AP_CLERK"]);
    await page.goto("/admin/sync");
    await expect(page.getByRole("heading", { name: "ติดตามคิวและการส่ง ERP" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "ติดตามการส่ง" })).toHaveCount(0);
    expect(calls.some((c) => c.path.startsWith("/api/ops"))).toBe(false);
  });

  test("รีเฟรชข้อมูลเองทุก 30 วินาที", async ({ page }) => {
    await page.clock.install();
    const { overviewCalls } = await mockBackend(page, ["SYS_ADMIN"]);
    await page.goto("/admin/sync");
    await expect(page.getByTestId("count-SYNC_FAILED")).toHaveText("4");
    const before = overviewCalls();
    await page.clock.runFor(29_000);
    expect(overviewCalls()).toBe(before);
    await page.clock.runFor(2_000);
    await expect.poll(overviewCalls).toBe(before + 1);
  });
});
