"use client";

// หน้าทดลอง split-view (dev เท่านั้น) — ใช้ใบกำกับตัวอย่างจาก scripts/make-sample-invoice.mjs
import { useMemo, useState, type FocusEvent } from "react";
import { AppShell } from "@/components/ui/AppShell";
import { SplitView } from "@/components/ui/SplitView";
import { PdfViewer } from "@/components/ui/PdfViewer";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { CellInput } from "@/components/ui/CellInput";
import { TextField } from "@/components/ui/TextField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { formatMoney, parseAmountInput } from "@/lib/format";
import sample from "./sample-invoice.json";

type Item = { desc: string; qty: number; unit: string; price: string; amount: string };
type Boxes = Record<string, { x: number; y: number; w: number; h: number }>;
const boxes = sample.boxes as Boxes;

// AI อ่านจำนวนเงินรายการที่ 4 ผิด 0.30 บาท ด้วยความมั่นใจต่ำ
const aiItems: Item[] = sample.items.map((it, i) => (i === 3 ? { ...it, amount: "12710.30" } : it));
const lowFields = new Set(["item4.amount", "invoiceNo"]);

const cents = (s: string) => Math.round(Number(s.replace(/,/g, "")) * 100);

export default function ReviewDemo() {
  const [items, setItems] = useState(aiItems);
  const [edited, setEdited] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<string>();

  const sum = useMemo(() => items.reduce((a, it) => a + cents(it.amount), 0), [items]);
  const diff = sum - cents(sample.subtotal);

  const onFocus = (e: FocusEvent<HTMLElement>) => {
    const f = (e.target as HTMLElement).closest<HTMLElement>("[data-field]")?.dataset.field;
    setActive(f && boxes[f] ? f : undefined);
  };
  const mark = (f: string) => setEdited((s) => new Set(s).add(f));

  const state = (f: string) => (lowFields.has(f) ? (edited.has(f) ? "resolved" : "low") : "default");
  const [editing, setEditing] = useState<string>();
  const shown = (f: string, raw: string, isMoney: boolean) => {
    if (!isMoney || editing === f) return raw;
    const p = parseAmountInput(raw);
    return p.ok ? formatMoney(p.value) : raw;
  };

  const cell = (i: number, key: "desc" | "qty" | "price" | "amount", align: "left" | "right" = "left") => (
    <CellInput
      align={align}
      state={state(`item${i + 1}.${key}`)}
      data-field={`item${i + 1}.${key}`}
      aria-label={`รายการ ${i + 1} ${key}`}
      value={shown(`item${i + 1}.${key}`, String(items[i][key]), key === "price" || key === "amount")}
      onFocus={() => setEditing(`item${i + 1}.${key}`)}
      onBlur={() => setEditing(undefined)}
      onChange={(e) => {
        const v = e.target.value;
        setItems((xs) => xs.map((x, j) => (j === i ? { ...x, [key]: v } : x)));
        mark(`item${i + 1}.${key}`);
      }}
    />
  );

  const columns: Column<Item>[] = [
    { key: "n", header: "#", width: "28px", render: (_, i) => <span className="num text-text-muted">{i + 1}</span> },
    { key: "desc", header: "รายการ", render: (_, i) => cell(i, "desc") },
    { key: "qty", header: "จำนวน", width: "64px", align: "right", render: (_, i) => cell(i, "qty", "right") },
    { key: "price", header: "ราคา/หน่วย", width: "96px", align: "right", render: (_, i) => cell(i, "price", "right") },
    {
      key: "amount",
      header: "จำนวนเงิน",
      width: "108px",
      align: "right",
      render: (_, i) => cell(i, "amount", "right"),
      cellState: (_, i) => state(`item${i + 1}.amount`),
    },
  ];

  const form = (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4" onFocus={onFocus}>
        <div className={`border px-3 py-2 ${diff === 0 ? "border-status-success bg-status-success-bg text-status-success" : "border-risk bg-risk-bg text-risk"}`} role="status">
          {diff === 0 ? "ผลรวมรายการลงตัวกับมูลค่าสินค้า" : `ผลรวมรายการต่างจากมูลค่าสินค้า ${formatMoney((Math.abs(diff) / 100).toFixed(2))} บาท`}
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div data-field="vendorName">
            <TextField label="ชื่อผู้ขาย" confidence={0.98} defaultValue="บริษัท สยามซัพพลาย จำกัด" />
          </div>
          <div data-field="invoiceNo">
            <TextField label="เลขที่ใบกำกับ" confidence={0.81} resolved={edited.has("invoiceNo")} defaultValue="IV2569-0O981" onChange={() => mark("invoiceNo")} />
          </div>
          <div data-field="invoiceDate">
            <TextField label="วันที่" confidence={0.99} defaultValue="28/10/2569" />
          </div>
          <div data-field="buyerTaxId">
            <TextField label="เลขประจำตัวผู้เสียภาษีผู้ซื้อ" confidence={0.99} defaultValue="0105560098760" />
          </div>
        </div>
        <section className="border-[1.5px] border-rule-strong">
          <h2 className="flex items-stretch gap-2 border-b border-rule-strong bg-surface-sunken text-small font-bold">
            <span className="flex items-center bg-action px-2.5 text-action-text">3</span>
            <span className="py-1">รายการ</span>
            <span className="num ml-auto py-1 pr-2.5 font-normal text-text-muted">{items.length} รายการ</span>
          </h2>
          <DataTable caption="รายการสินค้า" columns={columns} rows={items} rowKey={(_, i) => String(i)} rowFlagged={(_, i) => state(`item${i + 1}.amount`) === "low"} />
          <div className={`num flex gap-3 border-t border-rule-strong px-2.5 py-1.5 text-small ${diff === 0 ? "bg-status-success-bg text-status-success" : "bg-risk-bg text-risk"}`}>
            <span className="text-left">
              ผลรวมรายการ {formatMoney((sum / 100).toFixed(2))} · มูลค่าสินค้า {formatMoney(sample.subtotal)}
            </span>
            <b className="ml-auto">{diff === 0 ? "ลงตัว" : `ต่าง ${formatMoney((Math.abs(diff) / 100).toFixed(2))}`}</b>
          </div>
        </section>
      </div>
      <div className="flex items-center gap-2 border-t-[1.5px] border-rule-strong bg-surface-sunken px-4 py-2">
        <span className="mr-auto text-label text-text-muted">ข้อมูลตัวอย่าง</span>
        <Button>บันทึกร่าง</Button>
        <Button variant="primary" shortcut="Ctrl+Enter">ยืนยันและไปใบถัดไป</Button>
      </div>
    </>
  );

  return (
    <AppShell roles={["AP_CLERK"]} userName="สมศรี ใจดี (ตัวอย่าง)" currentPath="/documents" fullHeight={false}>
      <div className="flex h-[calc(100vh-48px)] flex-col">
        <div className="flex h-10 items-center gap-2.5 border-b border-rule bg-surface px-4 text-small">
          <b className="num">DOC-004218</b> · บริษัท สยามซัพพลาย จำกัด (ตัวอย่าง) <StatusBadge status="EXTRACTED" />
        </div>
        <SplitView
          doc={<PdfViewer url="/samples/invoice-sample.pdf" activeBox={active ? boxes[active] : undefined} activeLabel={active} />}
          form={form}
        />
      </div>
    </AppShell>
  );
}
