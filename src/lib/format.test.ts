import { describe, expect, it } from "vitest";
import { formatDateTime, formatMoney, formatThaiDate, parseAmountInput } from "./format";

describe("formatMoney", () => {
  it("ใส่ตัวคั่นหลักพันและทศนิยม 2 ตำแหน่ง", () => {
    expect(formatMoney("1234.5")).toBe("1,234.50");
    expect(formatMoney("98765.25")).toBe("98,765.25");
    expect(formatMoney("0")).toBe("0.00");
    expect(formatMoney(186900)).toBe("186,900.00");
  });

  it("ยอดติดลบแสดงเครื่องหมายลบที่เห็นชัด", () => {
    expect(formatMoney("-1234.5")).toBe("−1,234.50");
    expect(formatMoney("-0.00")).toBe("0.00");
  });

  it("ไม่ปัดเศษเงียบ ๆ", () => {
    expect(() => formatMoney("1500.555")).toThrow();
  });
});

describe("parseAmountInput", () => {
  it("วางค่าที่มีตัวคั่นแล้วได้ค่ามาตรฐาน", () => {
    expect(parseAmountInput("12,345.60")).toEqual({ ok: true, value: "12345.60" });
  });

  it("ทศนิยมเกิน 2 ตำแหน่งเป็นข้อผิดพลาด", () => {
    expect(parseAmountInput("1500.555")).toEqual({ ok: false, error: "too-many-decimals" });
  });

  it("ปฏิเสธตัวอักษร", () => {
    expect(parseAmountInput("12a")).toEqual({ ok: false, error: "invalid" });
    expect(parseAmountInput("")).toEqual({ ok: false, error: "invalid" });
  });

  it("รับยอดติดลบ", () => {
    expect(parseAmountInput("-50")).toEqual({ ok: true, value: "-50" });
  });
});

describe("formatThaiDate", () => {
  it("แสดงเป็น วัน/เดือน/ปี พ.ศ.", () => {
    expect(formatThaiDate("2026-10-29")).toBe("29/10/2569");
  });

  it("timestamp ใช้เขตเวลา Asia/Bangkok", () => {
    // 2026-10-28T18:30Z = 29 ต.ค. 01:30 เวลาไทย
    expect(formatThaiDate("2026-10-28T18:30:00Z")).toBe("29/10/2569");
  });
});

describe("formatDateTime", () => {
  it("วันที่ พ.ศ. และเวลา 24 ชั่วโมงตามเวลาไทย", () => {
    expect(formatDateTime("2026-10-28T18:30:00Z")).toBe("29/10/2569 01:30");
    expect(formatDateTime("2026-10-29T07:05:00Z")).toBe("29/10/2569 14:05");
  });
});
