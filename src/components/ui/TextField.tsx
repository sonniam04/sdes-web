import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { confidenceLevel } from "@/lib/status";
import { ConfidenceBadge } from "./ConfidenceBadge";

export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  error?: string;
  /** ความมั่นใจของ AI 0–1 ถ้ามี จะแสดง % ชิดขวาของ label และเน้นเมื่อต่ำ */
  confidence?: number;
  /** ผู้ใช้แก้/ยืนยัน field ที่ความมั่นใจต่ำแล้ว */
  resolved?: boolean;
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, confidence, resolved = false, className = "", id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  const low = confidence !== undefined && confidenceLevel(confidence) === "low";
  const state = error ? "error" : low ? (resolved ? "resolved" : "low") : "default";
  const ring = {
    default: "border-rule focus:border-focus",
    error: "border-risk shadow-[inset_0_-2px_0_var(--color-risk)]",
    low: "border-risk shadow-[inset_0_-2px_0_var(--color-risk)]",
    resolved: "border-status-success shadow-[inset_0_-2px_0_var(--color-status-success)]",
  }[state];

  return (
    <div className={`flex flex-col gap-0.5 ${className}`} data-state={state}>
      <label htmlFor={inputId} className="flex gap-1.5 text-label text-text-muted">
        {label}
        {confidence !== undefined && (
          <span className="ml-auto">
            <ConfidenceBadge value={confidence} />
          </span>
        )}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? hintId : undefined}
        className={`w-full rounded-sm border bg-surface px-2 py-[3px] text-text outline-none focus:outline-2 focus:outline-focus disabled:bg-surface-sunken disabled:text-text-muted ${ring}`}
        {...rest}
      />
      {(error || hint) && (
        <span id={hintId} className={`text-label ${error ? "text-risk" : "text-text-muted"}`}>
          {error ?? hint}
        </span>
      )}
    </div>
  );
});
