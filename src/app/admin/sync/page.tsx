"use client";

// ภาพรวมคิวและการส่ง ERP + คิวที่ส่งไม่สำเร็จ (spec operations-monitoring, design D8)
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AppFrame } from "@/components/AppFrame";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime, formatMoney } from "@/lib/format";
import { canViewDocuments } from "@/lib/roles";
import { DOCUMENT_STATUSES, type DocumentStatus } from "@/lib/status";

/** spec: ข้อมูลต้องเป็นปัจจุบันไม่เกิน 30 วินาที */
const REFRESH_MS = 30_000;

type Overview = {
  counts: Record<DocumentStatus, number>;
  queues: { extract: number; sync: number };
  lastSyncedAt: string | null;
  autoSync: boolean;
  connected: boolean;
  serverTime: string;
};
type Failed = { id: string; docNo: string; vendorName: string | null; grandTotal: string | null; attempts: number; syncError: string | null; failedAt: string };

export default function SyncPage() {
  return (
    <AppFrame roles={["SYS_ADMIN", "FINANCE_EXEC"]}>
      <SyncMonitor />
    </AppFrame>
  );
}

function SyncMonitor() {
  const { state, client } = useAuth();
  const toast = useToast();
  const [overview, setOverview] = useState<Overview>();
  const [failed, setFailed] = useState<Failed[]>();
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);

  // Exec อ่านอย่างเดียว — ส่งใหม่ได้เฉพาะ SYS_ADMIN (permission sync.resend)
  const canResend = state.status === "authenticated" && state.user.roles.includes("SYS_ADMIN");
  const canOpen = state.status === "authenticated" && canViewDocuments(state.user.roles);

  const load = useCallback(async () => {
    try {
      const [o, f] = await Promise.all([client.request<Overview>("/ops/overview"), client.request<{ items: Failed[] }>("/ops/sync-failed")]);
      setOverview(o);
      setFailed(f.items);
      // ตัดรายการที่เลือกไว้แต่หายจากคิวแล้ว
      setSelected((s) => new Set([...s].filter((id) => f.items.some((x) => x.id === id))));
      setError(undefined);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [client]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  async function resend() {
    setConfirming(false);
    setSending(true);
    try {
      const { results } = await client.request<{ results: { id: string; ok: boolean; message?: string }[] }>("/documents/resend", {
        method: "POST",
        json: { ids: [...selected] },
      });
      const okCount = results.filter((r) => r.ok).length;
      const failedOnes = results.filter((r) => !r.ok);
      if (okCount) toast(`ส่งใหม่แล้ว ${okCount} ฉบับ`, "success");
      for (const r of failedOnes) toast(`${failed?.find((f) => f.id === r.id)?.docNo ?? r.id}: ${r.message ?? "ส่งใหม่ไม่สำเร็จ"}`, "error");
      setSelected(new Set());
      await load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "ส่งใหม่ไม่สำเร็จ", "error");
    } finally {
      setSending(false);
    }
  }

  if (error && !overview) return <ErrorState title={error} onRetry={() => void load()} />;
  if (!overview || !failed) return <Skeleton lines={8} />;

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allSelected = failed.length > 0 && selected.size === failed.length;

  const columns: Column<Failed>[] = [
    ...(canResend
      ? [
          {
            key: "pick",
            header: "",
            width: "32px",
            render: (r: Failed) => (
              <input type="checkbox" aria-label={`เลือก ${r.docNo}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="size-4 accent-[var(--color-action)]" />
            ),
          },
        ]
      : []),
    {
      key: "docNo",
      header: "เลขเอกสาร",
      width: "120px",
      render: (r) =>
        canOpen ? (
          <Link href={`/documents/${r.id}`} className="font-mono underline-offset-2 hover:underline">
            {r.docNo}
          </Link>
        ) : (
          <span className="font-mono">{r.docNo}</span>
        ),
    },
    { key: "vendor", header: "ผู้ขาย", render: (r) => r.vendorName ?? "—" },
    { key: "total", header: "ยอดรวม", align: "right", width: "120px", render: (r) => (r.grandTotal ? formatMoney(r.grandTotal) : "—") },
    { key: "attempts", header: "ส่งแล้ว (ครั้ง)", align: "right", width: "96px", render: (r) => r.attempts },
    { key: "error", header: "เหตุผลล่าสุด", render: (r) => <span className="text-risk">{r.syncError ?? "—"}</span> },
    { key: "at", header: "ล้มเหลวเมื่อ", width: "136px", render: (r) => formatDateTime(r.failedAt) },
  ];

  return (
    <main className="mx-auto flex max-w-[1180px] flex-col gap-3 px-5 py-4">
      <div className="flex items-baseline gap-3">
        <h1 className="text-heading font-bold">ติดตามคิวและการส่ง ERP</h1>
        <span className="text-small text-text-muted" data-testid="updated-at">
          ข้อมูล ณ {formatDateTime(overview.serverTime)} · รีเฟรชทุก 30 วินาที
        </span>
        {error && (
          <span role="status" className="text-small text-risk">
            รีเฟรชล่าสุดไม่สำเร็จ
          </span>
        )}
      </div>

      <section aria-label="ภาพรวม" className="grid grid-cols-4 gap-px border-[1.5px] border-rule-strong bg-rule-strong">
        <Stat label="การส่งอัตโนมัติ" testId="auto-sync">
          <span className={overview.autoSync ? "text-status-success" : "text-risk"}>{overview.autoSync ? "เปิด" : "ปิด"}</span>
          {!overview.connected && <span className="block text-small font-normal text-text-muted">ยังไม่ได้ตั้งค่าการเชื่อมต่อ</span>}
        </Stat>
        <Stat label="งานอ่านค้างในคิว" testId="queue-extract">
          {overview.queues.extract}
        </Stat>
        <Stat label="งานส่งค้างในคิว" testId="queue-sync">
          {overview.queues.sync}
        </Stat>
        <Stat label="ส่งสำเร็จล่าสุด" testId="last-synced">
          <span className="text-body">{overview.lastSyncedAt ? formatDateTime(overview.lastSyncedAt) : "ยังไม่มี"}</span>
        </Stat>
      </section>

      <section aria-label="จำนวนเอกสารตามสถานะ" className="flex flex-wrap gap-x-5 gap-y-2 border-[1.5px] border-rule-strong bg-surface px-4 py-3">
        {DOCUMENT_STATUSES.map((s) => (
          <div key={s} data-status={s} className="flex items-center gap-2">
            <StatusBadge status={s} />
            <span className="font-mono font-semibold tabular-nums" data-testid={`count-${s}`}>
              {overview.counts[s] ?? 0}
            </span>
          </div>
        ))}
      </section>

      <section aria-label="ส่ง ERP ไม่สำเร็จ" className="flex flex-col gap-2 border-[1.5px] border-rule-strong bg-surface p-4">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">ส่ง ERP ไม่สำเร็จ ({failed.length})</h2>
          {canResend && failed.length > 0 && (
            <>
              <label className="flex items-center gap-1.5 text-small">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(failed.map((f) => f.id)))}
                  className="size-4 accent-[var(--color-action)]"
                />
                เลือกทั้งหมด
              </label>
              <Button variant="primary" className="ml-auto" disabled={selected.size === 0} loading={sending} onClick={() => setConfirming(true)}>
                ส่งใหม่ {selected.size > 0 ? `(${selected.size})` : ""}
              </Button>
            </>
          )}
        </div>
        {failed.length === 0 ? (
          <EmptyState title="ไม่มีเอกสารที่ส่งไม่สำเร็จ" />
        ) : (
          <DataTable caption="เอกสารที่ส่ง ERP ไม่สำเร็จ เรียงจากเก่าไปใหม่" columns={columns} rows={failed} rowKey={(r) => r.id} />
        )}
      </section>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`ส่งใหม่ ${selected.size} ฉบับ`}
        summary={
          <>
            <p>ระบบจะส่งเอกสารต่อไปนี้ไป ERP อีกครั้ง</p>
            <p className="mt-1 font-mono text-small">
              {failed
                .filter((f) => selected.has(f.id))
                .map((f) => f.docNo)
                .join(", ")}
            </p>
          </>
        }
        confirmLabel="ส่งใหม่"
        onConfirm={() => void resend()}
      />
    </main>
  );
}

function Stat({ label, testId, children }: { label: string; testId: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 bg-surface px-4 py-3">
      <span className="text-label text-text-muted">{label}</span>
      <span className="text-heading font-bold tabular-nums" data-testid={testId}>
        {children}
      </span>
    </div>
  );
}
