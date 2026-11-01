// หน้าภาพรวม (tasks 3.1, 3.3–3.5 ของ overview-dashboard, spec overview-dashboard) — API จำลองด้วย page.route
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

type Role = "AP_CLERK" | "AP_LEAD" | "FINANCE_EXEC" | "SYS_ADMIN";
const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const NOW = "2026-11-01T05:00:00.000Z";
const days = Array.from({ length: 14 }, (_, i) => {
  const date = new Date(Date.parse("2026-10-19T00:00:00Z") + i * 86_400_000).toISOString().slice(0, 10);
  return { date, uploaded: i === 13 ? 12 : i % 3, verified: i === 13 ? 9 : i % 2, synced: i === 13 ? 8 : 0 };
});

/** ผลลัพธ์ของ API ที่ผู้ใช้ทุกส่วนได้ — mock ตัดส่วนตามสิทธิ์แบบเดียวกับ server */
function full(waiting = 4) {
  return {
    generatedAt: NOW,
    backlog: {
      waiting: { count: waiting, oldestAt: "2026-11-01T02:00:00.000Z" },
      failed: { count: 1, oldestAt: "2026-10-31T05:00:00.000Z" },
      reading: { count: 2, oldestAt: "2026-11-01T04:59:30.000Z" },
      approval: { count: 3, oldestAt: "2026-11-01T04:00:00.000Z" },
      syncFailed: { count: 0, oldestAt: null },
    },
    throughput: { days },
    indicators: { windowDays: 7, avgSecondsToExtracted: 41, noEditRate: null, approvalRate: 0.125, targets: { seconds: 30, noEditRate: 0.92 } },
    finance: {
      month: "2026-11",
      current: { documentCount: 3, subtotal: "1100.00", vat: "77.00", wht: "30.00", grandTotal: "1147.00" },
      previous: { documentCount: 0, subtotal: "0.00", vat: "0.00", wht: "0.00", grandTotal: "0.00" },
    },
    health: {
      queues: { extract: 2, sync: 0 },
      connected: true,
      autoSync: false,
      lastSyncedAt: "2026-11-01T04:58:00.000Z",
      syncFailed: 0,
      errors24h: 3,
      expiringKeys: [{ id: "k1", name: "เครื่องสแกนชั้น 2", expiresAt: "2026-11-06T00:00:00.000Z" }],
    },
  };
}

function forRoles(roles: Role[], body: ReturnType<typeof full>) {
  const docs = roles.some((r) => r !== "SYS_ADMIN");
  const ops = roles.includes("SYS_ADMIN") || roles.includes("FINANCE_EXEC");
  const admin = roles.includes("SYS_ADMIN");
  const { errors24h, expiringKeys, ...health } = body.health;
  return {
    generatedAt: body.generatedAt,
    ...(docs && { backlog: body.backlog, throughput: body.throughput, indicators: body.indicators }),
    ...(roles.includes("FINANCE_EXEC") && { finance: body.finance }),
    ...(ops && { health: { ...health, ...(admin && { errors24h, expiringKeys }) } }),
  };
}

async function mockBackend(page: Page, roles: Role[]) {
  const user = { id: "u-me", email: "me@test.local", displayName: "ผู้ทดสอบ", roles, mustChangePassword: false };
  const state = { waiting: 4, fail: false, calls: 0 };
  await page.route(/\/(auth|api)\//, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/auth/refresh") return json(route, 200, { accessToken: "t", expiresIn: 900, user });
    if (url.pathname === "/api/dashboard") {
      state.calls++;
      if (state.fail) return json(route, 503, { message: "ระบบไม่พร้อม" });
      return json(route, 200, forRoles(roles, full(state.waiting)));
    }
    if (url.pathname === "/api/documents") return json(route, 200, { items: [], serverTime: NOW });
    return json(route, 404, { message: "ไม่พบ" });
  });
  return state;
}

const section = (page: Page, name: string) => page.getByRole("region", { name });

test.describe("3.3 หน้าภาพรวมตาม role", () => {
  test("Clerk เห็นงานค้าง ปริมาณงาน ตัวชี้วัด แต่ไม่เห็นการเงินและสุขภาพระบบ", async ({ page }) => {
    await mockBackend(page, ["AP_CLERK"]);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "ภาพรวม", level: 1 })).toBeVisible();
    await expect(section(page, "งานค้าง")).toBeVisible();
    await expect(section(page, "ปริมาณงาน 14 วัน")).toBeVisible();
    await expect(section(page, "ตัวชี้วัดตาม BRD")).toBeVisible();
    await expect(section(page, "การเงินเดือนนี้")).toHaveCount(0);
    await expect(section(page, "สุขภาพระบบ")).toHaveCount(0);
  });

  test("งานค้าง: จำนวน อายุของงานที่รอนานสุด และลิงก์ไปแท็บในคิว", async ({ page }) => {
    await mockBackend(page, ["AP_CLERK"]);
    await page.goto("/");
    const waiting = section(page, "งานค้าง").getByRole("link", { name: /รอตรวจ/ });
    await expect(waiting).toContainText("4");
    await expect(waiting).toContainText("เก่าสุด 3 ชั่วโมง");
    await expect(section(page, "งานค้าง").getByRole("link", { name: /ส่งไม่สำเร็จ/ })).toContainText("—");
    await waiting.click();
    await expect(page).toHaveURL(/\/documents\?tab=waiting$/);
    await expect(page.getByRole("tab", { name: /รอตรวจ/ })).toHaveAttribute("aria-selected", "true");
  });

  test("Lead กดงานรออนุมัติแล้วไปหน้ารออนุมัติ", async ({ page }) => {
    await mockBackend(page, ["AP_LEAD"]);
    await page.goto("/");
    await expect(section(page, "งานค้าง").getByRole("link", { name: /รออนุมัติ/ })).toHaveAttribute("href", "/approvals");
  });

  test("ปริมาณงาน: ตัวเลขวันนี้ และตาราง 14 วันสำหรับ screen reader", async ({ page }) => {
    await mockBackend(page, ["AP_CLERK"]);
    await page.goto("/");
    const s = section(page, "ปริมาณงาน 14 วัน");
    await expect(s.getByTestId("today-uploaded")).toHaveText("12");
    await expect(s.getByTestId("today-verified")).toHaveText("9");
    await expect(s.getByTestId("today-synced")).toHaveText("8");
    await expect(s.locator("table tbody tr")).toHaveCount(14);
    await expect(s.locator("table tbody tr").last()).toContainText("01/11/2569");
  });

  test("ตัวชี้วัด: ค่าที่ไม่ถึงเป้าแสดงไม่ผ่านพร้อมเป้า และค่าที่ไม่มีข้อมูลแสดงว่ายังไม่มีข้อมูล", async ({ page }) => {
    await mockBackend(page, ["AP_CLERK"]);
    await page.goto("/");
    const time = page.getByTestId("indicator-seconds");
    await expect(time).toContainText("41 วินาที");
    await expect(time).toContainText("ไม่ผ่าน");
    await expect(time).toContainText("เป้า < 30 วินาที");
    const noEdit = page.getByTestId("indicator-no-edit");
    await expect(noEdit).toContainText("ยังไม่มีข้อมูล");
    await expect(noEdit).not.toContainText("0%");
    await expect(page.getByTestId("indicator-approval")).toContainText("13%");
  });

  test("Finance Exec: การเงินเดือนนี้พร้อมลิงก์รายงาน และสุขภาพระบบแบบไม่มี error/key", async ({ page }) => {
    await mockBackend(page, ["FINANCE_EXEC"]);
    await page.goto("/");
    const f = section(page, "การเงินเดือนนี้");
    await expect(f).toContainText("พ.ย. 2569");
    await expect(f.getByTestId("finance-grand")).toContainText("1,147.00");
    await expect(f.getByTestId("finance-grand")).not.toContainText("%"); // เดือนก่อนเป็น 0 — ไม่แสดงผลต่าง
    await expect(f.getByRole("link", { name: "ดูรายงาน" })).toHaveAttribute("href", "/reports");
    const h = section(page, "สุขภาพระบบ");
    await expect(h).toContainText("เชื่อมต่อแล้ว");
    await expect(h).toContainText("ปิด");
    await expect(h.getByTestId("health-errors")).toHaveCount(0);
    await expect(h.getByTestId("health-keys")).toHaveCount(0);
  });

  test("Admin เห็นเฉพาะสุขภาพระบบ พร้อม error 24 ชั่วโมงและ key ใกล้หมดอายุ", async ({ page }) => {
    await mockBackend(page, ["SYS_ADMIN"]);
    await page.goto("/");
    await expect(section(page, "งานค้าง")).toHaveCount(0);
    await expect(section(page, "การเงินเดือนนี้")).toHaveCount(0);
    const h = section(page, "สุขภาพระบบ");
    await expect(h.getByTestId("health-errors")).toContainText("3");
    await expect(h.getByRole("link", { name: /error ใน 24 ชั่วโมง/ })).toHaveAttribute("href", "/admin/logs?level=error");
    await expect(h.getByTestId("health-keys")).toContainText("เครื่องสแกนชั้น 2");
    await expect(h.getByTestId("health-keys")).toContainText("06/11/2569");
  });
});

test.describe("3.4 อัปเดตอัตโนมัติ", () => {
  test("ตัวเลขเปลี่ยนหลัง 30 วินาที, ดึงไม่สำเร็จแล้วคงตัวเลขเดิมพร้อมข้อความ, หยุดเมื่อแท็บถูกซ่อน", async ({ page }) => {
    await page.clock.install();
    const state = await mockBackend(page, ["AP_CLERK"]);
    await page.goto("/");
    const waiting = section(page, "งานค้าง").getByRole("link", { name: /รอตรวจ/ });
    await expect(waiting).toContainText("4");

    state.waiting = 5;
    await page.clock.runFor(30_000);
    await expect(waiting).toContainText("5");

    state.fail = true;
    await page.clock.runFor(30_000);
    await expect(page.getByRole("status").filter({ hasText: "ข้อมูลอาจไม่เป็นปัจจุบัน" })).toBeVisible();
    await expect(waiting).toContainText("5");

    state.fail = false;
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const before = state.calls;
    await page.clock.runFor(90_000);
    expect(state.calls).toBe(before);

    state.waiting = 6;
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(waiting).toContainText("6");
    await expect(page.getByText("ข้อมูลอาจไม่เป็นปัจจุบัน")).toHaveCount(0);
  });
});

test.describe("3.5 เลย์เอาต์และการเข้าถึง", () => {
  for (const [w, h] of [
    [1366, 768],
    [1200, 800],
  ] as const) {
    test(`ที่ ${w}×${h} ไม่มีปัญหา axe ระดับ serious และไม่มี scroll แนวนอน`, async ({ page }, info) => {
      await page.setViewportSize({ width: w, height: h });
      await mockBackend(page, ["AP_LEAD", "FINANCE_EXEC", "SYS_ADMIN"]);
      await page.goto("/");
      await expect(section(page, "สุขภาพระบบ")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`dashboard-${w}.png`), fullPage: true });
      const result = await new AxeBuilder({ page }).analyze();
      expect(result.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
    });
  }
});
