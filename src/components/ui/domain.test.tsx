import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { DOCUMENT_STATUSES, STATUS_META } from "@/lib/status";
import { MENU, ROLES, menuFor, type Role } from "@/lib/roles";
import { StatusBadge } from "./StatusBadge";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { AmountField } from "./AmountField";
import { Dropzone, MAX_FILE_BYTES } from "./Dropzone";
import { EmptyState, ErrorState, Skeleton } from "./States";
import { AppShell } from "./AppShell";

describe("StatusBadge", () => {
  it("ทั้ง 11 สถานะมีข้อความไทยและไอคอนไม่ซ้ำกัน", () => {
    const labels = DOCUMENT_STATUSES.map((s) => STATUS_META[s].label);
    const icons = DOCUMENT_STATUSES.map((s) => STATUS_META[s].icon);
    expect(DOCUMENT_STATUSES).toHaveLength(11);
    expect(new Set(labels).size).toBe(11);
    expect(new Set(icons).size).toBe(11);
  });

  it("แสดงข้อความ ไอคอน และกลุ่มสี", () => {
    const { container } = render(<StatusBadge status="PENDING_APPROVAL" />);
    expect(screen.getByText("รออนุมัติ")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.firstChild).toHaveAttribute("data-group", "waiting");
  });
});

describe("ConfidenceBadge", () => {
  it.each([
    [0.99, "high", "99%"],
    [0.95, "high", "95%"],
    [0.949, "mid", "94%"],
    [0.85, "mid", "85%"],
    [0.849, "low", "84%"],
    [0.72, "low", "72%"],
  ])("%s → %s", (value, level, text) => {
    const { container } = render(<ConfidenceBadge value={value} />);
    expect(container.firstChild).toHaveAttribute("data-level", level);
    expect(container).toHaveTextContent(text);
  });
});

describe("AmountField", () => {
  function Harness({ initial = "", onSave = vi.fn() }: { initial?: string; onSave?: (v: string) => void }) {
    const [v, setV] = useState(initial);
    return (
      <AmountField
        label="จำนวนเงิน"
        value={v}
        onValueChange={(x) => {
          setV(x);
          onSave(x);
        }}
      />
    );
  }

  it("แสดงตัวคั่นหลักพันเมื่อไม่ได้ focus", () => {
    render(<Harness initial="12710" />);
    expect(screen.getByLabelText("จำนวนเงิน")).toHaveValue("12,710.00");
  });

  it("ทศนิยมเกิน 2 ตำแหน่ง → ข้อผิดพลาดและไม่บันทึก", async () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    await userEvent.type(screen.getByLabelText("จำนวนเงิน"), "1500.555");
    expect(screen.getByText("ทศนิยมได้ไม่เกิน 2 ตำแหน่ง")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalledWith("1500.555");
    expect(onSave).toHaveBeenLastCalledWith("1500.55");
  });

  it("วาง 12,345.60 ได้ค่า 12345.60", async () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    const input = screen.getByLabelText("จำนวนเงิน");
    await userEvent.click(input);
    await userEvent.paste("12,345.60");
    expect(onSave).toHaveBeenLastCalledWith("12345.60");
    await userEvent.tab();
    expect(input).toHaveValue("12,345.60");
  });

  it("ยอดติดลบแสดงเครื่องหมายลบ", () => {
    render(<Harness initial="-250" />);
    expect(screen.getByLabelText("จำนวนเงิน")).toHaveValue("−250.00");
  });
});

describe("Dropzone", () => {
  const pdf = (name: string, size = 1000) => {
    const f = new File(["x"], name, { type: "application/pdf" });
    Object.defineProperty(f, "size", { value: size });
    return f;
  };

  it("แยกไฟล์ที่ผ่านและไม่ผ่านการตรวจเบื้องต้นรายไฟล์", () => {
    const onFiles = vi.fn();
    render(<Dropzone onFiles={onFiles} />);
    const big = pdf("big.pdf", MAX_FILE_BYTES + 1);
    const exe = new File(["x"], "virus.exe", { type: "application/x-msdownload" });
    fireEvent.change(screen.getByTestId("file-input"), { target: { files: [pdf("a.pdf"), big, exe] } });
    const [ok, rejected] = onFiles.mock.calls[0];
    expect(ok.map((f: File) => f.name)).toEqual(["a.pdf"]);
    expect(rejected).toEqual([
      { name: "big.pdf", ok: false, message: "ไฟล์ใหญ่เกิน 20 MB" },
      { name: "virus.exe", ok: false, message: "ชนิดไฟล์ไม่รองรับ (รองรับ PDF, TIFF, JPG, PNG)" },
    ]);
  });

  it("ปุ่มเลือกไฟล์ใช้ได้ด้วยคีย์บอร์ด", async () => {
    render(<Dropzone onFiles={() => {}} />);
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click");
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "เลือกไฟล์" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(clickSpy).toHaveBeenCalled();
  });

  it("แสดงผลรายไฟล์ รวมไฟล์ซ้ำ", () => {
    render(
      <Dropzone
        onFiles={() => {}}
        results={[
          { name: "a.pdf", ok: true, message: "กำลังอ่านข้อมูล", docNo: "DOC-004218" },
          { name: "dup.pdf", ok: false, message: "ไฟล์ซ้ำกับเอกสาร DOC-004212" },
        ]}
      />,
    );
    expect(screen.getByText("อัปโหลดล่าสุด: รับ 1 จาก 2 ไฟล์")).toBeInTheDocument();
    expect(screen.getByText("ไฟล์ซ้ำกับเอกสาร DOC-004212")).toBeInTheDocument();
  });
});

describe("EmptyState / ErrorState / Skeleton", () => {
  it("EmptyState มีทางไปทำต่อ", () => {
    render(<EmptyState title="ยังไม่มีเอกสารรอตรวจ" action={<a href="#upload">อัปโหลดเอกสาร</a>} />);
    expect(screen.getByRole("link", { name: "อัปโหลดเอกสาร" })).toBeInTheDocument();
  });

  it("ErrorState มีปุ่มลองใหม่ที่ใช้คีย์บอร์ดได้", async () => {
    const onRetry = vi.fn();
    render(<ErrorState title="โหลดคิวไม่สำเร็จ" onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("โหลดคิวไม่สำเร็จ");
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("Skeleton บอกว่ากำลังโหลด", () => {
    render(<Skeleton lines={4} />);
    expect(screen.getByRole("status", { name: "กำลังโหลด…" })).toHaveAttribute("aria-busy", "true");
  });
});

describe("AppShell", () => {
  const expected: Record<Role, string[]> = {
    AP_CLERK: ["/documents", "/vendors"],
    AP_LEAD: ["/documents", "/approvals", "/vendors"],
    FINANCE_EXEC: ["/documents", "/reports", "/audit", "/admin/sync"],
    SYS_ADMIN: ["/audit", "/admin/sync", "/admin/logs", "/admin/users", "/admin/api-keys", "/admin/erp", "/admin/settings"],
  };

  it.each(ROLES)("เมนูของ %s ตรงกับ permission matrix", (role) => {
    expect(menuFor([role]).map((m) => m.href)).toEqual(expected[role]);
    render(<AppShell roles={[role]} userName="ผู้ทดสอบ" currentPath="/">x</AppShell>);
    const links = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(links).toEqual(expected[role]);
  });

  it("SYS_ADMIN ไม่เห็นเมนูงานบัญชี", () => {
    expect(menuFor(["SYS_ADMIN"]).some((m) => m.href === "/documents")).toBe(false);
  });

  it("หลาย role ได้เมนูรวม", () => {
    expect(menuFor(["AP_CLERK", "FINANCE_EXEC"]).map((m) => m.href)).toEqual([
      "/documents",
      "/vendors",
      "/reports",
      "/audit",
      "/admin/sync",
    ]);
  });

  it("ทุกเมนูมีอย่างน้อยหนึ่ง role", () => {
    expect(MENU.every((m) => m.roles.length > 0)).toBe(true);
  });

  it("เมนูปัจจุบันมี aria-current", () => {
    render(<AppShell roles={["AP_CLERK"]} userName="ผู้ทดสอบ" currentPath="/documents/123/review">x</AppShell>);
    expect(screen.getByRole("link", { name: "คิวเอกสาร" })).toHaveAttribute("aria-current", "page");
  });
});
