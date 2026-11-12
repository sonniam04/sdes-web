import { describe, expect, it } from "vitest";
import type { ValidationIssue } from "@/lib/core";
import { mergeIssues } from "./useReview";

const i = (code: string, field = "header.x"): ValidationIssue => ({ code, severity: "ERROR", message: code, fields: [field] });

describe("mergeIssues", () => {
  it("กฎคำนวณได้ในเครื่องใช้ผลสด กฎที่ต้องใช้ข้อมูล server ใช้ผลจาก server", () => {
    const live = [i("GRAND_TOTAL"), i("COMPANY_TAX_ID_NOT_SET", "header.buyerTaxId"), i("TAX_ID_INVALID", "header.vendorTaxId")];
    const server = [i("VAT_AMOUNT"), i("BUYER_MISMATCH", "header.buyerTaxId"), i("DUPLICATE_INVOICE", "header.invoiceNo")];
    expect(mergeIssues(live, server).map((x) => x.code)).toEqual(["GRAND_TOTAL", "TAX_ID_INVALID", "BUYER_MISMATCH", "DUPLICATE_INVOICE"]);
  });

  it("Tax ID ผู้ซื้อผิดใช้ผลจาก server (ผูกกับการตั้งค่าบริษัท)", () => {
    const server = [i("TAX_ID_INVALID", "header.buyerTaxId")];
    expect(mergeIssues([i("TAX_ID_INVALID", "header.buyerTaxId")], server)).toEqual(server);
  });
});
