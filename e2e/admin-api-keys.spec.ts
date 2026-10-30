// หน้า /admin/api-keys (task 5.1 ของ complete-missing-features, spec api-keys) — API จำลองด้วย page.route
import { expect, test, type Page, type Route } from "@playwright/test";

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const KEY = "sdes_AbCdEfGh_" + "s".repeat(43);
const existing = {
  id: "k1",
  name: "สคริปต์นำเข้า",
  prefix: "ZyXwVuTs",
  scopes: ["document.read"],
  expiresAt: "2027-01-28T00:00:00Z",
  lastUsedAt: "2026-10-30T03:05:00Z" as string | null,
  createdAt: "2026-10-01T03:00:00Z",
  createdBy: "ผู้ดูแล ทดสอบ",
  revokedAt: null as string | null,
  revokedBy: null as string | null,
  status: "active",
};

async function mockBackend(page: Page) {
  const keys = [{ ...existing }];
  const calls: { method: string; path: string; body?: Record<string, unknown> }[] = [];
  const user = { id: "u-me", email: "admin@test.local", displayName: "ผู้ดูแล ทดสอบ", roles: ["SYS_ADMIN"], mustChangePassword: false };
  await page.route(/\/(auth|api)\//, async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const body = req.postData() ? JSON.parse(req.postData()!) : undefined;
    calls.push({ method: req.method(), path, body });
    if (path === "/auth/refresh") return json(route, 200, { accessToken: "t", expiresIn: 900, user });
    if (path === "/api/admin/api-keys" && req.method() === "GET") return json(route, 200, keys);
    if (path === "/api/admin/api-keys" && req.method() === "POST") {
      const k = { ...existing, id: "k2", name: body.name, prefix: "AbCdEfGh", scopes: body.scopes, lastUsedAt: null, createdAt: new Date().toISOString() };
      keys.unshift(k);
      return json(route, 201, { key: KEY, apiKey: k });
    }
    const m = /^\/api\/admin\/api-keys\/(\w+)\/revoke$/.exec(path);
    if (m) {
      const k = keys.find((x) => x.id === m[1])!;
      Object.assign(k, { status: "revoked", revokedAt: "2026-10-30T04:00:00Z", revokedBy: "ผู้ดูแล ทดสอบ" });
      return json(route, 200, k);
    }
    return json(route, 404, { message: "ไม่พบ" });
  });
  return { calls };
}

test.describe("5.1 API keys", () => {
  test("รายการแสดงชื่อ ส่วนต้นของ key ขอบเขต และเวลาใช้ล่าสุด โดยไม่มีค่าเต็ม", async ({ page }) => {
    await mockBackend(page);
    await page.goto("/admin/api-keys");
    const row = page.locator('[data-key="สคริปต์นำเข้า"]');
    await expect(row).toContainText("sdes_ZyXwVuTs_…");
    await expect(row).toContainText("อ่านสถานะเอกสาร");
    await expect(row.getByTestId("last-used")).toHaveText("30/10/2569 10:05");
    await expect(row.getByTestId("key-status")).toHaveText("ใช้งานได้");
  });

  test("สร้าง key: เห็นค่าครั้งเดียว, ปิดได้หลังยืนยันว่าเก็บแล้ว และไม่เห็นค่าอีก", async ({ page }) => {
    const { calls } = await mockBackend(page);
    await page.goto("/admin/api-keys");
    await page.getByRole("button", { name: "สร้าง API key" }).click();
    const form = page.getByRole("dialog", { name: "สร้าง API key" });
    await form.getByLabel("ชื่อ (บอกว่าใช้กับระบบไหน)").fill("เครื่องสแกนชั้น 3");
    await form.getByRole("button", { name: "สร้าง" }).click();
    const reveal = page.getByRole("dialog", { name: "API key: เครื่องสแกนชั้น 3" });
    await expect(reveal.getByTestId("api-key-value")).toHaveText(KEY);
    expect(calls.find((c) => c.method === "POST" && c.path === "/api/admin/api-keys")?.body).toEqual({ name: "เครื่องสแกนชั้น 3", scopes: ["document.upload"], expiresInDays: 90 });
    // ปิดด้วย Esc หรือปุ่มปิดไม่ได้จนกว่าจะยืนยัน
    await page.keyboard.press("Escape");
    await expect(reveal).toBeVisible();
    await expect(reveal.getByRole("button", { name: "ปิด" })).toBeDisabled();
    await reveal.getByLabel("ฉันเก็บ key นี้ไว้แล้ว").check();
    await reveal.getByRole("button", { name: "ปิด" }).click();
    await expect(reveal).toHaveCount(0);
    await expect(page.getByText(KEY)).toHaveCount(0);
    await expect(page.locator('[data-key="เครื่องสแกนชั้น 3"]')).toContainText("sdes_AbCdEfGh_…");
  });

  test("ไม่เลือกขอบเขตหรืออายุนอกช่วง กดสร้างไม่ได้", async ({ page }) => {
    const { calls } = await mockBackend(page);
    await page.goto("/admin/api-keys");
    await page.getByRole("button", { name: "สร้าง API key" }).click();
    const form = page.getByRole("dialog", { name: "สร้าง API key" });
    await form.getByLabel("ชื่อ (บอกว่าใช้กับระบบไหน)").fill("x");
    await form.getByRole("checkbox", { name: /^อัปโหลดเอกสาร/ }).uncheck();
    await expect(form.getByText("เลือกขอบเขตสิทธิ์อย่างน้อยหนึ่งอย่าง")).toBeVisible();
    await expect(form.getByRole("button", { name: "สร้าง" })).toBeDisabled();
    await form.getByRole("checkbox", { name: /^อ่านสถานะเอกสาร/ }).check();
    await form.getByLabel("อายุ (วัน)").fill("400");
    await expect(form.getByText("อายุต้องอยู่ระหว่าง 1 ถึง 365 วัน")).toBeVisible();
    await expect(form.getByRole("button", { name: "สร้าง" })).toBeDisabled();
    expect(calls.some((c) => c.method === "POST" && c.path === "/api/admin/api-keys")).toBe(false);
  });

  test("เพิกถอนผ่านกล่องยืนยันแล้วสถานะเปลี่ยนพร้อมผู้เพิกถอน", async ({ page }) => {
    const { calls } = await mockBackend(page);
    await page.goto("/admin/api-keys");
    const row = page.locator('[data-key="สคริปต์นำเข้า"]');
    await row.getByRole("button", { name: "เพิกถอน" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "เพิกถอน" }).click();
    await expect(row.getByTestId("key-status")).toHaveText("เพิกถอนแล้ว");
    await expect(row).toContainText("โดย ผู้ดูแล ทดสอบ 30/10/2569 11:00");
    await expect(row.getByRole("button", { name: "เพิกถอน" })).toHaveCount(0);
    expect(calls.some((c) => c.path === "/api/admin/api-keys/k1/revoke")).toBe(true);
  });
});
