"use client";

import { useId, useRef } from "react";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { confidenceLevel } from "@/lib/status";

/** กลุ่มหลักตามแบบฟอร์มกรมสรรพากร: X-XXXX-XXXXX-XX-X */
const GROUPS = [1, 4, 5, 2, 1];

type Props = {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  confidence?: number;
  resolved?: boolean;
  error?: string;
  readOnly?: boolean;
};

/** เลขประจำตัวผู้เสียภาษี 13 ช่อง: พิมพ์แล้วเลื่อนช่องเอง, วางทั้งเลขได้, Backspace ย้อนช่อง */
export function TaxIdCells({ label, value, onChange, confidence, resolved, error, readOnly }: Props) {
  const id = useId();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const raw = value ?? "";
  // ช่องว่างคือหลักที่ยังไม่กรอก (คงตำแหน่งไว้); ค่าที่มีอักขระอื่น (เช่น AI อ่านมีขีด) แสดงเฉพาะตัวเลข
  const positional = /^[\d ]*$/.test(raw) ? raw : raw.replace(/\D/g, "");
  const digits = positional.slice(0, 13).padEnd(13, " ").split("");
  const low = confidence !== undefined && confidenceLevel(confidence) === "low";
  const tone = error || (low && !resolved) ? "border-risk" : low && resolved ? "border-status-success" : "border-rule-strong";

  const set = (i: number, d: string) => {
    const next = [...digits];
    next[i] = d || " ";
    const joined = next.join("").trimEnd();
    onChange(joined.trim() === "" ? null : joined);
  };

  let index = 0;
  return (
    <div role="group" aria-labelledby={`${id}-label`} className="flex flex-col gap-1">
      <span id={`${id}-label`} className="flex items-center gap-2 text-label text-text-muted">
        {label}
        {confidence !== undefined && (
          <span className="ml-auto">
            <ConfidenceBadge value={confidence} />
          </span>
        )}
      </span>
      <div className="flex items-center gap-2.5">
        {GROUPS.map((size, g) => (
          <div key={g} className="flex">
            {Array.from({ length: size }, () => {
              const i = index++;
              return (
                <input
                  key={i}
                  ref={(el) => {
                    refs.current[i] = el;
                  }}
                  aria-label={`${label} หลักที่ ${i + 1}`}
                  inputMode="numeric"
                  maxLength={1}
                  readOnly={readOnly}
                  value={digits[i]!.trim()}
                  className={`-ml-px h-8 w-6 border text-center text-[15px] font-bold tabular-nums first:ml-0 focus:relative focus:z-10 focus:outline-2 focus:outline-focus ${tone}`}
                  onChange={(e) => {
                    const d = e.target.value.replace(/\D/g, "").slice(-1);
                    set(i, d);
                    if (d) refs.current[i + 1]?.focus();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !digits[i]!.trim()) refs.current[i - 1]?.focus();
                    if (e.key === "ArrowLeft") refs.current[i - 1]?.focus();
                    if (e.key === "ArrowRight") refs.current[i + 1]?.focus();
                  }}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
                    if (!pasted || readOnly) return;
                    e.preventDefault();
                    onChange(pasted.slice(0, 13));
                    refs.current[Math.min(pasted.length, 12)]?.focus();
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      {error && <span className="text-label text-risk">{error}</span>}
    </div>
  );
}
