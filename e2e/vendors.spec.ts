// หน้า /vendors และ /vendors/[id] (task 5.3 ของ complete-missing-features, spec vendor-directory) — API จำลองด้วย page.route
import { expect, test, type Page, type Route } from "@playwright/test";

type Role = "AP_CLERK" | "AP_LEAD" | "FINANCE_EXEC" | "SYS_ADMIN";
const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const vendor = (i: number, over: Record<string, unknown> = {}) => ({
  id: `v${i}`,
  name: `บริษัท ผู้ขาย ${i} จำกัด`,
  taxId: `01055360000${String(i).padStart(2, "0")}`,
  branchCode: "00000",
  erpPartnerId: null,
  documentCount: 3,
  totalAmount: "10700.00",
  lastInvoiceDate: "2026-10-15",
  isNew: false,
  ...over,
});
const all = [
  vendor(1, { erpPartnerId: "77", totalAmount: "1234567.50" }),
  vendor(2, { isNew: true, documentCount: 1, totalAmount: "0.00" }),
  ...Array.from({ length: 58 }, (_, i) => vendor(i + 3)),
];

async function mockBackend(page: Page, roles: Role[] = ["AP_CLERK"]) {
  const calls: { path: string; query: Record<string, string> }[] = [];
  const user = { id: "u-me", email: "me@test.local", displayName: "ผู้ทดสอบ", roles, mustChangePassword: false };
  await page.route(/\/(auth|api)\//, async (route) => {
    const url = new URL(route.request().url());
    const query = Object.fromEntries(url.searchParams);
    calls.push({ path: url.pathname, query });
    if (url.pathname === "/auth/refresh") return json(route, 200, { accessToken: "t", expiresIn: 900, user });
    if (url.pathname === "/api/vendors") {
      const q = query.q ?? "";
      const hits = all.filter((v) => !q || v.taxId.startsWith(q) || v.name.includes(q));
      const page = Number(query.page ?? 1);
      const size = Number(query.pageSize ?? 50);
      return json(route, 200, { items: hits.slice((page - 1) * size, page * size), total: hits.length, page, pageSize: size });
    }
    if (url.pathname === "/api/vendors/v1")
      return json(route, 200, {
        vendor: all[0],
        documents: [
          { id: "d2", docNo: "DOC-000302", invoiceNo: "IV-2", invoiceDate: "2026-10-15", grandTotal: "1070.00", status: "SYNCED" },
          { id: "d1", docNo: "DOC-000301", invoiceNo: "IV-1", invoiceDate: "2026-09-01", grandTotal: "200.50", status: "REJECTED" },
        ],
      });
    return json(route, 404, { message: "ไม่พบ" });
  });
  return { calls };
}

const rows = (page: Page) => page.getByRole("region", { name: "รายการผู้ขาย" }).locator("tbody tr");

test.describe("5.3 ทะเบียนผู้ขาย", () => {
  test("รายการแสดง Tax ID สาขา จำนวน ยอดรวม คู่ค้า ERP และป้ายผู้ขายรายใหม่", async ({ page }) => {
    await mockBackend(page);
    await page.goto("/vendors");
    await expect(rows(page)).toHaveCount(50);
    const v1 = page.locator('[data-vendor="v1"]');
    await expect(v1).toContainText("0105536000001");
    await expect(v1).toContainText("สำนักงานใหญ่");
    await expect(v1).toContainText("1,234,567.50");
    await expect(v1).toContainText("77");
    await expect(v1.getByTestId("new-vendor")).toHaveCount(0);
    await expect(page.locator('[data-vendor="v2"]').getByTestId("new-vendor")).toHaveText("ผู้ขายรายใหม่");
  });

  test("ค้นหาด้วย Tax ID หลังหยุดพิมพ์ และแบ่งหน้า", async ({ page }) => {
    const { calls } = await mockBackend(page);
    await page.goto("/vendors");
    await expect(page.getByTestId("vendor-page")).toHaveText("หน้า 1 จาก 2 · 60 ราย");
    await page.getByRole("button", { name: "ถัดไป" }).click();
    await expect(rows(page)).toHaveCount(10);
    await page.getByRole("searchbox", { name: "ค้นหาผู้ขาย" }).fill("0105536000002");
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText("บริษัท ผู้ขาย 2 จำกัด");
    expect(calls.findLast((c) => c.path === "/api/vendors")?.query).toMatchObject({ q: "0105536000002", page: "1" });
    await page.getByRole("searchbox", { name: "ค้นหาผู้ขาย" }).fill("ไม่มีแน่นอน");
    await expect(page.getByText('ไม่พบผู้ขายที่ตรงกับ "ไม่มีแน่นอน"')).toBeVisible();
  });

  test("รายละเอียดผู้ขาย: ข้อมูลสรุปและเอกสารที่ลิงก์ไปหน้าเอกสาร ไม่มีปุ่มแก้ไข", async ({ page }) => {
    await mockBackend(page, ["AP_LEAD"]);
    await page.goto("/vendors");
    await page.getByRole("link", { name: "บริษัท ผู้ขาย 1 จำกัด" }).click();
    await expect(page).toHaveURL(/\/vendors\/v1$/, { timeout: 30_000 }); // dev server compile route ใหม่ครั้งแรก
    await expect(page.getByTestId("vendor-facts")).toContainText("1,234,567.50");
    await expect(page.getByTestId("vendor-facts")).toContainText("77");
    const docs = page.getByRole("region", { name: "เอกสารของผู้ขาย" }).locator("tbody tr");
    await expect(docs).toHaveCount(2);
    await expect(docs.first()).toContainText("IV-2");
    await expect(docs.first()).toContainText("ส่ง ERP แล้ว");
    await expect(docs.first().getByRole("link", { name: "DOC-000302" })).toHaveAttribute("href", "/documents/d2");
    await expect(page.getByRole("button", { name: /แก้|ลบ|บันทึก/ })).toHaveCount(0);
  });

  test("System Admin ไม่เห็นเมนูผู้ขายและเปิดหน้าไม่ได้", async ({ page }) => {
    const { calls } = await mockBackend(page, ["SYS_ADMIN"]);
    await page.goto("/vendors");
    await expect(page.getByText(/ไม่มีสิทธิ์/)).toBeVisible();
    await expect(page.getByRole("link", { name: "ผู้ขาย", exact: true })).toHaveCount(0);
    expect(calls.some((c) => c.path.startsWith("/api/vendors"))).toBe(false);
  });
});
