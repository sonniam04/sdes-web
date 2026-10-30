"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

/** กล่องฟอร์ม/ข้อมูลกลางจอ (ใช้ร่วมในหน้าจัดการผู้ใช้และ API keys) — dismissible=false ปิดด้วยคลิกนอกกล่องหรือ Esc ไม่ได้ */
export function Panel({
  open,
  onOpenChange,
  title,
  children,
  dismissible = true,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  children: ReactNode;
  dismissible?: boolean;
}) {
  const block = (e: Event) => {
    if (!dismissible) e.preventDefault();
  };
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgb(27_43_75/0.35)]" />
        <Dialog.Content
          aria-describedby={undefined}
          onEscapeKeyDown={block}
          onPointerDownOutside={block}
          className="fixed top-1/2 left-1/2 z-50 w-[min(460px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 border-[1.5px] border-rule-strong bg-surface font-sans text-text"
        >
          <Dialog.Title className="border-b border-rule-strong bg-surface-sunken px-4 py-2 text-title font-bold">{title}</Dialog.Title>
          <div className="p-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
