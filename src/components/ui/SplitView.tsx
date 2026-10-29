"use client";

import { useState, type ReactNode } from "react";

export type Pane = "doc" | "form";

/**
 * จอกว้าง ≥ 1280 px: เอกสาร 55% / ฟอร์ม 45% เลื่อนแยกกัน
 * จอแคบกว่า: สลับแท็บ "เอกสาร / ข้อมูล" (เริ่มที่ข้อมูล เพราะเป็นที่ทำงาน)
 */
export function SplitView({
  doc,
  form,
  pane: controlled,
  onPaneChange,
}: {
  doc: ReactNode;
  form: ReactNode;
  /** ควบคุมแท็บจากภายนอก (เช่น กดรายการ "ต้องตรวจ" แล้วสลับไปดูตำแหน่งในเอกสาร) */
  pane?: Pane;
  onPaneChange?: (pane: Pane) => void;
}) {
  const [own, setOwn] = useState<Pane>("form");
  const pane = controlled ?? own;
  const setPane = (p: Pane) => (onPaneChange ? onPaneChange(p) : setOwn(p));
  const tab = (p: Pane, label: string) => (
    <button
      role="tab"
      aria-selected={pane === p}
      aria-controls={`pane-${p}`}
      onClick={() => setPane(p)}
      className={`flex-1 py-2 ${pane === p ? "font-bold text-text shadow-[inset_0_-3px_0_var(--color-rule-strong)]" : "text-text-muted"}`}
    >
      {label}
    </button>
  );

  return (
    <div data-testid="split-view" className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" aria-label="มุมมอง" className="flex border-b-[1.5px] border-rule-strong bg-surface xl:hidden">
        {tab("doc", "เอกสาร")}
        {tab("form", "ข้อมูล")}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[55fr_45fr]">
        <section
          id="pane-doc"
          aria-label="เอกสารต้นฉบับ"
          data-testid="pane-doc"
          className={`min-h-0 border-rule-strong xl:block xl:border-r-[1.5px] ${pane === "doc" ? "block" : "hidden"}`}
        >
          {doc}
        </section>
        <section
          id="pane-form"
          aria-label="ข้อมูลที่อ่านได้"
          data-testid="pane-form"
          className={`min-h-0 flex-col bg-surface xl:flex ${pane === "form" ? "flex" : "hidden"}`}
        >
          {form}
        </section>
      </div>
    </div>
  );
}
