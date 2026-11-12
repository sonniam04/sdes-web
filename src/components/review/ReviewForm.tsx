"use client";

import type { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AmountField } from "@/components/ui/AmountField";
import { Button } from "@/components/ui/Button";
import { CellInput } from "@/components/ui/CellInput";
import { DataTable, type CellState, type Column } from "@/components/ui/DataTable";
import { TextField } from "@/components/ui/TextField";
import { moneyEquals, type DocumentData, type DocumentItem, type FieldMeta, type ValidationIssue } from "@/lib/core";
import { formatMoney } from "@/lib/format";
import { confidenceLevel } from "@/lib/status";
import Decimal from "decimal.js";
import { TaxIdCells } from "./TaxIdCells";

type Props = {
  data: DocumentData;
  meta: FieldMeta;
  issues: ValidationIssue[];
  edited: Set<string>;
  readOnly: boolean;
  onChange: (changes: Partial<DocumentData>) => void;
};

type HeaderKey = Exclude<keyof DocumentData, "items">;

/** ฟอร์ม 4 หมวดตาม wireframe: ข้อมูลเอกสาร, ผู้ขาย/ผู้ซื้อ, รายการ, สรุปยอด (ชั้นที่ 1 และ 2) */
export function ReviewForm({ data, meta, issues, edited, readOnly, onChange }: Props) {
  const errorOf = (path: string) => issues.find((i) => i.severity === "ERROR" && i.fields.includes(path))?.message;
  const conf = (path: string) => {
    const m = meta[path];
    return m && m.aiValue !== null ? m.confidence : undefined;
  };
  const low = (path: string) => {
    const c = conf(path);
    return c !== undefined && confidenceLevel(c) === "low";
  };

  const text = (key: HeaderKey, label: string, opts: { type?: string; mono?: boolean } = {}) => {
    const path = `header.${key}`;
    return (
      <div data-field={path}>
        <TextField
          label={label}
          type={opts.type}
          readOnly={readOnly}
          confidence={conf(path)}
          resolved={edited.has(path)}
          error={errorOf(path)}
          // เลขเอกสารที่ AI ไม่มั่นใจ: ฟอนต์ที่แยก 0/O และ 1/l ชัด (รายการส่งต่อข้อ 6)
          className={opts.mono && low(path) ? "[&_input]:font-mono [&_input]:tracking-wide" : ""}
          value={(data[key] as string | null) ?? ""}
          onChange={(e) => onChange({ [key]: e.target.value === "" ? null : e.target.value })}
        />
      </div>
    );
  };

  const amount = (key: HeaderKey, label: string, emphasis?: "double") => {
    const path = `header.${key}`;
    return (
      <div
        data-field={path}
        className={`grid grid-cols-[1fr_minmax(9rem,11rem)] items-end gap-3 ${emphasis === "double" ? "border-b-[3px] border-double border-rule-strong pb-1 font-bold" : ""}`}
      >
        {/* เส้นประนำสายตาจาก label ถึงช่องตัวเลข */}
        <span className="mb-2 border-b border-dotted border-rule text-small">{label}</span>
        <AmountField
          label={label}
          className="[&_label]:sr-only"
          readOnly={readOnly}
          confidence={conf(path)}
          resolved={edited.has(path)}
          value={(data[key] as string | null) ?? ""}
          onValueChange={(v) => onChange({ [key]: v === "" ? null : v })}
        />
      </div>
    );
  };

  const items = data.items;
  const setItem = (i: number, change: Partial<DocumentItem>) =>
    onChange({ items: items.map((it, j) => (j === i ? { ...it, ...change } : it)) });
  const cellState = (path: string): CellState =>
    issues.some((x) => x.severity === "ERROR" && x.fields.includes(path)) || (low(path) && !edited.has(path))
      ? "low"
      : low(path) && edited.has(path)
        ? "resolved"
        : "default";
  const cell = (i: number, key: "description" | "quantity" | "unitPrice" | "amount", align: "left" | "right" = "left") => {
    const path = `items[${i}].${key}`;
    return (
      <div data-field={path}>
        <CellInput
          align={align}
          readOnly={readOnly}
          state={cellState(path)}
          aria-label={`รายการที่ ${i + 1} ${{ description: "รายการ", quantity: "จำนวน", unitPrice: "ราคาต่อหน่วย", amount: "จำนวนเงิน" }[key]}`}
          value={items[i]![key] ?? ""}
          onChange={(e) => setItem(i, { [key]: e.target.value === "" ? null : e.target.value.replace(/,/g, "") })}
        />
      </div>
    );
  };
  const columns: Column<DocumentItem>[] = [
    { key: "n", header: "#", width: "28px", render: (_, i) => <span className="num text-text-muted">{i + 1}</span> },
    { key: "description", header: "รายการ", render: (_, i) => cell(i, "description") },
    { key: "quantity", header: "จำนวน", width: "64px", align: "right", render: (_, i) => cell(i, "quantity", "right") },
    { key: "unitPrice", header: "ราคา/หน่วย", width: "100px", align: "right", render: (_, i) => cell(i, "unitPrice", "right") },
    {
      key: "amount",
      header: "จำนวนเงิน",
      width: "108px",
      align: "right",
      render: (_, i) => cell(i, "amount", "right"),
      cellState: (_, i) => cellState(`items[${i}].amount`),
    },
    ...(readOnly
      ? []
      : [
          {
            key: "del",
            header: "",
            width: "32px",
            render: (_: DocumentItem, i: number) => (
              <button
                type="button"
                aria-label={`ลบรายการที่ ${i + 1}`}
                className="text-text-muted hover:text-risk"
                onClick={() => onChange({ items: items.filter((_, j) => j !== i).map((it, j) => ({ ...it, no: j + 1 })) })}
              >
                <Trash2 aria-hidden className="size-4" />
              </button>
            ),
          },
        ]),
  ];

  // ผลรวมรายการเทียบยอดก่อนภาษี — แสดงตลอด (ตรึงไว้ล่างฟอร์ม)
  const sum = items.reduce((a, it) => (it.amount && /^-?\d+(\.\d+)?$/.test(it.amount) ? a.plus(it.amount) : a), new Decimal(0));
  const subtotal = data.subtotal && /^-?\d+(\.\d+)?$/.test(data.subtotal) ? new Decimal(data.subtotal) : null;
  const balanced = subtotal !== null && moneyEquals(sum, subtotal);

  return (
    <>
      <Section no={1} title="ข้อมูลเอกสาร">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {text("invoiceNo", "เลขที่เอกสาร", { mono: true })}
          {text("invoiceDate", "วันที่เอกสาร", { type: "date" })}
        </div>
      </Section>

      <Section no={2} title="ผู้ขาย / ผู้ซื้อ">
        {text("vendorName", "ชื่อผู้ขาย")}
        <div className="flex flex-wrap items-end gap-4">
          <div data-field="header.vendorTaxId">
            <TaxIdCells
              label="เลขประจำตัวผู้เสียภาษีผู้ขาย"
              value={data.vendorTaxId}
              readOnly={readOnly}
              confidence={conf("header.vendorTaxId")}
              resolved={edited.has("header.vendorTaxId")}
              error={errorOf("header.vendorTaxId")}
              onChange={(v) => onChange({ vendorTaxId: v })}
            />
          </div>
          <div className="w-28">{text("vendorBranch", "สาขา")}</div>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div data-field="header.buyerTaxId">
            <TaxIdCells
              label="เลขประจำตัวผู้เสียภาษีผู้ซื้อ"
              value={data.buyerTaxId}
              readOnly={readOnly}
              confidence={conf("header.buyerTaxId")}
              resolved={edited.has("header.buyerTaxId")}
              error={errorOf("header.buyerTaxId")}
              onChange={(v) => onChange({ buyerTaxId: v })}
            />
          </div>
          <div className="w-28">{text("buyerBranch", "สาขา")}</div>
        </div>
      </Section>

      <Section no={3} title="รายการ" note={`${items.length} รายการ`}>
        <DataTable
          caption="รายการสินค้า"
          columns={columns}
          rows={items}
          rowKey={(_, i) => String(i)}
          rowFlagged={(_, i) => cellState(`items[${i}].amount`) === "low"}
        />
        {!readOnly && (
          <Button
            className="mt-2 self-start"
            onClick={() =>
              onChange({ items: [...items, { no: items.length + 1, description: null, quantity: null, unitPrice: null, amount: null }] })
            }
          >
            <Plus aria-hidden className="size-4" /> เพิ่มรายการ
          </Button>
        )}
      </Section>

      <Section no={4} title="สรุปยอด">
        <p className="text-label font-semibold text-text-muted">ชั้นที่ 1 — ยอดรวม</p>
        {amount("subtotal", "ยอดก่อนภาษี")}
        {amount("discount", "ส่วนลด")}
        {amount("vatBase", "ฐานภาษี")}
        <div className="grid grid-cols-2 items-end gap-3">
          {text("vatRate", "อัตรา VAT (%)")}
          <label className="mb-2 inline-flex items-center gap-2 text-small" data-field="header.vatExempt">
            <input type="checkbox" disabled={readOnly} checked={data.vatExempt} onChange={(e) => onChange({ vatExempt: e.target.checked })} />
            ยกเว้น VAT
          </label>
        </div>
        {amount("vatAmount", "ภาษีมูลค่าเพิ่ม")}
        {amount("grandTotal", "ยอดรวม")}
        <p className="mt-2 text-label font-semibold text-text-muted">ชั้นที่ 2 — หัก ณ ที่จ่าย</p>
        {amount("whtBase", "ฐานหัก ณ ที่จ่าย")}
        <div className="grid grid-cols-2 gap-3">{text("whtRate", "อัตราหัก ณ ที่จ่าย (%)")}</div>
        {amount("whtAmount", "ภาษีหัก ณ ที่จ่าย")}
        {amount("netPayable", "ยอดจ่ายสุทธิ", "double")}
      </Section>

      <div
        data-testid="lines-total"
        role="status"
        className={`num sticky bottom-0 z-10 flex gap-3 border-[1.5px] px-2.5 py-1.5 text-small ${balanced ? "border-status-success bg-status-success-bg text-status-success" : "border-risk bg-risk-bg text-risk"}`}
      >
        <span>
          ผลรวมรายการ {formatMoney(sum.toFixed(2))} · ยอดก่อนภาษี {subtotal ? formatMoney(subtotal.toFixed(2)) : "—"}
        </span>
        <b className="ml-auto">{balanced ? "ลงตัว" : subtotal ? `ต่าง ${formatMoney(sum.minus(subtotal).abs().toFixed(2))}` : "ยังไม่มียอดก่อนภาษี"}</b>
      </div>
    </>
  );
}

function Section({ no, title, note, children }: { no: number; title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col border-[1.5px] border-rule-strong" aria-label={title}>
      <h2 className="flex items-stretch gap-2 border-b border-rule-strong bg-surface-sunken text-small font-bold">
        <span className="flex items-center bg-action px-2.5 text-action-text">{no}</span>
        <span className="py-1">{title}</span>
        {note && <span className="num ml-auto py-1 pr-2.5 font-normal text-text-muted">{note}</span>}
      </h2>
      <div className="flex flex-col gap-2.5 p-2.5">{children}</div>
    </section>
  );
}
