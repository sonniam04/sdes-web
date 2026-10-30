// หน้า /admin/erp (task 6.1, spec erp-connection) — API จำลองด้วย page.route
import { expect, test, type Page, type Route } from "@playwright/test";

type Role = "AP_CLERK" | "AP_LEAD" | "FINANCE_EXEC" | "SYS_ADMIN";
const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const configured = {
  configured: true as const,
  adapter: "odoo",
  url: "http://odoo:8069",
  database: "sdes_erp",
  apiMode: "json2",
  login: null,
  journalId: 2,
  purchaseTaxId: 7,
  expenseAccountId: 40,
  hasSecret: true,
  autoSync: false,
  testedAt: null as string | null,
  testPassed: false,
};
type Conn = typeof configured | { configured: false; autoSync: false };
type Check = { key: string; label: string; ok: boolean | null; message: string };

const passing: Check[] = [
  { key: "reach", label: "เข้าถึงปลายทาง", ok: true, message: "เข้าถึงได้" },
  { key: "auth", label: "ยืนยันตัวตนด้วย API key", ok: true, message: "ยืนยันตัวตนผ่าน" },
  { key: "journal", label: "Journal ซื้อ", ok: true, message: "Vendor Bills" },
  { key: "tax", label: "ภาษีซื้อ 7%", ok: true, message: "ภาษีซื้อ 7%" },
  { key: "account", label: "บัญชีค่าใช้จ่าย", ok: true, message: "ค่าใช้จ่ายทั่วไป" },
];

async function mockBackend(page: Page, opts: { roles?: Role[]; conn: Conn; checks?: Check[] }) {
  let conn: Conn = opts.conn;
  const calls: { method: string; path: string; body?: Record<string, unknown> }[] = [];
  const user = { id: "u-me", email: "admin@test.local", displayName: "ผู้ดูแล ทดสอบ", roles: opts.roles ?? ["SYS_ADMIN"], mustChangePassword: false };
  await page.route(/\/(auth|api)\//, async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const body = req.postData() ? JSON.parse(req.postData()!) : undefined;
    calls.push({ method: req.method(), path, body });
    if (path === "/auth/refresh") return json(route, 200, { accessToken: "t", expiresIn: 900, user });
    if (path === "/api/erp/connection" && req.method() === "GET") return json(route, 200, conn);
    if (path === "/api/erp/connection" && req.method() === "PUT") {
      if (!/^https?:\/\//.test(body.url)) return json(route, 400, { message: "URL ต้องขึ้นต้นด้วย http:// หรือ https://", field: "url" });
      const prev = conn.configured ? conn : configured;
      const { secret, ...rest } = body;
      // แก้การตั้งค่า = ต้องทดสอบใหม่ และสวิตช์ปิด
      conn = { ...prev, ...rest, hasSecret: prev.hasSecret || !!secret, autoSync: false, testPassed: false, configured: true };
      return json(route, 200, conn);
    }
    if (path === "/api/erp/connection/test") {
      const checks = opts.checks ?? passing;
      const ok = checks.every((c) => c.ok);
      if (ok && conn.configured) conn = { ...conn, testPassed: true, testedAt: "2026-10-30T03:00:00Z" };
      return json(route, 200, { ok, checks });
    }
    if (path === "/api/erp/connection/auto-sync") {
      if (body.enabled && !(conn.configured && conn.testPassed)) return json(route, 409, { code: "NOT_TESTED", message: "ทดสอบการเชื่อมต่อให้ผ่านก่อนเปิดการส่งอัตโนมัติ" });
      conn = { ...(conn as typeof configured), autoSync: body.enabled };
      return json(route, 200, conn);
    }
    return json(route, 404, { message: "ไม่พบ" });
  });
  return { calls, current: () => conn };
}

const autoSwitch = (page: Page) => page.getByRole("switch", { name: "ส่งเอกสารไป ERP อัตโนมัติ" });

test.describe("6.1 ตั้งค่าการเชื่อมต่อ ERP", () => {
  test("ตั้งค่า Odoo ครั้งแรก: บันทึกครบแล้วหน้าแสดงค่าทั้งหมดยกเว้น API key", async ({ page }) => {
    const { calls } = await mockBackend(page, { conn: { configured: false, autoSync: false } });
    await page.goto("/admin/erp");
    await expect(autoSwitch(page)).toBeDisabled();
    await expect(page.getByTestId("auto-sync-reason")).toHaveText("บันทึกการตั้งค่าการเชื่อมต่อก่อน");

    await page.getByRole("button", { name: "บันทึก" }).click();
    await expect(page.getByText("ต้องระบุ API key ของ Odoo")).toBeVisible();
    expect(calls.some((c) => c.method === "PUT")).toBe(false);

    await page.getByLabel("URL ของ Odoo").fill("http://odoo:8069");
    await page.getByLabel("ฐานข้อมูล").fill("sdes_erp");
    await page.getByLabel("Journal ซื้อ (id)").fill("2");
    await page.getByLabel("ภาษีซื้อ 7% (id)").fill("7");
    await page.getByLabel("บัญชีค่าใช้จ่าย (id)").fill("40");
    await page.getByLabel("API key").fill("super-secret-key");
    await page.getByRole("button", { name: "บันทึก" }).click();
    await expect(page.getByText("บันทึกการตั้งค่าแล้ว", { exact: true })).toBeVisible();

    expect(calls.find((c) => c.method === "PUT")?.body).toEqual({
      adapter: "odoo",
      url: "http://odoo:8069",
      database: "sdes_erp",
      apiMode: "json2",
      login: null,
      journalId: 2,
      purchaseTaxId: 7,
      expenseAccountId: 40,
      secret: "super-secret-key",
    });
    await expect(page.getByLabel("URL ของ Odoo")).toHaveValue("http://odoo:8069");
    await expect(page.getByLabel("Journal ซื้อ (id)")).toHaveValue("2");
    await expect(page.getByLabel("API key")).toHaveValue("");
    await expect(page.getByText("ตั้งแล้ว — กรอกเฉพาะเมื่อต้องการเปลี่ยน", { exact: false })).toBeVisible();
  });

  test("URL ที่ไม่ใช่ http(s) ถูกปฏิเสธที่ช่อง URL", async ({ page }) => {
    const { calls } = await mockBackend(page, { conn: configured });
    await page.goto("/admin/erp");
    const url = page.getByLabel("URL ของ Odoo");
    await url.fill("ftp://odoo");
    await page.getByRole("button", { name: "บันทึก" }).click();
    await expect(url).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("URL ต้องขึ้นต้นด้วย http:// หรือ https://")).toBeVisible();
    expect(calls.some((c) => c.method === "PUT")).toBe(false);
  });

  test("เว้น API key ว่างตอนแก้ = ไม่ส่ง secret (คงค่าเดิม)", async ({ page }) => {
    const { calls } = await mockBackend(page, { conn: configured });
    await page.goto("/admin/erp");
    await page.getByLabel("Journal ซื้อ (id)").fill("3");
    await page.getByRole("button", { name: "บันทึก" }).click();
    await expect(page.getByText("บันทึกการตั้งค่าแล้ว", { exact: true })).toBeVisible();
    const put = calls.find((c) => c.method === "PUT")!.body!;
    expect(put.journalId).toBe(3);
    expect("secret" in put).toBe(false);
  });

  test("API key ผิด → ยืนยันตัวตนไม่ผ่าน ข้อที่เหลือไม่ได้ตรวจ และเปิดส่งอัตโนมัติไม่ได้", async ({ page }) => {
    await mockBackend(page, {
      conn: configured,
      checks: [
        { key: "reach", label: "เข้าถึงปลายทาง", ok: true, message: "เข้าถึงได้" },
        { key: "auth", label: "ยืนยันตัวตนด้วย API key", ok: false, message: "Odoo ปฏิเสธ API key" },
        { key: "journal", label: "Journal ซื้อ", ok: null, message: "ไม่ได้ตรวจ" },
        { key: "tax", label: "ภาษีซื้อ 7%", ok: null, message: "ไม่ได้ตรวจ" },
        { key: "account", label: "บัญชีค่าใช้จ่าย", ok: null, message: "ไม่ได้ตรวจ" },
      ],
    });
    await page.goto("/admin/erp");
    await page.getByRole("button", { name: "ทดสอบการเชื่อมต่อ" }).click();
    const results = page.getByRole("region", { name: "ผลการทดสอบ" });
    await expect(results.locator('[data-check="auth"]')).toHaveAttribute("data-ok", "false");
    await expect(results.locator('[data-check="auth"]')).toContainText("Odoo ปฏิเสธ API key");
    for (const k of ["journal", "tax", "account"]) await expect(results.locator(`[data-check="${k}"]`)).toHaveAttribute("data-ok", "skipped");
    await expect(autoSwitch(page)).toBeDisabled();
    await expect(page.getByTestId("auto-sync-reason")).toHaveText("ทดสอบการเชื่อมต่อให้ผ่านก่อนเปิดการส่งอัตโนมัติ");
  });

  test("รหัสภาษีไม่มีใน Odoo → เฉพาะข้อรหัสภาษีไม่ผ่าน", async ({ page }) => {
    await mockBackend(page, { conn: configured, checks: passing.map((c) => (c.key === "tax" ? { ...c, ok: false, message: "ไม่พบรหัสภาษีที่ตั้งไว้" } : c)) });
    await page.goto("/admin/erp");
    await page.getByRole("button", { name: "ทดสอบการเชื่อมต่อ" }).click();
    const results = page.getByRole("region", { name: "ผลการทดสอบ" });
    await expect(results.locator('[data-check="tax"]')).toHaveAttribute("data-ok", "false");
    for (const k of ["reach", "auth", "journal", "account"]) await expect(results.locator(`[data-check="${k}"]`)).toHaveAttribute("data-ok", "true");
  });

  test("ทดสอบผ่านแล้วเปิดส่งอัตโนมัติได้ และแก้ URL แล้วการส่งอัตโนมัติถูกปิด", async ({ page }) => {
    const { calls, current } = await mockBackend(page, { conn: configured });
    await page.goto("/admin/erp");
    await page.getByRole("button", { name: "ทดสอบการเชื่อมต่อ" }).click();
    await expect(page.getByText("ทดสอบผ่านล่าสุด 30/10/2569 10:00")).toBeVisible();
    await expect(autoSwitch(page)).toBeEnabled();
    await autoSwitch(page).click();
    await expect(autoSwitch(page)).toHaveAttribute("aria-checked", "true");
    expect(calls.find((c) => c.path.endsWith("/auto-sync"))?.body).toEqual({ enabled: true });

    await page.getByLabel("URL ของ Odoo").fill("http://odoo-new:8069");
    // แก้แล้วยังไม่บันทึก: ต้องบันทึกก่อนทดสอบ
    await expect(page.getByRole("button", { name: "ทดสอบการเชื่อมต่อ" })).toBeDisabled();
    await page.getByRole("button", { name: "บันทึก" }).click();
    await expect(page.getByText("บันทึกแล้ว การส่งอัตโนมัติถูกปิด ทดสอบการเชื่อมต่ออีกครั้งก่อนเปิด", { exact: true })).toBeVisible();
    await expect(autoSwitch(page)).toHaveAttribute("aria-checked", "false");
    await expect(autoSwitch(page)).toBeDisabled();
    expect(current().autoSync).toBe(false);
  });

  test("Finance Exec เปิดหน้าตั้งค่า ERP ไม่ได้ และไม่เรียก API การตั้งค่า", async ({ page }) => {
    const { calls } = await mockBackend(page, { roles: ["FINANCE_EXEC"], conn: configured });
    await page.goto("/admin/erp");
    await expect(page.getByRole("heading", { name: "การเชื่อมต่อ ERP" })).toHaveCount(0);
    expect(calls.some((c) => c.path.startsWith("/api/erp"))).toBe(false);
  });
});
