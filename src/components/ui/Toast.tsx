"use client";

import * as RToast from "@radix-ui/react-toast";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Tone = "info" | "success" | "error";
/** ปุ่มทางเลือกบน toast เช่น "กลับไปดู" หลังยืนยันเอกสาร */
export type ToastAction = { label: string; onClick: () => void };
type Item = { id: number; message: string; tone: Tone; action?: ToastAction };

const ToastContext = createContext<((message: string, tone?: Tone, action?: ToastAction) => void) | null>(null);

const toneClass: Record<Tone, string> = {
  info: "bg-action text-action-text border-action",
  success: "bg-status-success-bg text-status-success border-status-success",
  error: "bg-risk-bg text-risk border-risk",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const show = useCallback((message: string, tone: Tone = "info", action?: ToastAction) => {
    setItems((xs) => [...xs, { id: Date.now() + Math.random(), message, tone, action }]);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      <RToast.Provider duration={4000} swipeDirection="down">
        {children}
        {items.map((t) => (
          <RToast.Root
            key={t.id}
            type={t.tone === "error" ? "foreground" : "background"}
            onOpenChange={(open) => !open && setItems((xs) => xs.filter((x) => x.id !== t.id))}
            data-tone={t.tone}
            duration={t.action ? 8000 : undefined}
            className={`flex items-center gap-3 rounded-sm border px-4 py-2 font-semibold data-[state=closed]:opacity-0 ${toneClass[t.tone]}`}
          >
            <RToast.Description>{t.message}</RToast.Description>
            {t.action && (
              <RToast.Action altText={t.action.label} asChild>
                <button type="button" onClick={t.action.onClick} className="underline underline-offset-4">
                  {t.action.label}
                </button>
              </RToast.Action>
            )}
          </RToast.Root>
        ))}
        <RToast.Viewport className="fixed bottom-16 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2 outline-none" />
      </RToast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast ต้องอยู่ภายใน <ToastProvider>");
  return show;
}
