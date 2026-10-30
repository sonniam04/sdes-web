// หน้า /admin/logs (task 5.2 ของ complete-missing-features, spec system-logs) — API จำลองด้วย page.route
import { expect, test, type Page, type Route } from "@playwright/test";

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const log = (id: number, over: Record<string, unknown> = {}) => ({
  id: String(id),
  createdAt: "2026-10-30T03:00:00Z",
  service: "worker",
  level: "error",
  context: "ExtractWorker",
  message: `อ่านเอกสาร DOC-000${id} ไม่สำเร็จ`,
  details: null,
  ...over,
});

async function mockBackend(page: Page, roles = ["SYS_ADMIN"]) {
  const calls: { path: string; query: Record<string, string> }[] = [];
  const user = { id: "u-me", email: "me@test.local", displayName: "ผู้ทดสอบ", roles, mustChangePassword: false };
  await page.route(/\/(auth|api)\//, async (route) => {
    const url = new URL(route.request().url());
    const query = Object.fromEntries(url.searchParams);
    calls.push({ path: url.pathname, query });
    if (url.pathname === "/auth/refresh") return json(route, 200, { accessToken: "t", expiresIn: 900, user });
    if (url.pathname === "/api/admin/system-logs") {
      if (query.before) return json(route, 200, { items: [log(1, { level: "warn", service: "api", context: "StorageService", message: "สร้าง bucket ไม่ได้" })], nextBefore: null });
      return json(route, 200, {
        items: Array.from({ length: 50 }, (_, i) => log(200 - i, i === 0 ? { details: { stack: "Error: PDF ล็อกรหัสผ่าน\n    at extract (extract.ts:10:5)" } } : {})),
        nextBefore: "151",
      });
    }
    return json(route, 404, { message: "ไม่พบ" });
  });
  return { calls };
}

const results = (page: Page) => page.getByRole("region", { name: "ผลการค้นหา" });

test.describe("5.2 System logs", () => {
  test("ตัวกรองเวลา ระดับ บริการ และข้อความถูกส่งไป API", async ({ page }) => {
    const { calls } = await mockBackend(page);
    await page.goto("/admin/logs");
    await page.getByLabel("ตั้งแต่วันที่").fill("2026-10-30");
    await page.getByLabel("ถึงวันที่").fill("2026-10-30");
    await page.getByLabel("ระดับ").click();
    await page.getByRole("option", { name: "error" }).click();
    await page.getByLabel("บริการ").click();
    await page.getByRole("option", { name: "worker" }).click();
    await page.getByLabel("คำในข้อความ").fill(" DOC-000200 ");
    await page.getByRole("button", { name: "ค้นหา" }).click();
    await expect.poll(() => calls.findLast((c) => c.path === "/api/admin/system-logs")?.query).toMatchObject({
      from: "2026-10-30T00:00:00+07:00",
      to: "2026-10-30T23:59:59.999+07:00",
      level: "error",
      service: "worker",
      q: "DOC-000200",
    });
  });

  test("กดแถวเพื่อดูรายละเอียด และกดซ้ำเพื่อซ่อน", async ({ page }) => {
    await mockBackend(page);
    await page.goto("/admin/logs");
    const first = results(page).locator('[data-log="200"]');
    await expect(first).toContainText("อ่านเอกสาร DOC-000200 ไม่สำเร็จ");
    await expect(first).toContainText("ExtractWorker");
    await first.click();
    await expect(results(page).getByTestId("log-details")).toContainText("at extract (extract.ts:10:5)");
    await first.click();
    await expect(results(page).getByTestId("log-details")).toHaveCount(0);
  });

  test("แบ่งหน้า: ถัดไปและก่อนหน้า", async ({ page }) => {
    await mockBackend(page);
    await page.goto("/admin/logs");
    await expect(results(page).locator("[data-log]")).toHaveCount(50);
    await expect(page.getByRole("button", { name: "ก่อนหน้า" })).toBeDisabled();
    await page.getByRole("button", { name: "ถัดไป" }).click();
    await expect(results(page).locator("[data-log]")).toHaveCount(1);
    await expect(results(page)).toContainText("warning");
    await expect(page.getByTestId("page-info")).toContainText("หน้า 2");
    await page.getByRole("button", { name: "ก่อนหน้า" }).click();
    await expect(results(page).locator("[data-log]")).toHaveCount(50);
  });

  test("Finance Exec เปิดหน้าไม่ได้และไม่เรียก API", async ({ page }) => {
    const { calls } = await mockBackend(page, ["FINANCE_EXEC"]);
    await page.goto("/admin/logs");
    await expect(page.getByText(/ไม่มีสิทธิ์/)).toBeVisible();
    expect(calls.some((c) => c.path.startsWith("/api/admin/system-logs"))).toBe(false);
  });
});
