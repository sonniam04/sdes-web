// หน้าตรวจเอกสารและหน้าอนุมัติ (phase 2 กลุ่ม 5–6) — API จำลองด้วย page.route
import { expect, test, type Browser, type Page, type Route } from "@playwright/test";

type Role = "AP_CLERK" | "AP_LEAD" | "FINANCE_EXEC" | "SYS_ADMIN";
const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

/** PDF 2 หน้าที่สร้างระหว่างรัน: ยอดรวมอยู่หน้า 2 */
let PDF: Buffer;
async function makePdf(browser: Browser) {
  const p = await browser.newPage();
  await p.setContent(`<html><body style="font-family:sans-serif;margin:40px">
    <h1>ใบกำกับภาษี INV-2O26-001</h1><p>ค่าบริการ 2 x 5,000.00 = 10,000.00</p>
    <div style="page-break-after:always"></div>
    <p style="margin-top:600px;text-align:right">ยอดรวม 10,700.00</p></body></html>`);
  PDF = await p.pdf({ format: "A4" });
  await p.close();
}

const meta = {
  "header.invoiceNo": { confidence: 0.62, bbox: { page: 1, x: 0.05, y: 0.04, w: 0.4, h: 0.04 }, aiValue: "INV-2O26-001" },
  "header.grandTotal": { confidence: 0.97, bbox: { page: 2, x: 0.6, y: 0.62, w: 0.3, h: 0.03 }, aiValue: "10700.00" },
  "header.vatAmount": { confidence: 0.9, bbox: { page: 2, x: 0.6, y: 0.58, w: 0.3, h: 0.03 }, aiValue: "70.00" },
  "items[0].amount": { confidence: 0.98, bbox: { page: 1, x: 0.5, y: 0.1, w: 0.3, h: 0.03 }, aiValue: "10000.00" },
};
const baseData = () => ({
  invoiceNo: "INV-2O26-001",
  invoiceDate: "2026-10-15",
  vendorName: "บริษัท ผู้ขาย จำกัด",
  vendorTaxId: "0105536000011",
  vendorBranch: "00000",
  buyerTaxId: "0994000165617",
  buyerBranch: "00000",
  subtotal: "10000.00",
  discount: "0.00",
  vatBase: "10000.00",
  vatRate: "7",
  vatAmount: "70.00",
  vatExempt: false,
  grandTotal: "10700.00",
  whtBase: null,
  whtRate: null,
  whtAmount: null,
  netPayable: null,
  items: [{ no: 1, description: "ค่าบริการ", quantity: "2", unitPrice: "5000.00", amount: "10000.00" }],
});

type Doc = ReturnType<typeof detail>;
function detail(id: string, docNo: string, over: Partial<{ status: string; verifiedById: string | null; edits: unknown[]; riskFlags: unknown[] }> = {}) {
  return {
    id,
    docNo,
    status: "EXTRACTED",
    version: 1,
    fileName: `${docNo}.pdf`,
    mimeType: "application/pdf",
    confidence: "0.62",
    data: baseData(),
    fieldMeta: meta,
    validationIssues: [] as unknown[],
    riskFlags: [] as unknown[],
    verifiedById: null as string | null,
    edits: [] as unknown[],
    history: [{ id: "1", from: null, to: "UPLOADED", actor: { kind: "user", name: "ผู้อัปโหลด" }, reason: null, at: "2026-10-29T03:00:00Z" }],
    erpTransactionId: null,
    syncedAt: null,
    syncError: null,
    syncAttempts: [] as unknown[],
    ...over,
  };
}

async function mockBackend(page: Page, opts: { roles: Role[]; docs: Doc[]; userId?: string }) {
  const user = { id: opts.userId ?? "u-me", email: "me@test.local", displayName: "สมศรี ทดสอบ", roles: opts.roles, mustChangePassword: false };
  const calls: { method: string; path: string; body?: Record<string, unknown> }[] = [];
  const docs = new Map(opts.docs.map((d) => [d.id, d]));
  let settings = { confidenceThreshold: 0.85, highAmountThreshold: null as string | null, companyTaxId: "0994000165617", companyName: "บริษัททดสอบ" };
  await page.route(/\/(auth|api)\//, async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const body = req.postData() ? (JSON.parse(req.postData()!) as Record<string, unknown>) : undefined;
    calls.push({ method: req.method(), path, body });
    if (path === "/auth/refresh") return json(route, 200, { accessToken: "t", expiresIn: 900, user });
    if (path === "/api/documents" && req.method() === "GET") {
      const items = [...docs.values()].map((d, i) => ({
        id: d.id, docNo: d.docNo, status: d.status, fileName: d.fileName, vendorName: d.data.vendorName, invoiceNo: d.data.invoiceNo,
        invoiceDate: d.data.invoiceDate, grandTotal: d.data.grandTotal, issueCount: 2,
        createdAt: `2026-10-29T0${3 - i}:00:00Z`, updatedAt: "2026-10-29T03:00:00Z",
      }));
      return json(route, 200, { items, serverTime: new Date().toISOString() });
    }
    if (path === "/api/settings/risk") {
      if (req.method() === "PUT") settings = body as typeof settings;
      return json(route, 200, settings);
    }
    if (path === "/api/documents/approvals")
      return json(route, 200, {
        items: [...docs.values()].filter((d) => d.status === "PENDING_APPROVAL").map((d) => ({
          id: d.id, docNo: d.docNo, vendorName: d.data.vendorName, invoiceNo: d.data.invoiceNo, grandTotal: d.data.grandTotal, riskFlags: d.riskFlags, verifiedAt: "2026-10-29T03:00:00Z",
        })),
      });
    const m = /^\/api\/documents\/([^/]+)(?:\/(.+))?$/.exec(path);
    const d = m ? docs.get(m[1]!) : undefined;
    if (m && d) {
      const action = m[2];
      if (!action) return json(route, 200, d);
      if (action === "file/content") return route.fulfill({ status: 200, contentType: "application/pdf", body: PDF });
      if (action === "data") {
        if (body!.version !== d.version) return json(route, 409, { code: "STALE", message: "ข้อมูลถูกแก้ไปแล้ว", latest: { version: d.version, data: d.data, validationIssues: [] } });
        d.data = { ...d.data, ...(body!.changes as object) };
        d.version++;
        return json(route, 200, { id: d.id, version: d.version, data: d.data, validationIssues: [] });
      }
      if (action === "verify") {
        d.status = "VERIFIED";
        const next = [...docs.values()].find((x) => x.status === "EXTRACTED");
        return json(route, 200, { id: d.id, docNo: d.docNo, status: "VERIFIED", riskFlags: [], next: next ? { id: next.id, docNo: next.docNo } : null });
      }
      if (action === "approve" || action === "reject") {
        if (d.verifiedById === user.id) return json(route, 403, { code: "SELF_APPROVAL", message: "อนุมัติเอกสารที่คุณยืนยันหรือแก้ไขเองไม่ได้" });
        d.status = action === "approve" ? "APPROVED" : "REJECTED";
        return json(route, 200, { id: d.id, docNo: d.docNo, status: d.status });
      }
    }
    return json(route, 404, { message: "ไม่พบ" });
  });
  return { calls, docs };
}

test.beforeAll(async ({ browser }) => makePdf(browser));

test.describe("5.1 ตัวแสดงเอกสาร", () => {
  test("โฟกัสยอดรวมที่อยู่หน้า 2 → เลื่อนไปหน้า 2 พร้อมกรอบ", async ({ page }) => {
    await mockBackend(page, { roles: ["AP_CLERK"], docs: [detail("d1", "DOC-000101")] });
    await page.goto("/documents/d1");
    await expect(page.getByText("หน้า 1 / 2")).toBeVisible();
    await page.locator('[data-field="header.grandTotal"] input').focus();
    await expect(page.getByText("หน้า 2 / 2")).toBeVisible();
    await expect(page.getByTestId("bbox")).toBeVisible();
  });
});

test.describe("5.2 ฟอร์ม 4 หมวด", () => {
  test("1366×768 มีทุกหมวด และผลรวมรายการตรึงไว้ไม่ถูกแถบปุ่มบัง", async ({ page }) => {
    await mockBackend(page, { roles: ["AP_CLERK"], docs: [detail("d1", "DOC-000101")] });
    await page.goto("/documents/d1");
    for (const name of ["ข้อมูลเอกสาร", "ผู้ขาย / ผู้ซื้อ", "รายการ", "สรุปยอด"]) await expect(page.getByRole("region", { name })).toBeAttached();
    await expect(page.getByRole("group", { name: "เลขประจำตัวผู้เสียภาษีผู้ขาย" }).locator("input")).toHaveCount(13);
    const total = await page.getByTestId("lines-total").boundingBox();
    const bar = await page.getByRole("button", { name: /ยืนยันและไปใบถัดไป/ }).boundingBox();
    expect(total!.y + total!.height).toBeLessThanOrEqual(bar!.y);
    await expect(page.getByTestId("lines-total")).toContainText("ลงตัว");
  });
});

test.describe("5.3 ผลตรวจสดและรายการต้องตรวจ", () => {
  test("แก้ VAT แล้วรายการยอดรวมไม่ตรงหายไป", async ({ page }) => {
    await mockBackend(page, { roles: ["AP_CLERK"], docs: [detail("d1", "DOC-000101")] });
    await page.goto("/documents/d1");
    const bar = page.getByTestId("check-bar");
    await expect(bar).toContainText("ยอดรวมไม่ตรงกับยอดก่อนภาษีบวก VAT");
    const vat = page.locator('[data-field="header.vatAmount"] input');
    await vat.fill("700.00");
    await expect(bar).not.toContainText("ยอดรวมไม่ตรงกับยอดก่อนภาษีบวก VAT");
    await expect(bar).toContainText("พร้อมยืนยัน");
  });

  test("คลิกรายการไปที่ field และ J/K ย้ายตามลำดับ", async ({ page }) => {
    await mockBackend(page, { roles: ["AP_CLERK"], docs: [detail("d1", "DOC-000101")] });
    await page.goto("/documents/d1");
    await page.getByTestId("check-bar").getByRole("button", { name: /ยอดรวมไม่ตรง/ }).click();
    await expect(page.locator('[data-field="header.grandTotal"] input')).toBeFocused();
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Alt+j");
    const focusedField = () => page.evaluate(() => document.activeElement?.closest("[data-field]")?.getAttribute("data-field"));
    const first = await focusedField();
    await page.keyboard.press("Alt+j");
    const second = await focusedField();
    expect(first).not.toBe(second);
    await page.keyboard.press("Alt+k");
    expect(await focusedField()).toBe(first);
  });
});

test.describe("5.4 บันทึกอัตโนมัติ", () => {
  test("แท็บที่บันทึกทีหลังได้ข้อความและค่าล่าสุด", async ({ browser }) => {
    const ctx = await browser.newContext();
    const a = await ctx.newPage();
    const b = await ctx.newPage();
    const doc = detail("d1", "DOC-000101");
    const { calls } = await mockBackend(a, { roles: ["AP_CLERK"], docs: [doc] });
    // สองแท็บใช้ข้อมูลฝั่ง server ชุดเดียวกัน
    await mockBackendShared(b, doc);
    await a.goto("/documents/d1");
    await b.goto("/documents/d1");
    await a.locator('[data-field="header.vendorName"] input').fill("ชื่อจากแท็บแรก");
    await expect(a.getByTestId("save-state")).toHaveText("บันทึกแล้ว", { timeout: 5000 });
    expect(calls.some((c) => c.path === "/api/documents/d1/data")).toBe(true);
    await b.locator('[data-field="header.vendorName"] input').fill("ชื่อจากแท็บสอง");
    await expect(b.getByTestId("save-state")).toContainText("มีคนแก้เอกสารนี้ไปก่อน", { timeout: 5000 });
    await expect(b.locator('[data-field="header.vendorName"] input')).toHaveValue("ชื่อจากแท็บแรก");
    await ctx.close();
  });
});

/** แท็บที่สองใช้เอกสารชุดเดียวกับแท็บแรก (อ้างอิง object เดียวกัน) */
async function mockBackendShared(page: Page, doc: Doc) {
  await mockBackend(page, { roles: ["AP_CLERK"], docs: [] });
  await page.route(/\/api\/documents\/d1/, async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path.endsWith("/file/content")) return route.fulfill({ status: 200, contentType: "application/pdf", body: PDF });
    if (path.endsWith("/data")) {
      const body = JSON.parse(req.postData()!) as { version: number; changes: object };
      if (body.version !== doc.version) return json(route, 409, { code: "STALE", message: "ข้อมูลถูกแก้ไปแล้ว", latest: { version: doc.version, data: doc.data, validationIssues: [] } });
      doc.data = { ...doc.data, ...body.changes };
      doc.version++;
      return json(route, 200, { version: doc.version, data: doc.data, validationIssues: [] });
    }
    return json(route, 200, structuredClone(doc));
  });
}

test.describe("5.5 ยืนยัน", () => {
  test("ยืนยันขณะยังมี ERROR: ไม่เรียก API และพาไปที่ช่องที่ต้องแก้", async ({ page }) => {
    const { calls } = await mockBackend(page, { roles: ["AP_CLERK"], docs: [detail("d1", "DOC-000101")] });
    await page.goto("/documents/d1");
    await page.getByRole("button", { name: /ยืนยันและไปใบถัดไป/ }).click();
    await expect(page.locator('[data-field="header.grandTotal"] input')).toBeFocused();
    expect(calls.some((c) => c.path.endsWith("/verify"))).toBe(false);
  });

  test("ยืนยันแล้วเปิดใบถัดไปพร้อม toast ที่มีทางกลับ", async ({ page }) => {
    const { calls } = await mockBackend(page, { roles: ["AP_CLERK"], docs: [detail("d1", "DOC-000101"), detail("d2", "DOC-000102")] });
    await page.goto("/documents/d1");
    await expect(page.getByTestId("after-confirm")).toHaveText("หลังยืนยัน: เปิด DOC-000102 ต่อทันที");
    await page.locator('[data-field="header.vatAmount"] input').fill("700.00");
    await page.keyboard.press("Control+Enter");
    await expect(page).toHaveURL(/\/documents\/d2$/);
    await expect(page.getByText("ยืนยัน DOC-000101 แล้ว", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "กลับไปดู" })).toBeVisible();
    const patchBeforeVerify = calls.findIndex((c) => c.path.endsWith("/data")) < calls.findIndex((c) => c.path.endsWith("/verify"));
    expect(patchBeforeVerify).toBe(true);
  });
});

test.describe("5.6 จอแคบและเลขเอกสารความมั่นใจต่ำ", () => {
  test.use({ viewport: { width: 1100, height: 768 } });
  test("เริ่มที่แท็บข้อมูล กดรายการแล้วสลับไปแท็บเอกสารพร้อมกรอบ", async ({ page }) => {
    await mockBackend(page, { roles: ["AP_CLERK"], docs: [detail("d1", "DOC-000101")] });
    await page.goto("/documents/d1");
    await expect(page.getByRole("tab", { name: "ข้อมูล" })).toHaveAttribute("aria-selected", "true");
    await page.getByTestId("check-bar").getByRole("button", { name: /เลขที่เอกสาร/ }).click();
    await expect(page.getByRole("tab", { name: "เอกสาร" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("bbox")).toBeVisible();
  });

  test("เลขที่เอกสารความมั่นใจต่ำใช้ฟอนต์ที่แยก 0/O ชัด", async ({ page }) => {
    await mockBackend(page, { roles: ["AP_CLERK"], docs: [detail("d1", "DOC-000101")] });
    await page.goto("/documents/d1");
    const font = await page.locator('[data-field="header.invoiceNo"] input').evaluate((el) => getComputedStyle(el).fontFamily);
    expect(font).toMatch(/mono/i);
  });
});

test.describe("5.7 เชื่อมจากคิว", () => {
  test("คลิกตรวจจากคิวเปิดหน้าตรวจ และเห็นจำนวนปัญหา", async ({ page }) => {
    await mockBackend(page, { roles: ["AP_CLERK"], docs: [detail("d1", "DOC-000101")] });
    await page.goto("/documents");
    await page.getByRole("tab", { name: /รอตรวจ/ }).click();
    await expect(page.getByTestId("issue-count")).toHaveText("ต้องแก้ 2");
    await page.getByRole("link", { name: "ตรวจ" }).click();
    await expect(page).toHaveURL(/\/documents\/d1$/);
    await expect(page.getByTestId("check-bar")).toBeVisible();
  });
});

const pendingDoc = (over: Parameters<typeof detail>[2] = {}) =>
  detail("p1", "DOC-000201", {
    status: "PENDING_APPROVAL",
    verifiedById: "u-clerk",
    riskFlags: [{ code: "MONEY_EDITED", message: "มีการแก้ยอดเงินหลังการอ่าน", value: ["header.vatAmount"] }],
    edits: [{ field: "header.vatAmount", aiValue: "70.00", before: "70.00", after: "700.00", by: { id: "u-clerk", name: "สมชาย เสมียน" }, at: "2026-10-29T03:10:00Z" }],
    ...over,
  });

test.describe("6.1 คิวรออนุมัติ", () => {
  test("AP Lead เห็นเมนูและคิวพร้อมเหตุผล", async ({ page }) => {
    await mockBackend(page, { roles: ["AP_LEAD"], docs: [pendingDoc()] });
    await page.goto("/documents");
    await page.getByRole("link", { name: "รออนุมัติ" }).click();
    await expect(page).toHaveURL(/\/approvals$/);
    await expect(page.locator('[data-doc="DOC-000201"]')).toContainText("มีการแก้ยอดเงินหลังการอ่าน");
  });

  test("Clerk ไม่เห็นเมนูรออนุมัติ", async ({ page }) => {
    await mockBackend(page, { roles: ["AP_CLERK"], docs: [] });
    await page.goto("/documents");
    await expect(page.getByRole("heading", { name: "คิวเอกสาร" })).toBeVisible();
    await expect(page.getByRole("link", { name: "รออนุมัติ" })).toHaveCount(0);
  });
});

test.describe("6.2 โหมดอนุมัติ", () => {
  test("เห็นเหตุผล ประวัติการแก้ ฟอร์มอ่านอย่างเดียว แล้วอนุมัติผ่านกล่องยืนยัน", async ({ page }) => {
    const { docs } = await mockBackend(page, { roles: ["AP_LEAD"], docs: [pendingDoc()] });
    await page.goto("/documents/p1");
    await expect(page.getByTestId("risk-reasons")).toContainText("มีการแก้ยอดเงินหลังการอ่าน (ภาษีมูลค่าเพิ่ม)");
    await expect(page.getByTestId("edit-history")).toContainText("สมชาย เสมียน");
    await expect(page.getByTestId("edit-history")).toContainText("700.00");
    await expect(page.locator('[data-field="header.vendorName"] input')).toHaveAttribute("readonly", "");
    await page.getByRole("button", { name: "อนุมัติ", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "อนุมัติ" }).click();
    await expect(page).toHaveURL(/\/approvals$/);
    expect(docs.get("p1")!.status).toBe("APPROVED");
  });

  test("ปฏิเสธต้องกรอกเหตุผลก่อน", async ({ page }) => {
    const { calls } = await mockBackend(page, { roles: ["AP_LEAD"], docs: [pendingDoc()] });
    await page.goto("/documents/p1");
    await page.getByRole("button", { name: "ปฏิเสธ", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "ปฏิเสธ" })).toBeDisabled();
    await dialog.getByRole("textbox").fill("ผู้ขายไม่อยู่ในรายชื่อที่ทำสัญญา");
    await dialog.getByRole("button", { name: "ปฏิเสธ" }).click();
    await expect(page).toHaveURL(/\/approvals$/);
    expect(calls.find((c) => c.path.endsWith("/reject"))?.body).toMatchObject({ reason: "ผู้ขายไม่อยู่ในรายชื่อที่ทำสัญญา" });
  });

  test("ผู้ที่ยืนยันเองเห็นเหตุผลว่าอนุมัติไม่ได้ และปุ่มกดไม่ได้", async ({ page }) => {
    await mockBackend(page, { roles: ["AP_LEAD"], docs: [pendingDoc({ verifiedById: "u-me" })] });
    await page.goto("/documents/p1");
    await expect(page.getByTestId("self-approval")).toHaveText("อนุมัติเอกสารที่คุณยืนยันหรือแก้ไขเองไม่ได้ ต้องให้หัวหน้าคนอื่นอนุมัติ");
    await expect(page.getByRole("button", { name: "อนุมัติ", exact: true })).toBeDisabled();
  });
});

test.describe("6.3 ตั้งค่าความเสี่ยง", () => {
  test("บันทึกค่าถูกต้องได้ และ 150% ถูกปฏิเสธพร้อมข้อความ", async ({ page }) => {
    const { calls } = await mockBackend(page, { roles: ["SYS_ADMIN"], docs: [] });
    await page.goto("/admin/settings");
    const pct = page.getByLabel("เกณฑ์ความมั่นใจของ AI (%)");
    await expect(pct).toHaveValue("85");
    await pct.fill("150");
    await page.getByRole("button", { name: "บันทึก" }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText("เกณฑ์ความมั่นใจต้องอยู่ระหว่าง 0 ถึง 100%");
    expect(calls.some((c) => c.method === "PUT")).toBe(false);

    await pct.fill("90");
    await page.getByLabel("เกณฑ์ยอดสูง (บาท)").fill("500000");
    await page.getByRole("button", { name: "บันทึก" }).click();
    await expect(page.getByText("บันทึกการตั้งค่าแล้ว", { exact: true })).toBeVisible();
    expect(calls.find((c) => c.method === "PUT")?.body).toMatchObject({ confidenceThreshold: 0.9, highAmountThreshold: "500000" });
  });
});
