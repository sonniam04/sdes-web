import { describe, expect, it } from "vitest";
import type { DocumentData, FieldMeta, ValidationIssue } from "@/lib/core";
import { buildCheckList, editedPaths, fieldLabel, nextCheck, refineBBox, toPixels, type PdfTextItem } from "./review";

const data = (over: Partial<DocumentData> = {}): DocumentData => ({
  invoiceNo: "INV-2O26-001",
  invoiceDate: "2026-10-15",
  vendorName: "บริษัท ตัวอย่าง จำกัด",
  vendorTaxId: "0105536000011",
  vendorBranch: "00000",
  buyerTaxId: "0994000165617",
  buyerBranch: "00000",
  subtotal: "10000.00",
  discount: "0.00",
  vatBase: "10000.00",
  vatRate: "7",
  vatAmount: "700.00",
  vatExempt: false,
  grandTotal: "10070.00",
  whtBase: null,
  whtRate: null,
  whtAmount: null,
  netPayable: null,
  items: [{ no: 1, description: "ค่าบริการ", quantity: "2", unitPrice: "5000.00", amount: "10000.00" }],
  ...over,
});
const box = { page: 1, x: 0.6, y: 0.8, w: 0.2, h: 0.03 };
const meta: FieldMeta = {
  "header.invoiceNo": { confidence: 0.62, bbox: { ...box, y: 0.1 }, aiValue: "INV-2O26-001" },
  "header.grandTotal": { confidence: 0.5, bbox: box, aiValue: "10070.00" },
  "header.vendorName": { confidence: 0.99, bbox: null, aiValue: "บริษัท ตัวอย่าง จำกัด" },
  "items[0].amount": { confidence: 0.7, bbox: { ...box, y: 0.5 }, aiValue: "10000.00" },
};
const issues: ValidationIssue[] = [
  { code: "BRANCH_MISSING", severity: "WARNING", message: "ไม่ระบุสาขาของผู้ขาย", fields: ["header.vendorBranch"] },
  { code: "GRAND_TOTAL", severity: "ERROR", message: "ยอดรวมไม่ตรงกับยอดก่อนภาษีบวก VAT", fields: ["header.grandTotal"] },
];

describe("buildCheckList", () => {
  it("ERROR ก่อน WARNING แล้วตามด้วย field ความมั่นใจต่ำตามลำดับบนฟอร์ม และไม่ซ้ำกับผลตรวจ", () => {
    const list = buildCheckList(data(), issues, meta, 0.85);
    expect(list.map((c) => [c.kind, c.path])).toEqual([
      ["ERROR", "header.grandTotal"],
      ["WARNING", "header.vendorBranch"],
      ["LOW_CONFIDENCE", "header.invoiceNo"],
      ["LOW_CONFIDENCE", "items[0].amount"],
    ]);
    expect(list[2]!.message).toBe("เลขที่เอกสาร: AI มั่นใจ 62%");
  });

  it("field ความมั่นใจต่ำที่แก้แล้วถูกขีดว่าเสร็จ", () => {
    const list = buildCheckList(data({ invoiceNo: "INV-2026-001" }), [], meta, 0.85);
    expect(list.find((c) => c.path === "header.invoiceNo")?.done).toBe(true);
    expect(list.find((c) => c.path === "items[0].amount")?.done).toBe(false);
  });

  it("แถวที่ถูกลบไม่อยู่ในรายการ", () => {
    expect(buildCheckList(data({ items: [] }), [], meta, 0.85).some((c) => c.path.startsWith("items"))).toBe(false);
  });
});

describe("nextCheck (คีย์ลัด J/K)", () => {
  const list = buildCheckList(data({ invoiceNo: "INV-2026-001" }), issues, meta, 0.85);
  it("ข้ามรายการที่เสร็จแล้วและวนรอบ", () => {
    expect(list.map((c) => c.done)).toEqual([false, false, true, false]);
    expect(nextCheck(list, 1, 1)).toBe(3);
    expect(nextCheck(list, 3, 1)).toBe(0);
    expect(nextCheck(list, 0, -1)).toBe(3);
    expect(nextCheck(list, -1, 1)).toBe(0);
  });
  it("ไม่มีรายการค้าง คืน -1", () => {
    expect(nextCheck([], 0, 1)).toBe(-1);
  });
});

describe("helpers", () => {
  it("fieldLabel", () => {
    expect(fieldLabel("header.grandTotal")).toBe("ยอดรวม");
    expect(fieldLabel("items[2].unitPrice")).toBe("รายการที่ 3 ราคาต่อหน่วย");
    expect(fieldLabel("items")).toBe("รายการสินค้า");
  });

  it("editedPaths เทียบกับค่าที่ AI อ่าน", () => {
    expect([...editedPaths(data({ grandTotal: "10700.00" }), meta)]).toEqual(["header.grandTotal"]);
  });

  it("toPixels ตามขนาดหน้าที่แสดง (ซูม 100% และ 200% ได้สัดส่วนเดิม)", () => {
    expect(toPixels(box, { w: 600, h: 848 })).toEqual({ left: 360, top: expect.closeTo(678.4, 5), width: 120, height: expect.closeTo(25.44, 5) });
    expect(toPixels(box, { w: 1200, h: 1696 }).left).toBe(720);
  });
});

describe("refineBBox (ชั้นข้อความ PDF)", () => {
  const page = { width: 600, height: 800 };
  // ข้อความ "10,070.00" สองที่: ใกล้กรอบ AI (ล่างขวา) และไกล (บนซ้าย)
  const items: PdfTextItem[] = [
    { str: "10,070.00", transform: [10, 0, 0, 10, 50, 700], width: 60, height: 10 },
    { str: "ยอดรวม 10,070.00", transform: [10, 0, 0, 10, 380, 150], width: 110, height: 12 },
  ];

  it("เลือกข้อความที่ตรงค่าและใกล้กรอบของ AI ที่สุด", () => {
    const r = refineBBox(items, "10070.00", { x: 0.6, y: 0.78, w: 0.2, h: 0.03 }, page)!;
    expect(r.x).toBeCloseTo(380 / 600);
    expect(r.y).toBeCloseTo((800 - 150 - 12) / 800);
  });

  it("ไม่พบข้อความหรือค่าว่าง คืนกรอบเดิม", () => {
    const near = { x: 0.1, y: 0.1, w: 0.1, h: 0.1 };
    expect(refineBBox(items, "99.00", near, page)).toBe(near);
    expect(refineBBox(items, null, near, page)).toBe(near);
  });

  it("ไกลเกินไปถือว่าเป็นค่าซ้ำที่อื่น ใช้กรอบของ AI", () => {
    const near = { x: 0.05, y: 0.95, w: 0.05, h: 0.02 };
    expect(refineBBox([items[1]!], "10070.00", near, page)).toBe(near);
  });
});
