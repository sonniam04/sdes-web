// สถานะการส่ง ERP ในคิวและหน้ารายละเอียด (task 6.4, spec erp-sync "Sync status visibility") — API จำลองด้วย page.route
import { expect, test, type Page, type Route } from "@playwright/test";

type Role = "AP_CLERK" | "AP_LEAD" | "FINANCE_EXEC" | "SYS_ADMIN";
const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const REASON = "ยอดใน Odoo (10,701.00) ไม่ตรงกับเอกสาร (10,700.00)";
const row = (id: string, docNo: string, status: string, over: Record<string, unknown> = {}) => ({
  id,
  docNo,
  status,
  fileName: `${docNo}.pdf`,
  vendorName: "บริษัท ผู้ขาย จำกัด",
  invoiceNo: "INV-1",
  invoiceDate: "2026-10-15",
  grandTotal: "10700.00",
  issueCount: 0,
  erpTransactionId: null,
  syncError: null,
  createdAt: "2026-10-29T03:00:00Z",
  updatedAt: "2026-10-29T04:00:00Z",
  ...over,
});
const rows = [row("s1", "DOC-000301", "SYNC_FAILED", { syncError: REASON }), row("s2", "DOC-000302", "SYNCED", { erpTransactionId: "1532" })];

const data = {
  invoiceNo: "INV-1", invoiceDate: "2026-10-15", vendorName: "บริษัท ผู้ขาย จำกัด", vendorTaxId: "0105536000011", vendorBranch: "00000",
  buyerTaxId: "0994000165617", buyerBranch: "00000", subtotal: "10000.00", discount: "0.00", vatBase: "10000.00", vatRate: "7", vatAmount: "700.00",
  vatExempt: false, grandTotal: "10700.00", whtBase: null, whtRate: null, whtAmount: null, netPayable: null,
  items: [{ no: 1, description: "ค่าบริการ", quantity: "1", unitPrice: "10000.00", amount: "10000.00" }],
};
const attempt = (n: number, status: string, over: Record<string, unknown> = {}) => ({
  attempt: n, adapter: "odoo", status, transactionId: null, reused: null, error: null,
  requestedAt: `2026-10-29T04:0${n}:00Z`, respondedAt: `2026-10-29T04:0${n}:05Z`, ...over,
});
const details: Record<string, unknown> = {
  s1: {
    ...row("s1", "DOC-000301", "SYNC_FAILED"), version: 3, mimeType: "application/pdf", confidence: "0.97", data, fieldMeta: {}, validationIssues: [], riskFlags: [],
    verifiedById: "u-x", edits: [], history: [], erpTransactionId: null, syncedAt: null, syncError: REASON,
    syncAttempts: [attempt(1, "FAILED", { error: "Odoo ไม่ตอบสนอง (503)" }), attempt(2, "FAILED", { error: REASON })],
  },
  s2: {
    ...row("s2", "DOC-000302", "SYNCED"), version: 3, mimeType: "application/pdf", confidence: "0.97", data, fieldMeta: {}, validationIssues: [], riskFlags: [],
    verifiedById: "u-x", edits: [], history: [], erpTransactionId: "1532", syncedAt: "2026-10-29T04:01:05Z", syncError: null,
    syncAttempts: [attempt(1, "SUCCESS", { transactionId: "1532", reused: false })],
  },
};

async function mockBackend(page: Page, roles: Role[]) {
  const user = { id: "u-me", email: "me@test.local", displayName: "ผู้ทดสอบ", roles, mustChangePassword: false };
  await page.route(/\/(auth|api)\//, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/auth/refresh") return json(route, 200, { accessToken: "t", expiresIn: 900, user });
    if (path === "/api/documents") return json(route, 200, { items: rows, serverTime: new Date().toISOString() });
    const m = /^\/api\/documents\/(s\d)(\/.*)?$/.exec(path);
    if (m && !m[2]) return json(route, 200, details[m[1]!]);
    return json(route, 404, { message: "ไม่พบ" });
  });
}

test.describe("6.4 สถานะการส่ง ERP", () => {
  test("คิวเอกสาร: แถวที่ส่งไม่สำเร็จแสดงเหตุผล แถวที่ส่งแล้วแสดงเลขอ้างอิง ERP", async ({ page }) => {
    await mockBackend(page, ["AP_CLERK"]);
    await page.goto("/documents");
    await page.getByRole("tab", { name: /ล้มเหลว/ }).click();
    await expect(page.locator('[data-doc="DOC-000301"]').getByTestId("sync-error")).toHaveText(REASON);
    await page.getByRole("tab", { name: /เสร็จแล้ว/ }).click();
    await expect(page.locator('[data-doc="DOC-000302"]').getByTestId("erp-ref")).toHaveText("ERP 1532");
  });

  test("Clerk เปิดเอกสาร SYNC_FAILED เห็นเหตุผลล่าสุดและประวัติการส่ง แต่ไม่มีปุ่มส่งใหม่", async ({ page }) => {
    await mockBackend(page, ["AP_CLERK"]);
    await page.goto("/documents/s1");
    const panel = page.getByRole("region", { name: "การส่งเข้า ERP" });
    await expect(panel.getByTestId("sync-error")).toContainText(REASON);
    const attempts = panel.getByTestId("sync-attempts").locator("tbody tr");
    await expect(attempts).toHaveCount(2);
    await expect(attempts.first()).toContainText("Odoo ไม่ตอบสนอง (503)");
    await expect(page.getByRole("button", { name: /ส่งใหม่/ })).toHaveCount(0);
  });

  test("เอกสาร SYNCED แสดงเลขอ้างอิง ERP และเวลาที่ส่ง", async ({ page }) => {
    await mockBackend(page, ["FINANCE_EXEC"]);
    await page.goto("/documents/s2");
    await expect(page.getByTestId("erp-ref")).toHaveText("เลขอ้างอิง ERP 1532 · ส่งสำเร็จ 29/10/2569 11:01");
    await expect(page.getByTestId("sync-attempts")).toContainText("สำเร็จ");
  });

  test("Admin เห็นเลขเอกสารในหน้าติดตามแบบไม่มีลิงก์ (ไม่มีสิทธิ์เปิดเอกสาร)", async ({ page }) => {
    await mockBackend(page, ["SYS_ADMIN"]);
    await page.route(/\/api\/ops\//, (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/overview"))
        return json(route, 200, { counts: { SYNC_FAILED: 1 }, queues: { extract: 0, sync: 0 }, lastSyncedAt: null, autoSync: false, connected: true, serverTime: new Date().toISOString() });
      return json(route, 200, { items: [{ id: "s1", docNo: "DOC-000301", vendorName: "x", grandTotal: "1.00", attempts: 2, syncError: REASON, failedAt: "2026-10-29T04:02:05Z" }] });
    });
    await page.goto("/admin/sync");
    await expect(page.getByText("DOC-000301")).toBeVisible();
    await expect(page.getByRole("link", { name: "DOC-000301" })).toHaveCount(0);
  });
});
