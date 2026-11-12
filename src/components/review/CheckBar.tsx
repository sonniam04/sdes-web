"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { CheckItem } from "@/lib/review";

/** แถบ "ต้องตรวจ": คลิกแต่ละรายการเพื่อไปที่ field — J/K ไปรายการถัดไป/ก่อนหน้า */
export function CheckBar({ items, current, onPick }: { items: CheckItem[]; current: number; onPick: (index: number) => void }) {
  const open = items.filter((c) => !c.done && c.kind !== "WARNING");
  const ready = !items.some((c) => c.kind === "ERROR");
  return (
    <div
      data-testid="check-bar"
      className={`border px-3 py-2 ${ready && !open.length ? "border-status-success bg-status-success-bg text-status-success" : "border-risk bg-risk-bg text-risk"}`}
    >
      <h2 className="flex items-center gap-1.5 text-small font-bold">
        {ready ? <CheckCircle2 aria-hidden className="size-4" /> : <AlertTriangle aria-hidden className="size-4" />}
        {ready ? (open.length ? `พร้อมยืนยัน · ควรตรวจอีก ${open.length} จุด` : "พร้อมยืนยัน") : `ต้องแก้ ${items.filter((c) => c.kind === "ERROR").length} จุดก่อนยืนยัน`}
        {items.length > 0 && <span className="ml-auto text-label font-normal">J / K ไปจุดถัดไป</span>}
      </h2>
      {items.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-small">
          {items.map((c, i) => (
            <li key={c.key} className={c.done ? "text-status-success line-through" : ""}>
              <button
                type="button"
                data-check={c.kind}
                aria-current={i === current ? "true" : undefined}
                onClick={() => onPick(i)}
                className={`text-left underline underline-offset-[3px] ${i === current ? "font-bold" : ""}`}
              >
                {c.kind === "WARNING" ? "ควรตรวจ: " : ""}
                {c.message}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
