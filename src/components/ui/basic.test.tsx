import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Button } from "./Button";
import { TextField } from "./TextField";
import { Select } from "./Select";
import { ConfirmDialog } from "./ConfirmDialog";
import { ToastProvider, useToast } from "./Toast";

describe("Button", () => {
  it("กดแล้วเรียก onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>บันทึกร่าง</Button>);
    await userEvent.click(screen.getByRole("button", { name: "บันทึกร่าง" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("disabled กดไม่ได้", async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>ยืนยัน</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("loading กดไม่ได้และบอก aria-busy", () => {
    render(<Button loading>ยืนยัน</Button>);
    const b = screen.getByRole("button");
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute("aria-busy", "true");
  });

  it("แสดงคีย์ลัด", () => {
    render(<Button variant="primary" shortcut="Ctrl+Enter">ยืนยันและไปใบถัดไป</Button>);
    expect(screen.getByText("Ctrl+Enter").tagName).toBe("KBD");
  });
});

describe("TextField", () => {
  it("label ผูกกับช่องกรอก", () => {
    render(<TextField label="เลขที่ใบกำกับ" defaultValue="IV2569-00981" />);
    expect(screen.getByLabelText("เลขที่ใบกำกับ")).toHaveValue("IV2569-00981");
  });

  it("ความมั่นใจต่ำ → state low และแสดง %", () => {
    const { container } = render(<TextField label="เลขที่" confidence={0.81} />);
    expect(container.firstChild).toHaveAttribute("data-state", "low");
    expect(screen.getByText("81%")).toBeInTheDocument();
  });

  it("แก้แล้ว → state resolved", () => {
    const { container } = render(<TextField label="เลขที่" confidence={0.81} resolved />);
    expect(container.firstChild).toHaveAttribute("data-state", "resolved");
  });

  it("error แสดงข้อความและ aria-invalid", () => {
    render(<TextField label="ยอด" error="กรอกเป็นตัวเลข" />);
    expect(screen.getByLabelText("ยอด")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("กรอกเป็นตัวเลข")).toBeInTheDocument();
  });

  it("disabled", () => {
    render(<TextField label="ยอด" disabled />);
    expect(screen.getByLabelText("ยอด")).toBeDisabled();
  });
});

describe("Select", () => {
  it("เลือกค่าด้วยคีย์บอร์ดได้", async () => {
    function Harness() {
      const [v, setV] = useState("1");
      return (
        <>
          <Select
            label="อัตรา"
            value={v}
            onValueChange={setV}
            options={[
              { value: "1", label: "1% ค่าขนส่ง" },
              { value: "3", label: "3% ค่าบริการ" },
            ]}
          />
          <output>{v}</output>
        </>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole("combobox", { name: "อัตรา" });
    expect(trigger).toHaveTextContent("1% ค่าขนส่ง");
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.click(await screen.findByRole("option", { name: "3% ค่าบริการ" }));
    expect(screen.getByRole("status")).toHaveTextContent("3");
  });
});

describe("ConfirmDialog", () => {
  const base = {
    open: true,
    onOpenChange: () => {},
    title: "ปฏิเสธเอกสาร DOC-004218",
    summary: <p>บริษัท สยามซัพพลาย จำกัด (ตัวอย่าง) · ยอดจ่ายสุทธิ 48,022.90</p>,
    confirmLabel: "ยืนยันการปฏิเสธ",
  };

  it("การปฏิเสธที่ยังไม่มีเหตุผล กดยืนยันไม่ได้", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...base} tone="danger" requireReason onConfirm={onConfirm} />);
    const confirm = screen.getByRole("button", { name: "ยืนยันการปฏิเสธ" });
    expect(confirm).toBeDisabled();
    expect(screen.getByText("กรอกเหตุผลก่อนยืนยัน")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("เหตุผล"), "   ");
    expect(confirm).toBeDisabled();
  });

  it("กรอกเหตุผลแล้วยืนยันได้ และส่งเหตุผลออกไป", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...base} tone="danger" requireReason onConfirm={onConfirm} />);
    await userEvent.type(screen.getByLabelText("เหตุผล"), "ยอดไม่ตรงกับใบสั่งซื้อ");
    await userEvent.click(screen.getByRole("button", { name: "ยืนยันการปฏิเสธ" }));
    expect(onConfirm).toHaveBeenCalledWith("ยอดไม่ตรงกับใบสั่งซื้อ");
  });

  it("แสดงสรุปสิ่งที่จะเกิดขึ้น", () => {
    render(<ConfirmDialog {...base} onConfirm={() => {}} />);
    expect(screen.getByRole("dialog")).toHaveTextContent("ยอดจ่ายสุทธิ 48,022.90");
  });

  it("อนุมัติไม่ต้องมีเหตุผล", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...base} confirmLabel="อนุมัติ" onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: "อนุมัติ" }));
    expect(onConfirm).toHaveBeenCalledWith(undefined);
  });
});

describe("Toast", () => {
  it("แสดงข้อความเมื่อเรียก show", async () => {
    function Trigger() {
      const show = useToast();
      return <button onClick={() => show("ยืนยันแล้ว · เปิดใบถัดไป", "success")}>go</button>;
    }
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByText("go"));
    expect(await screen.findByText("ยืนยันแล้ว · เปิดใบถัดไป")).toBeInTheDocument();
  });

  it("ใช้นอก provider แล้ว error ชัดเจน", () => {
    function Bad() {
      useToast();
      return null;
    }
    expect(() => render(<Bad />)).toThrow("ToastProvider");
  });
});
