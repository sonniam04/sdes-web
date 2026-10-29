"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useId, useState, type ReactNode } from "react";
import { th } from "@/i18n/th";
import { Button } from "./Button";

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** สรุปสิ่งที่จะเกิดขึ้น เช่น เลขเอกสาร ผู้ขาย ยอดจ่ายสุทธิ */
  summary: ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  /** การปฏิเสธต้องมีเหตุผล — ปุ่มยืนยันกดไม่ได้จนกว่าจะกรอก */
  requireReason?: boolean;
  onConfirm: (reason?: string) => void;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  summary,
  confirmLabel,
  tone = "primary",
  requireReason = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState("");
  const reasonId = useId();
  const missingReason = requireReason && reason.trim() === "";

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) setReason("");
        onOpenChange(o);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgb(27_43_75/0.35)]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(480px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 border-[1.5px] border-rule-strong bg-surface font-sans text-text">
          <Dialog.Title className="border-b border-rule-strong bg-surface-sunken px-4 py-2 text-title font-bold">
            {title}
          </Dialog.Title>
          <Dialog.Description asChild>
            <div className="px-4 pt-3">{summary}</div>
          </Dialog.Description>
          {requireReason && (
            <div className="flex flex-col gap-0.5 px-4 pt-3">
              <label htmlFor={reasonId} className="text-label text-text-muted">
                {th.confirm.reasonLabel}
              </label>
              <textarea
                id={reasonId}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="rounded-sm border border-rule px-2 py-1 outline-none focus:border-focus focus:outline-2 focus:outline-focus"
              />
              {missingReason && <span className="text-label text-text-muted">{th.confirm.reasonRequired}</span>}
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2 border-t border-rule-strong bg-surface-sunken px-4 py-2">
            <Dialog.Close asChild>
              <Button>{th.common.cancel}</Button>
            </Dialog.Close>
            <Button
              variant={tone}
              disabled={missingReason}
              onClick={() => {
                onConfirm(requireReason ? reason.trim() : undefined);
                setReason("");
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
