import { describe, expect, it } from "vitest";
import { applyStatusEvent, mergeRows, type DocumentRow } from "./documents";

const row = (id: string, status: DocumentRow["status"], updatedAt: string, createdAt = "2026-10-29T01:00:00Z"): DocumentRow => ({
  id,
  docNo: `DOC-${id}`,
  status,
  fileName: `${id}.pdf`,
  vendorName: null,
  invoiceNo: null,
  invoiceDate: null,
  grandTotal: null,
  createdAt,
  updatedAt,
});

describe("mergeRows", () => {
  it("แทนที่แถวเดิมด้วยข้อมูลจาก server และเรียงใหม่ → เก่า", () => {
    const out = mergeRows([row("a", "UPLOADED", "t1", "2026-10-29T01:00:00Z")], [row("b", "UPLOADED", "t1", "2026-10-29T02:00:00Z"), row("a", "EXTRACTED", "t2")]);
    expect(out.map((r) => [r.id, r.status])).toEqual([
      ["b", "UPLOADED"],
      ["a", "EXTRACTED"],
    ]);
  });

  it("ผลโหลดจาก server ที่มาช้ากว่า (updatedAt เก่ากว่า) ไม่เขียนทับสถานะที่ใหม่กว่า", () => {
    const prev = [row("a", "EXTRACTED", "2026-10-29T01:00:02.000Z")];
    const out = mergeRows(prev, [row("a", "PROCESSING", "2026-10-29T01:00:01.000Z")]);
    expect(out[0]!.status).toBe("EXTRACTED");
  });

  it("ผลโหลดที่สถานะเท่ากันแต่ updatedAt เก่ากว่าเวลา event: รับรายละเอียดและคงเวลาที่ใหม่กว่า", () => {
    const prev = [row("a", "EXTRACTED", "2026-10-29T01:00:02.050Z")];
    const fresh = { ...row("a", "EXTRACTED", "2026-10-29T01:00:02.000Z"), vendorName: "บริษัท ก", issueCount: 1 };
    const out = mergeRows(prev, [fresh]);
    expect(out[0]).toMatchObject({ vendorName: "บริษัท ก", issueCount: 1, updatedAt: "2026-10-29T01:00:02.050Z" });
  });

  it("insertOnly: ผลอัปโหลดที่มาช้ากว่า event real-time ไม่ย้อนสถานะกลับ", () => {
    const prev = [row("a", "EXTRACTED", "2026-10-29T01:00:01Z")];
    const out = mergeRows(prev, [row("a", "UPLOADED", "2026-10-29T01:00:02Z"), row("b", "UPLOADED", "x")], { insertOnly: true });
    expect(out.find((r) => r.id === "a")!.status).toBe("EXTRACTED");
    expect(out.find((r) => r.id === "b")!.status).toBe("UPLOADED");
  });

  it("ifUpdatedAt: สั่งอ่านใหม่แล้ว event มาก่อน response — ไม่เขียนทับด้วย PROCESSING", () => {
    const prev = [row("a", "EXTRACTED", "server-t3")];
    const out = mergeRows(prev, [row("a", "PROCESSING", "local")], { ifUpdatedAt: "server-t1" });
    expect(out[0]!.status).toBe("EXTRACTED");
  });

  it("ifUpdatedAt: แถวยังไม่เปลี่ยน → แสดงสถานะใหม่ทันที", () => {
    const out = mergeRows([row("a", "FAILED", "server-t1")], [row("a", "PROCESSING", "server-t1")], { ifUpdatedAt: "server-t1" });
    expect(out[0]!.status).toBe("PROCESSING");
  });

  it("applyStatusEvent: ใช้ event ที่ใหม่กว่า และไม่ย้อนด้วย event ที่เก่ากว่า", () => {
    const prev = [row("a", "PROCESSING", "2026-10-29T01:00:01.000Z")];
    const next = applyStatusEvent(prev, { id: "a", docNo: "DOC-a", status: "EXTRACTED", at: "2026-10-29T01:00:02.000Z" });
    expect(next![0]!.status).toBe("EXTRACTED");
    const stale = applyStatusEvent(next!, { id: "a", docNo: "DOC-a", status: "PROCESSING", at: "2026-10-29T01:00:01.500Z" });
    expect(stale![0]!.status).toBe("EXTRACTED");
  });

  it("applyStatusEvent: เอกสารที่ยังไม่อยู่ในคิว → คืน null ให้ไปโหลดจาก server", () => {
    expect(applyStatusEvent([], { id: "x", docNo: "DOC-x", status: "EXTRACTED", at: "t" })).toBeNull();
  });
});
