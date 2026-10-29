import { forwardRef, type InputHTMLAttributes } from "react";
import type { CellState } from "./DataTable";

/**
 * ช่องแก้ไขในตาราง: ช่องที่ AI มั่นใจดูเป็นตัวพิมพ์บนกระดาษ (ไม่มีกรอบ)
 * กรอบปรากฏเมื่อ hover/focus ส่วนช่องความมั่นใจต่ำหรือแก้แล้วมีกรอบตลอด
 * เพื่อให้สายตาไปที่จุดที่ต้องตรวจก่อน
 */
export const CellInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { align?: "left" | "right"; state?: CellState }
>(function CellInput({ align = "left", state = "default", className = "", ...rest }, ref) {
  const tone = {
    default: "border-transparent hover:border-rule",
    low: "border-risk bg-surface",
    resolved: "border-status-success bg-surface",
  }[state];
  return (
    <input
      ref={ref}
      className={`w-full rounded-sm border bg-transparent px-1.5 py-0.5 outline-none focus:border-focus focus:bg-surface focus:outline-2 focus:outline-focus ${align === "right" ? "text-right tabular-nums" : ""} ${tone} ${className}`}
      {...rest}
    />
  );
});
