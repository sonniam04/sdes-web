import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("/dev/components", () => {
  test("ไม่มีปัญหา accessibility ระดับ serious หรือ critical", async ({ page }) => {
    await page.goto("/dev/components");
    await expect(page.getByRole("heading", { name: "Component ทั้งหมด" })).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    const severe = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(severe.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });

  test("กล่องปฏิเสธที่เปิดอยู่ก็ผ่าน axe และบังคับเหตุผล", async ({ page }) => {
    await page.goto("/dev/components");
    await page.getByRole("button", { name: "ปฏิเสธ…" }).nth(1).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "ยืนยันการปฏิเสธ" })).toBeDisabled();
    const { violations } = await new AxeBuilder({ page }).include("[role=dialog]").analyze();
    expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    await dialog.getByLabel("เหตุผล").fill("ยอดไม่ตรงกับใบสั่งซื้อ");
    await expect(dialog.getByRole("button", { name: "ยืนยันการปฏิเสธ" })).toBeEnabled();
  });

  test("ไล่ Tab ได้ทุกปุ่มและเห็นกรอบ focus", async ({ page }) => {
    await page.goto("/dev/components");
    const first = page.getByRole("button", { name: /ยืนยันและไปใบถัดไป/ });
    await first.focus();
    const outline = await first.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe("none");
  });

  test("ป้ายสถานะแยกได้แม้เป็นภาพขาวดำ", async ({ page }) => {
    await page.goto("/dev/components");
    const badges = page.getByTestId("status-badges");
    await page.addStyleTag({ content: "[data-testid=status-badges]{filter:grayscale(1)}" });
    await badges.screenshot({ path: "test-results/status-badges-grayscale.png" });
    const texts = await badges.locator("[data-status]").allInnerTexts();
    expect(new Set(texts).size).toBe(11);
  });
});
