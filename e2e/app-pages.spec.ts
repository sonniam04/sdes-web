// หน้า login / เปลี่ยนรหัส / เอกสาร / จัดการผู้ใช้ — ใช้ API จำลองด้วย page.route (ไม่ต้องมี backend)
// การทดสอบกับ backend จริงอยู่ในกลุ่ม 8 (E2E ตลอดสาย)
import { expect, test, type Page, type Route } from "@playwright/test";

type Role = "AP_CLERK" | "AP_LEAD" | "FINANCE_EXEC" | "SYS_ADMIN";
const userOf = (roles: Role[], mustChangePassword = false) => ({
  id: "u-me",
  email: "me@test.local",
  displayName: "สมศรี ทดสอบ",
  roles,
  mustChangePassword,
});
const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

/** backend จำลอง: เริ่มแบบยังไม่ล็อกอิน; login สำเร็จเมื่อรหัส = "correct-password" */
async function mockBackend(page: Page, opts: { roles: Role[]; mustChangePassword?: boolean; loggedIn?: boolean }) {
  let session: ReturnType<typeof userOf> | null = opts.loggedIn ? userOf(opts.roles, opts.mustChangePassword) : null;
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const docs = [
    { id: "d1", docNo: "DOC-000101", status: "EXTRACTED", fileName: "a.pdf", vendorName: "บริษัท ตัวอย่าง จำกัด", invoiceNo: "IV-1", invoiceDate: "2026-10-28", grandTotal: "48150.00", createdAt: "2026-10-29T03:00:00Z", updatedAt: "2026-10-29T03:00:00Z" },
    { id: "d2", docNo: "DOC-000102", status: "FAILED", fileName: "blurry.jpg", vendorName: null, invoiceNo: null, invoiceDate: null, grandTotal: null, createdAt: "2026-10-29T02:00:00Z", updatedAt: "2026-10-29T02:00:00Z" },
  ];
  const users = [
    { id: "u-me", email: "me@test.local", displayName: "สมศรี ทดสอบ", roles: ["SYS_ADMIN"], isActive: true, mustChangePassword: false },
    { id: "u-2", email: "clerk@test.local", displayName: "สมชาย บัญชี", roles: ["AP_CLERK"], isActive: true, mustChangePassword: false },
  ];

  await page.route(/\/(auth|api)\//, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const body = req.postData() && req.headers()["content-type"]?.includes("json") ? JSON.parse(req.postData()!) : undefined;
    calls.push({ method: req.method(), path, body });
    const ok = (s = session!) => ({ accessToken: "token", expiresIn: 900, user: s });

    if (path === "/auth/refresh") return session ? json(route, 200, ok()) : json(route, 401, { message: "เซสชันหมดอายุ" });
    if (path === "/auth/logout") {
      session = null;
      return route.fulfill({ status: 204 });
    }
    if (path === "/auth/login") {
      if (body.password !== "correct-password") return json(route, 401, { message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
      session = userOf(opts.roles, opts.mustChangePassword);
      return json(route, 200, ok());
    }
    if (path === "/auth/change-password") {
      if (body.currentPassword !== "correct-password") return json(route, 403, { message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" });
      session = { ...session!, mustChangePassword: false };
      return json(route, 200, { accessToken: "token2", expiresIn: 900 });
    }
    if (path === "/api/documents" && req.method() === "GET") return json(route, 200, { items: docs, serverTime: new Date().toISOString() });
    if (path === "/api/documents" && req.method() === "POST") {
      return json(route, 201, {
        results: [
          { fileName: "invoice-1.pdf", ok: true, id: "d3", docNo: "DOC-000103", status: "UPLOADED" },
          { fileName: "invoice-2.pdf", ok: false, code: "duplicate", message: "ไฟล์ซ้ำกับเอกสาร DOC-000101", duplicateOf: "DOC-000101" },
        ],
      });
    }
    if (path === "/api/documents/d2/retry") {
      docs[1]!.status = "PROCESSING";
      return json(route, 200, { id: "d2", docNo: "DOC-000102", status: "PROCESSING" });
    }
    if (path === "/api/admin/users" && req.method() === "GET") return json(route, 200, users);
    if (path === "/api/admin/users" && req.method() === "POST") {
      const u = { id: `u-${users.length + 1}`, ...body, isActive: true, mustChangePassword: true };
      users.push(u);
      return json(route, 201, { user: u, temporaryPassword: "Tmp-Password-1234" });
    }
    const m = /^\/api\/admin\/users\/([^/]+)\/(roles|deactivate|activate|reset-password)$/.exec(path);
    if (m) {
      const u = users.find((x) => x.id === m[1])!;
      if (m[2] === "roles") u.roles = body.roles;
      if (m[2] === "deactivate") u.isActive = false;
      if (m[2] === "activate") u.isActive = true;
      if (m[2] === "reset-password") return json(route, 200, { user: u, temporaryPassword: "Reset-Pass-5678" });
      return json(route, 200, u);
    }
    return json(route, 404, { message: "ไม่พบ" });
  });
  return { calls };
}

test.describe("7.3 login และเปลี่ยนรหัสผ่านชั่วคราว", () => {
  test("ล็อกอินสำเร็จ → ไปหน้าเอกสาร", async ({ page }) => {
    await mockBackend(page, { roles: ["AP_CLERK"] });
    await page.goto("/login");
    await page.getByLabel("อีเมล").fill("me@test.local");
    await page.getByLabel("รหัสผ่าน").fill("correct-password");
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
    await expect(page).toHaveURL(/\/documents$/);
    await expect(page.getByRole("heading", { name: "คิวเอกสาร" })).toBeVisible();
  });

  test("รหัสผิด → ข้อความกลางและล้างช่องรหัสผ่าน", async ({ page }) => {
    await mockBackend(page, { roles: ["AP_CLERK"] });
    await page.goto("/login");
    await page.getByLabel("อีเมล").fill("me@test.local");
    await page.getByLabel("รหัสผ่าน").fill("wrong");
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" })).toHaveText("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    await expect(page.getByLabel("รหัสผ่าน")).toHaveValue("");
    await expect(page).toHaveURL(/\/login/);
  });

  test("รหัสชั่วคราว → ถูกบังคับไปเปลี่ยนรหัส แล้วจึงเข้าใช้งานได้", async ({ page }) => {
    await mockBackend(page, { roles: ["AP_CLERK"], mustChangePassword: true });
    await page.goto("/login");
    await page.getByLabel("อีเมล").fill("me@test.local");
    await page.getByLabel("รหัสผ่าน").fill("correct-password");
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
    await expect(page).toHaveURL(/\/change-password$/);
    await expect(page.getByText("รหัสผ่านนี้เป็นรหัสชั่วคราว")).toBeVisible();

    // เข้าหน้าอื่นตรง ๆ ก็ถูกพากลับมา
    await page.goto("/documents");
    await expect(page).toHaveURL(/\/change-password$/);

    await page.getByLabel("รหัสผ่านปัจจุบัน").fill("correct-password");
    await page.getByLabel("รหัสผ่านใหม่", { exact: true }).fill("short");
    await expect(page.getByText("รหัสผ่านใหม่ต้องยาวอย่างน้อย 12 ตัวอักษร")).toBeVisible();
    await page.getByLabel("รหัสผ่านใหม่", { exact: true }).fill("a-new-long-password-2569");
    await page.getByLabel("ยืนยันรหัสผ่านใหม่").fill("a-new-long-password-2569");
    await page.getByRole("button", { name: "บันทึกรหัสผ่านใหม่" }).click();
    await expect(page).toHaveURL(/\/documents$/);
  });

  test("ยังไม่ล็อกอิน → หน้าที่ต้องล็อกอินพาไป /login พร้อม next", async ({ page }) => {
    await mockBackend(page, { roles: ["AP_CLERK"] });
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fusers/);
  });
});

test.describe("7.4 หน้าเอกสาร (API จำลอง)", () => {
  test("คิวแบ่งแท็บตามกลุ่มสถานะ อัปโหลดหลายไฟล์ได้ผลรายไฟล์ และกดอ่านใหม่", async ({ page }) => {
    const { calls } = await mockBackend(page, { roles: ["AP_CLERK"], loggedIn: true });
    await page.goto("/documents");
    await expect(page.getByRole("tab", { name: /รอตรวจ\s*1/ })).toBeVisible();
    await expect(page.locator("tr[data-doc=DOC-000101]")).toContainText("48,150.00");
    await expect(page.locator("tr[data-doc=DOC-000101]")).toContainText("28/10/2569");

    await page.getByTestId("file-input").setInputFiles([
      { name: "invoice-1.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7 one") },
      { name: "invoice-2.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7 two") },
    ]);
    const results = page.getByRole("region", { name: "ผลการอัปโหลด" });
    await expect(results).toContainText("อัปโหลดล่าสุด: รับ 1 จาก 2 ไฟล์");
    await expect(results).toContainText("DOC-000103");
    await expect(results).toContainText("ไฟล์ซ้ำกับเอกสาร DOC-000101");
    expect(calls.some((c) => c.method === "POST" && c.path === "/api/documents")).toBe(true);
    await expect(page.locator("tr[data-doc=DOC-000103]")).toBeVisible(); // ย้ายไปแท็บกำลังดำเนินการ

    await page.getByRole("tab", { name: /ล้มเหลว/ }).click();
    await page.locator("tr[data-doc=DOC-000102]").getByRole("button", { name: "อ่านใหม่" }).click();
    await expect(page.getByText("ส่ง DOC-000102 ไปอ่านใหม่แล้ว")).toBeVisible();
  });

  test("Finance Exec ดูคิวได้ แต่ไม่มีพื้นที่อัปโหลดและไม่มีปุ่มอ่านใหม่", async ({ page }) => {
    await mockBackend(page, { roles: ["FINANCE_EXEC"], loggedIn: true });
    await page.goto("/documents");
    await expect(page.getByRole("heading", { name: "คิวเอกสาร" })).toBeVisible();
    await expect(page.getByText("ลากไฟล์มาวาง")).toHaveCount(0);
    await page.getByRole("tab", { name: /ล้มเหลว/ }).click();
    await expect(page.getByRole("button", { name: "อ่านใหม่" })).toHaveCount(0);
  });
});

test.describe("7.5 จัดการผู้ใช้", () => {
  test("สร้าง, เปลี่ยน role, ปิด/เปิดใช้งาน, รีเซ็ตรหัสผ่าน", async ({ page }) => {
    const { calls } = await mockBackend(page, { roles: ["SYS_ADMIN"], loggedIn: true });
    await page.goto("/admin/users");
    await expect(page.locator("tr[data-user='clerk@test.local']")).toBeVisible();

    await page.getByRole("button", { name: "เพิ่มผู้ใช้" }).click();
    const dialog = page.getByRole("dialog", { name: "เพิ่มผู้ใช้" });
    await dialog.getByLabel("อีเมล").fill("new@test.local");
    await dialog.getByLabel("ชื่อที่แสดง").fill("ผู้ใช้ใหม่");
    await dialog.getByLabel(/หัวหน้าฝ่ายบัญชี/).check();
    await dialog.getByRole("button", { name: "สร้างผู้ใช้" }).click();
    await expect(page.getByTestId("temp-password")).toHaveText("Tmp-Password-1234");
    expect(calls.find((c) => c.method === "POST" && c.path === "/api/admin/users")?.body).toEqual({
      email: "new@test.local",
      displayName: "ผู้ใช้ใหม่",
      roles: ["AP_CLERK", "AP_LEAD"],
    });
    await page.getByRole("button", { name: "ปิด", exact: true }).click();

    const row = page.locator("tr[data-user='clerk@test.local']");
    await row.getByRole("button", { name: "เปลี่ยน role" }).click();
    const roles = page.getByRole("dialog", { name: /เปลี่ยน role/ });
    await roles.getByLabel(/เจ้าหน้าที่บัญชี/).uncheck();
    await expect(roles.getByText("ต้องเลือกอย่างน้อยหนึ่ง role")).toBeVisible();
    await expect(roles.getByRole("button", { name: "บันทึก" })).toBeDisabled();
    await roles.getByLabel(/ผู้บริหารฝ่ายการเงิน/).check();
    await roles.getByRole("button", { name: "บันทึก" }).click();
    await expect(row).toContainText("ผู้บริหารฝ่ายการเงิน");

    await row.getByRole("button", { name: "ปิดใช้งาน" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "ปิดใช้งาน" }).click();
    await expect(row).toContainText("ปิดใช้งาน");
    await row.getByRole("button", { name: "เปิดใช้งาน" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "เปิดใช้งาน" }).click();
    await expect(row).toContainText("ใช้งาน");

    await row.getByRole("button", { name: "รีเซ็ตรหัสผ่าน" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "รีเซ็ตรหัสผ่าน" }).click();
    await expect(page.getByTestId("temp-password")).toHaveText("Reset-Pass-5678");
  });

  test.describe("เมนูและหน้าจัดการผู้ใช้ไม่แสดงสำหรับ role อื่น", () => {
    for (const role of ["AP_CLERK", "AP_LEAD", "FINANCE_EXEC"] as const) {
      test(role, async ({ page }) => {
        await mockBackend(page, { roles: [role], loggedIn: true });
        await page.goto("/documents");
        await expect(page.getByRole("heading", { name: "คิวเอกสาร" })).toBeVisible();
        await expect(page.getByRole("navigation", { name: "เมนูหลัก" }).getByRole("link", { name: "ผู้ใช้" })).toHaveCount(0);
        await page.goto("/admin/users");
        await expect(page.getByRole("alert").filter({ hasText: "ไม่มีสิทธิ์เข้าหน้านี้" })).toBeVisible();
      });
    }
  });
});
