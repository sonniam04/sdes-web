import type { ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { th } from "@/i18n/th";
import { Button } from "./Button";

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-12 text-center text-text-muted">
      <b className="text-title text-text">{title}</b>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title, message, onRetry }: { title: string; message?: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-2 border border-risk bg-risk-bg px-4 py-3 text-risk">
      <b className="flex items-center gap-1.5 font-bold">
        <AlertTriangle aria-hidden className="size-4" />
        {title}
      </b>
      {message && <p className="text-text">{message}</p>}
      <Button onClick={onRetry} icon={<RefreshCw aria-hidden className="size-4" />}>
        {th.common.retry}
      </Button>
    </div>
  );
}

export function Skeleton({ lines = 3, label = th.common.loading }: { lines?: number; label?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="flex flex-col gap-2 p-3">
      {Array.from({ length: lines }, (_, i) => (
        <span
          key={i}
          className="h-3 animate-pulse rounded-sm bg-rule-soft motion-reduce:animate-none"
          style={{ width: `${90 - ((i * 23) % 40)}%` }}
        />
      ))}
    </div>
  );
}
