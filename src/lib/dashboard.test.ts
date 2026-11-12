import { describe, expect, it } from "vitest";
import { backlogLink } from "./dashboard";

describe("backlogLink (overview-dashboard design D5)", () => {
  it("กลุ่มเอกสารไปแท็บที่ตรงกันในคิว", () => {
    expect(backlogLink("waiting", ["AP_CLERK"])).toBe("/documents?tab=waiting");
    expect(backlogLink("reading", ["AP_CLERK"])).toBe("/documents?tab=progress");
    expect(backlogLink("failed", ["AP_CLERK"])).toBe("/documents?tab=failed");
    expect(backlogLink("syncFailed", ["AP_CLERK"])).toBe("/documents?tab=failed");
  });

  it("รออนุมัติ: Lead ไปหน้ารออนุมัติ คนอื่นไปแท็บรออนุมัติ", () => {
    expect(backlogLink("approval", ["AP_LEAD"])).toBe("/approvals");
    expect(backlogLink("approval", ["FINANCE_EXEC"])).toBe("/documents?tab=approval");
  });

  it("ส่งไม่สำเร็จ: ผู้ที่ดูเอกสารไม่ได้แต่ติดตามการส่งได้ไปหน้าติดตาม", () => {
    expect(backlogLink("syncFailed", ["SYS_ADMIN"])).toBe("/admin/sync");
  });
});
