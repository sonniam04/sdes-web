"use client";

// System logs: ค้น warning/error ของ api และ worker — อ่านอย่างเดียว (spec system-logs "Log viewer", design D7)
import { Fragment, Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { AppFrame } from "@/components/AppFrame";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { TextField } from "@/components/ui/TextField";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime } from "@/lib/format";

const PAGE_SIZE = 50;
const ALL = "__all";

type Log = { id: string; createdAt: string; service: "api" | "worker"; level: "warn" | "error"; context: string | null; message: string; details: unknown };
type Filters = { from?: string; to?: string; level?: string; service?: string; q?: string };
type Page = { items: Log[]; nextBefore: string | null };

function logQuery(f: Filters, before?: string) {
  const q = new URLSearchParams();
  if (f.from) q.set("from", `${f.from}T00:00:00+07:00`);
  if (f.to) q.set("to", `${f.to}T23:59:59.999+07:00`);
  if (f.level) q.set("level", f.level);
  if (f.service) q.set("service", f.service);
  if (f.q?.trim()) q.set("q", f.q.trim());
  if (before) q.set("before", before);
  q.set("limit", String(PAGE_SIZE));
  return q;
}

const LEVEL = {
  error: { label: "error", tone: "border-risk bg-risk-bg text-risk" },
  warn: { label: "warning", tone: "border-status-waiting bg-status-waiting-bg text-status-waiting" },
} as const;

export default function LogsPage() {
  return (
    <AppFrame roles={["SYS_ADMIN"]}>
      <Suspense>
        <SystemLogs />
      </Suspense>
    </AppFrame>
  );
}

/** ตัวกรองเริ่มต้นจาก URL เช่น /admin/logs?level=error จากหน้าภาพรวม — ค่าที่ไม่รู้จักถูกละไว้ */
function filtersFrom(params: URLSearchParams): Filters {
  const level = params.get("level");
  const service = params.get("service");
  return {
    level: level && level in LEVEL ? level : undefined,
    service: service === "api" || service === "worker" ? service : undefined,
    q: params.get("q") ?? undefined,
  };
}

function SystemLogs() {
  const { client } = useAuth();
  const params = useSearchParams();
  const [draft, setDraft] = useState<Filters>(() => filtersFrom(params));
  const [applied, setApplied] = useState<Filters>(() => filtersFrom(params));
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [page, setPage] = useState<Page>();
  const [error, setError] = useState<string>();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const current = cursors[cursors.length - 1];

  const load = useCallback(async () => {
    setError(undefined);
    setPage(undefined);
    try {
      setPage(await client.request<Page>(`/admin/system-logs?${logQuery(applied, current)}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลด system logs ไม่สำเร็จ");
    }
  }, [client, applied, current]);

  useEffect(() => {
    void load();
  }, [load]);

  function search(e: FormEvent) {
    e.preventDefault();
    setApplied({ ...draft });
    setCursors([undefined]);
    setOpen(new Set());
  }

  const set = (k: keyof Filters, v: string) => setDraft((d) => ({ ...d, [k]: v === ALL ? undefined : v }));
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <main className="mx-auto flex max-w-[1180px] flex-col gap-3 px-5 py-4">
      <div>
        <h1 className="text-heading font-bold">System logs</h1>
        <p className="text-small text-text-muted">warning และ error ของ api และ worker ย้อนหลัง 30 วัน — ข้อมูลอ่อนไหวถูกปิดบังก่อนเก็บ</p>
      </div>

      <form onSubmit={search} aria-label="ค้นหา system logs" className="grid grid-cols-[repeat(5,minmax(0,1fr))_auto] items-end gap-3 border-[1.5px] border-rule-strong bg-surface p-4" noValidate>
        <TextField label="ตั้งแต่วันที่" type="date" value={draft.from ?? ""} onChange={(e) => set("from", e.target.value)} />
        <TextField label="ถึงวันที่" type="date" value={draft.to ?? ""} onChange={(e) => set("to", e.target.value)} />
        <Select
          label="ระดับ"
          value={draft.level ?? ALL}
          onValueChange={(v) => set("level", v)}
          options={[
            { value: ALL, label: "ทุกระดับ" },
            { value: "error", label: "error" },
            { value: "warn", label: "warning" },
          ]}
        />
        <Select
          label="บริการ"
          value={draft.service ?? ALL}
          onValueChange={(v) => set("service", v)}
          options={[
            { value: ALL, label: "ทุกบริการ" },
            { value: "api", label: "api" },
            { value: "worker", label: "worker" },
          ]}
        />
        <TextField label="คำในข้อความ" placeholder="DOC-000120" value={draft.q ?? ""} onChange={(e) => set("q", e.target.value)} />
        <Button type="submit" variant="primary">
          ค้นหา
        </Button>
      </form>

      <section aria-label="ผลการค้นหา" className="flex flex-col gap-2 border-[1.5px] border-rule-strong bg-surface p-4">
        <span className="text-small text-text-muted" data-testid="page-info">
          หน้า {cursors.length} · เรียงจากใหม่ไปเก่า · กดที่แถวเพื่อดูรายละเอียด
        </span>
        {error ? (
          <ErrorState title={error} onRetry={() => void load()} />
        ) : !page ? (
          <Skeleton lines={6} />
        ) : page.items.length === 0 ? (
          <EmptyState title="ไม่พบ log ตามเงื่อนไข" />
        ) : (
          <table className="w-full border-collapse text-small">
            <thead>
              <tr>
                {["", "เวลา", "ระดับ", "บริการ", "ส่วนของระบบ", "ข้อความ"].map((h, i) => (
                  <th key={i} scope="col" className="border-b border-rule-strong px-1.5 py-1.5 text-left text-label font-semibold text-text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {page.items.map((l) => {
                const expanded = open.has(l.id);
                return (
                  <Fragment key={l.id}>
                    <tr className="cursor-pointer border-b border-rule-soft align-top hover:bg-canvas" data-log={l.id} onClick={() => toggle(l.id)}>
                      <td className="w-6 px-1.5 py-1.5">
                        <button type="button" aria-expanded={expanded} aria-label={expanded ? "ซ่อนรายละเอียด" : "ดูรายละเอียด"} className="text-text-muted">
                          {expanded ? <ChevronDown aria-hidden className="size-4" /> : <ChevronRight aria-hidden className="size-4" />}
                        </button>
                      </td>
                      <td className="w-32 px-1.5 py-1.5 whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                      <td className="w-20 px-1.5 py-1.5">
                        <span className={`inline-block border px-1.5 text-label font-semibold ${LEVEL[l.level].tone}`}>{LEVEL[l.level].label}</span>
                      </td>
                      <td className="w-16 px-1.5 py-1.5 font-mono">{l.service}</td>
                      <td className="w-36 px-1.5 py-1.5 text-text-muted">{l.context ?? "—"}</td>
                      <td className="px-1.5 py-1.5 break-words">{l.message}</td>
                    </tr>
                    {expanded && (
                      <tr className="border-b border-rule-soft bg-surface-sunken">
                        <td />
                        <td colSpan={5} className="px-1.5 py-2">
                          <pre data-testid="log-details" className="max-h-72 overflow-auto font-mono text-label whitespace-pre-wrap">
                            {l.details ? JSON.stringify(l.details, null, 2) : "ไม่มีรายละเอียดเพิ่มเติม"}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
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
