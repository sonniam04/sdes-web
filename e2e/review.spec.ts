import { expect, test, type Page } from "@playwright/test";
import sample from "../src/app/dev/review/sample-invoice.json";

const PAD = 0.004;

async function open(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto("/dev/review");
}

async function visibleRows(page: Page) {
  return page.getByTestId("datatable-scroll").evaluate((el) => {
    const row = el.querySelector("tbody tr")!.getBoundingClientRect().height;
    const head = el.querySelector("thead")!.getBoundingClientRect().height;
    return Math.floor((el.clientHeight - head) / row);
  });
}

/** ตำแหน่งกรอบเทียบกับหน้าเอกสาร เป็นสัดส่วน 0–1 */
async function bboxFraction(page: Page) {
  const pageBox = (await page.getByTestId("pdf-page").boundingBox())!;
  const b = (await page.getByTestId("bbox").boundingBox())!;
  return { x: (b.x - pageBox.x) / pageBox.width, y: (b.y - pageBox.y) / pageBox.height, w: b.width / pageBox.width, h: b.height / pageBox.height };
}

test.describe("4.1 DataTable", () => {
  test("1366×768 เห็นอย่างน้อย 8 แถว", async ({ page }) => {
    await open(page, 1366, 768);
    expect(await visibleRows(page)).toBeGreaterThanOrEqual(8);
  });

  test("1920×1080 เห็น 12 แถวขึ้นไป", async ({ page }) => {
    await open(page, 1920, 1080);
    expect(await visibleRows(page)).toBeGreaterThanOrEqual(12);
  });

  test("หัวตารางติดด้านบนเมื่อเลื่อน และเน้นช่องความมั่นใจต่ำ", async ({ page }) => {
    await open(page, 1366, 768);
    const scroll = page.getByTestId("datatable-scroll");
    await scroll.evaluate((el) => (el.scrollTop = 200));
    const head = await scroll.locator("thead th").first().boundingBox();
    const box = await scroll.boundingBox();
    expect(Math.abs(head!.y - box!.y)).toBeLessThan(2);
    await expect(scroll.locator("td[data-state=low]")).toHaveCount(1);
    await expect(scroll.locator("tr[data-flagged]")).toHaveCount(1);
  });
});

test.describe("4.2 BBoxOverlay บน PDF.js", () => {
  test("กรอบตรงตำแหน่งเดิมที่ซูม 100% และ 200%", async ({ page }) => {
    await open(page, 1366, 768);
    await expect(page.locator("canvas[role=img]")).toBeVisible();
    await page.getByLabel("รายการ 4 amount").focus();
    const expected = sample.boxes["item4.amount"];
    const want = { x: expected.x - PAD, y: expected.y - PAD, w: expected.w + PAD * 2, h: expected.h + PAD * 2 };

    await expect(page.getByTestId("bbox")).toBeVisible();
    const at100 = await bboxFraction(page);
    for (const k of ["x", "y", "w", "h"] as const) expect(at100[k]).toBeCloseTo(want[k], 2);
    await page.screenshot({ path: "test-results/review-bbox-100.png" });

    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "ขยาย" }).click();
    await expect(page.getByTestId("zoom-level")).toHaveText("200%");
    await page.waitForTimeout(400);
    const at200 = await bboxFraction(page);
    for (const k of ["x", "y", "w", "h"] as const) expect(at200[k]).toBeCloseTo(at100[k], 2);
    await page.getByTestId("bbox").screenshot({ path: "test-results/review-bbox-200.png" });
  });

  test("แก้ยอดรายการ 4 แล้วยอดลงตัวและช่องเปลี่ยนเป็นแก้แล้ว", async ({ page }) => {
    await open(page, 1366, 768);
    await page.getByLabel("รายการ 4 amount").fill("12710.00");
    await expect(page.getByText("ผลรวมรายการลงตัวกับมูลค่าสินค้า")).toBeVisible();
    await expect(page.getByTestId("datatable-scroll").locator("td[data-state=resolved]")).toHaveCount(1);
  });
});

test.describe("4.3 split-view ตามขนาดจอ", () => {
  for (const [w, h] of [[1366, 768], [1920, 1080]] as const) {
    test(`${w}×${h} สองฝั่ง 55/45`, async ({ page }) => {
      await open(page, w, h);
      const doc = (await page.getByTestId("pane-doc").boundingBox())!;
      const form = (await page.getByTestId("pane-form").boundingBox())!;
      await expect(page.getByRole("tablist", { name: "มุมมอง" })).toBeHidden();
      expect(doc.width / (doc.width + form.width)).toBeCloseTo(0.55, 1);
      expect(form.x).toBeGreaterThanOrEqual(doc.x + doc.width - 1);
      await page.screenshot({ path: `test-results/review-${w}.png` });
    });
  }

  test("1024 สลับแท็บ เอกสาร / ข้อมูล", async ({ page }) => {
    await open(page, 1024, 768);
    await expect(page.getByRole("tab", { name: "ข้อมูล" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("pane-form")).toBeVisible();
    await expect(page.getByTestId("pane-doc")).toBeHidden();
    await page.getByRole("tab", { name: "เอกสาร" }).click();
    await expect(page.getByTestId("pane-doc")).toBeVisible();
    await expect(page.getByTestId("pane-form")).toBeHidden();
  });

  test("390 ไม่มีการเลื่อนแนวนอนทั้งหน้า", async ({ page }) => {
    await open(page, 390, 844);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.getByRole("tab", { name: "ข้อมูล" })).toBeVisible();
  });
});
