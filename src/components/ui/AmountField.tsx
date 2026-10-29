"use client";

import { useState, type ComponentProps } from "react";
import { formatMoney, parseAmountInput } from "@/lib/format";
import { th } from "@/i18n/th";
import { TextField } from "./TextField";

type Props = Omit<ComponentProps<typeof TextField>, "value" | "defaultValue" | "onChange" | "error"> & {
  /** ค่าทศนิยมมาตรฐาน เช่น "12345.60" (string เพื่อไม่ผ่าน float) */
  value: string;
  /** เรียกเฉพาะเมื่อค่าที่กรอกถูกต้อง ค่าที่ผิดจะไม่ถูกบันทึก */
  onValueChange: (value: string) => void;
};

/** ช่องกรอกจำนวนเงิน: รับตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง แสดงตัวคั่นหลักพันเมื่อออกจากช่อง */
export function AmountField({ value, onValueChange, onFocus, onBlur, ...rest }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const shown = draft ?? (value === "" ? "" : formatMoney(value));

  return (
    <TextField
      {...rest}
      inputMode="decimal"
      autoComplete="off"
      className={`[&_input]:text-right [&_input]:tabular-nums ${rest.className ?? ""}`}
      value={shown}
      error={error}
      onFocus={(e) => {
        if (draft === null) setDraft(value);
        onFocus?.(e);
      }}
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        const parsed = parseAmountInput(text);
        if (parsed.ok) {
          setError(undefined);
          onValueChange(parsed.value);
        } else {
          setError(parsed.error === "too-many-decimals" ? th.amount.tooManyDecimals : th.amount.invalid);
        }
      }}
      onBlur={(e) => {
        if (!error) setDraft(null);
        onBlur?.(e);
      }}
    />
  );
}
