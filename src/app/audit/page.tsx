"use client";

// Audit trail: ค้นหา แบ่งหน้า และส่งออก CSV — อ่านอย่างเดียว (spec audit-trail)
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AppFrame } from "@/components/AppFrame";
import { Button } from "@/components/ui/Button";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Select } from "@/components/ui/Select";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { actionLabel, auditQuery, changeOf, type AuditEvent, type AuditFilters } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";
import { canViewDocuments } from "@/lib/roles";

const PAGE_SIZE = 50;
/** Radix Select ไม่รับค่าว่าง จึงใช้ค่านี้แทน "ทั้งหมด" */
const ALL = "__all";

type Facets = { actors: { id: string; displayName: string }[]; actions: string[] };
type Page = { items: AuditEvent[]; nextBefore: string | null };

export default function AuditPage() {
  return (
    <AppFrame roles={["FINANCE_EXEC", "SYS_ADMIN"]}>
      <AuditTrail />
    </AppFrame>
  );
}

function AuditTrail() {
  const { state, client } = useAuth();
  const toast = useToast();
  const canOpen = state.status === "authenticated" && canViewDocuments(state.user.roles);
  const [facets, setFacets] = useState<Facets>();
  const [draft, setDraft] = useState<AuditFilters>({});
  const [applied, setApplied] = useState<AuditFilters>({});
  // cursor ของแต่ละหน้า: หน้าแรก = undefined
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [page, setPage] = useState<Page>();
  const [error, setError] = useState<string>();
  const [exporting, setExporting] = useState(false);

  const current = cursors[cursors.length - 1];

  useEffect(() => {
    client.request<Facets>("/audit-events/facets").then(setFacets, () => setFacets({ actors: [], actions: [] }));
  }, [client]);

  const load = useCallback(async () => {
    setError(undefined);
    setPage(undefined);
    try {
      const q = auditQuery(applied, current);
      q.set("limit", String(PAGE_SIZE));
      setPage(await client.request<Page>(`/audit-events?${q}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลด audit trail ไม่สำเร็จ");
    }
  }, [client, applied, current]);

  useEffect(() => {
    void load();
  }, [load]);

  function search(e: FormEvent) {
    e.preventDefault();
    if (draft.from && draft.to && draft.from > draft.to) {
      toast("วันที่เริ่มต้องไม่หลังวันที่สิ้นสุด", "error");
      return;
    }
    setApplied({ ...draft });
    setCursors([undefined]);
  }

  async function exportCsv() {
    setExporting(true);
    try {
      // ส่งออกตามตัวกรองที่ค้นอยู่ (ไม่ใช่ค่าที่พิมพ์ค้างในฟอร์ม)
      const { data, headers } = await client.requestBinary(`/audit-events/export?${auditQuery(applied)}`);
      const name = /filename="([^"]+)"/.exec(headers.get("Content-Disposition") ?? "")?.[1] ?? "audit.csv";
      const url = URL.createObjectURL(new Blob([data], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "ส่งออกไม่สำเร็จ", "error");
    } finally {
      setExporting(false);
    }
  }

  const set = <K extends keyof AuditFilters>(k: K, v: string) => setDraft((d) => ({ ...d, [k]: v === ALL ? undefined : v }));

  const columns: Column<AuditEvent>[] = [
    { key: "at", header: "เวลา", width: "128px", render: (r) => formatDateTime(r.occurredAt) },
    { key: "actor", header: "ผู้กระทำ", width: "150px", render: (r) => (r.actorType === "SYSTEM" ? <span className="text-text-muted">ระบบ</span> : (r.actorName ?? "—")) },
    { key: "action", header: "การกระทำ", width: "190px", render: (r) => <span title={r.action}>{actionLabel(r.action)}</span> },
    {
      key: "entity",
      header: "สิ่งที่ถูกกระทำ",
      width: "120px",
      render: (r) =>
        r.entityType === "document" && r.entityId && canOpen ? (
          <Link href={`/documents/${r.entityId}`} className="underline-offset-2 hover:underline">
            เอกสาร
          </Link>
        ) : (
          <span className="text-text-muted">{r.entityType === "document" ? "เอกสาร" : r.entityType}</span>
        ),
    },
    {
      key: "change",
      header: "ค่าก่อน → หลัง",
      render: (r) => {
        const c = changeOf(r.details);
        if (!c) return <span className="text-text-muted">—</span>;
        return (
          <span data-testid="change">
            <span className="font-mono text-label text-text-muted">{c.field}</span> <span className="text-text-muted">{c.before}</span> → <span className="font-semibold">{c.after}</span>
          </span>
        );
      },
    },
  ];

  return (
    <main className="mx-auto flex max-w-[1180px] flex-col gap-3 px-5 py-4">
      <h1 className="text-heading font-bold">Audit trail</h1>

      <form onSubmit={search} aria-label="ค้นหา audit" className="grid grid-cols-[repeat(5,minmax(0,1fr))_auto] items-end gap-3 border-[1.5px] border-rule-strong bg-surface p-4" noValidate>
        <TextField label="ตั้งแต่วันที่" type="date" value={draft.from ?? ""} onChange={(e) => set("from", e.target.value)} />
        <TextField label="ถึงวันที่" type="date" value={draft.to ?? ""} onChange={(e) => set("to", e.target.value)} />
        <Select
          label="ผู้กระทำ"
          value={draft.actorUserId ?? ALL}
          onValueChange={(v) => set("actorUserId", v)}
          options={[{ value: ALL, label: "ทุกคน" }, ...(facets?.actors ?? []).map((a) => ({ value: a.id, label: a.displayName }))]}
        />
        <Select
          label="ประเภทการกระทำ"
          value={draft.action ?? ALL}
          onValueChange={(v) => set("action", v)}
          options={[{ value: ALL, label: "ทุกประเภท" }, ...(facets?.actions ?? []).map((a) => ({ value: a, label: actionLabel(a) }))]}
        />
        <TextField label="เลขเอกสาร" placeholder="DOC-000120" value={draft.docNo ?? ""} onChange={(e) => set("docNo", e.target.value)} />
        <Button type="submit" variant="primary">
          ค้นหา
        </Button>
      </form>

      <section aria-label="ผลการค้นหา" className="flex flex-col gap-2 border-[1.5px] border-rule-strong bg-surface p-4">
        <div className="flex items-center gap-2">
          <span className="text-small text-text-muted" data-testid="page-info">
            หน้า {cursors.length} · เรียงจากใหม่ไปเก่า
          </span>
          <Button className="ml-auto" loading={exporting} onClick={() => void exportCsv()} title="ส่งออกผลการค้นหาปัจจุบัน สูงสุด 50,000 แถว">
            ส่งออก CSV
          </Button>
        </div>
        {error ? (
          <ErrorState title={error} onRetry={() => void load()} />
        ) : !page ? (
          <Skeleton lines={6} />
        ) : page.items.length === 0 ? (
          <EmptyState title="ไม่พบรายการตามเงื่อนไข" />
        ) : (
          <DataTable caption="ผลการค้นหา audit trail" columns={columns} rows={page.items} rowKey={(r) => r.id} />
        )}
        <div className="flex justify-end gap-2">
          <Button disabled={cursors.length === 1} onClick={() => setCursors((c) => c.slice(0, -1))}>
            ก่อนหน้า
          </Button>
          <Button disabled={!page?.nextBefore} onClick={() => page?.nextBefore && setCursors((c) => [...c, page.nextBefore!])}>
            ถัดไป
          </Button>
        </div>
      </section>
    </main>
  );
}
