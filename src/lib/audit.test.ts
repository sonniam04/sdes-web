import { describe, expect, it } from "vitest";
import { actionLabel, auditQuery, changeOf } from "./audit";

describe("actionLabel", () => {
  it("action ที่รู้จักแสดงเป็นภาษาไทย ที่ไม่รู้จักแสดงรหัสเดิม", () => {
    expect(actionLabel("document.field_edited")).toBe("แก้ข้อมูลเอกสาร");
    expect(actionLabel("erp.secret_changed")).toBe("เปลี่ยน secret ของการเชื่อมต่อ ERP");
    expect(actionLabel("something.new")).toBe("something.new");
  });
});

describe("auditQuery", () => {
  it("ช่วงวันที่เป็นวันเต็มตามเวลาไทย และตัดช่องว่างทิ้ง", () => {
    const q = auditQuery({ from: "2026-10-01", to: "2026-10-31", actorUserId: "", action: "document.field_edited", docNo: " doc-000120 " });
    expect(Object.fromEntries(q)).toEqual({
      from: "2026-10-01T00:00:00+07:00",
      to: "2026-10-31T23:59:59.999+07:00",
      action: "document.field_edited",
      docNo: "DOC-000120",
    });
  });

  it("ใส่ cursor ของหน้าเมื่อมี", () => {
    expect(auditQuery({}, "123").get("before")).toBe("123");
    expect(auditQuery({}).toString()).toBe("");
  });
});

describe("changeOf", () => {
  it("รายละเอียดที่มี field/before/after แสดงค่าก่อน/หลัง", () => {
    expect(changeOf({ field: "header.vendorName", before: "บริษัท ก", after: "บริษัท ข" })).toEqual({ field: "header.vendorName", before: "บริษัท ก", after: "บริษัท ข" });
  });

  it("การเปลี่ยนสถานะแสดงชื่อสถานะภาษาไทย", () => {
    expect(changeOf({ field: "status", before: "VERIFIED", after: "SYNCING", reason: "ส่งใหม่" })).toEqual({ field: "status", before: "ตรวจแล้ว", after: "กำลังส่ง ERP" });
  });

  it("ค่าว่างแสดงเป็นขีด ค่าที่ไม่ใช่ข้อความแปลงเป็น JSON และรายละเอียดอื่นไม่มีค่าก่อน/หลัง", () => {
    expect(changeOf({ field: "autoSync", before: false, after: true })).toEqual({ field: "autoSync", before: "false", after: "true" });
    expect(changeOf({ field: "x", before: null, after: { a: 1 } })).toEqual({ field: "x", before: "—", after: '{"a":1}' });
    expect(changeOf({ ok: true })).toBeNull();
    expect(changeOf(null)).toBeNull();
  });
});
