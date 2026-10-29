"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw, WifiOff } from "lucide-react";
import { AppFrame } from "@/components/AppFrame";
import { Button } from "@/components/ui/Button";
import { Dropzone, type UploadResult } from "@/components/ui/Dropzone";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { QUEUE_TABS, useDocumentQueue, type UploadApiResult } from "@/lib/documents";
import { formatMoney, formatThaiDate } from "@/lib/format";

const CAN_UPLOAD = ["AP_CLERK", "AP_LEAD"] as const;
/** สถานะที่มีข้อมูลให้เปิดดู (อ่านแล้ว) */
const OPENABLE = new Set(["EXTRACTED", "VERIFIED", "PENDING_APPROVAL", "APPROVED", "REJECTED", "SYNCING", "SYNCED", "SYNC_FAILED"]);
const EPOCH = new Date(0).toISOString();

export default function DocumentsPage() {
  return (
    <AppFrame roles={["AP_CLERK", "AP_LEAD", "FINANCE_EXEC"]}>
      <Documents />
    </AppFrame>
  );
}

function Documents() {
  const { state, client } = useAuth();
  const toast = useToast();
  const { rows, error, live, reload, merge } = useDocumentQueue(client);
  const [tab, setTab] = useState(QUEUE_TABS[0]!.key);
  const [results, setResults] = useState<UploadResult[]>();
  const [uploading, setUploading] = useState(false);
  const [retrying, setRetrying] = useState<string>();

  const roles = state.status === "authenticated" ? state.user.roles : [];
  const canUpload = roles.some((r) => (CAN_UPLOAD as readonly string[]).includes(r));

  const counts = useMemo(
    () => Object.fromEntries(QUEUE_TABS.map((t) => [t.key, (rows ?? []).filter((r) => t.statuses.includes(r.status)).length])),
    [rows],
  );
  const active = QUEUE_TABS.find((t) => t.key === tab)!;
  const visible = (rows ?? []).filter((r) => active.statuses.includes(r.status));

  async function upload(files: File[], rejected: UploadResult[]) {
    if (files.length === 0) {
      setResults(rejected);
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      for (const f of files) form.append("files", f, f.name);
      const r = await client.request<{ results: UploadApiResult[]; warning?: string }>("/documents", { method: "POST", body: form });
      setResults([
        ...r.results.map((x): UploadResult =>
          x.ok
            ? { name: x.fileName, ok: true, message: "รับแล้ว กำลังอ่านข้อมูล", docNo: x.docNo }
            : { name: x.fileName, ok: false, message: x.message },
        ),
        ...rejected,
      ]);
      if (r.warning) toast(r.warning, "error");
      const created = r.results.filter((x) => x.ok);
      if (created.length) {
        const now = new Date().toISOString();
        merge(
          created.map((x) => ({
            id: x.id,
            docNo: x.docNo,
            status: x.status,
            fileName: x.fileName,
            vendorName: null,
            invoiceNo: null,
            invoiceDate: null,
            grandTotal: null,
            createdAt: now,
            // ยังไม่รู้เวลาของ server — ให้ข้อมูลจาก server (event หรือผลโหลด) แทนที่ได้เสมอ
            updatedAt: EPOCH,
          })),
          { insertOnly: true },
        );
        setTab("progress");
      }
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "อัปโหลดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", "error");
    } finally {
      setUploading(false);
    }
  }

  async function retry(id: string, docNo: string) {
    setRetrying(id);
    const row = (rows ?? []).find((r) => r.id === id)!;
    try {
      await client.request(`/documents/${id}/retry`, { method: "POST" });
      // คง updatedAt เดิมไว้ เพื่อให้ event ถัดไปจาก server แทนที่ได้แม้นาฬิกาเครื่องไม่ตรง
      merge([{ ...row, status: "PROCESSING" }], { ifUpdatedAt: row.updatedAt });
      toast(`ส่ง ${docNo} ไปอ่านใหม่แล้ว`, "success");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "สั่งอ่านใหม่ไม่สำเร็จ", "error");
    } finally {
      setRetrying(undefined);
    }
  }

  return (
    <main className="mx-auto flex max-w-[1400px] flex-col gap-3 px-5 py-4">
      <div className="flex items-center gap-3">
        <h1 className="mr-auto text-heading font-bold">คิวเอกสาร</h1>
        {live === "offline" && (
          <span role="status" className="inline-flex items-center gap-1.5 border border-status-waiting bg-status-waiting-bg px-3 py-1 text-small text-status-waiting">
            <WifiOff aria-hidden className="size-4" /> การเชื่อมต่อแบบ real-time หลุด สถานะอาจไม่เป็นปัจจุบัน
          </span>
        )}
        <Button onClick={reload} icon={<RefreshCw aria-hidden className="size-4" />}>
          โหลดใหม่
        </Button>
      </div>

      {canUpload && <Dropzone onFiles={upload} results={results} disabled={uploading} />}
      {uploading && <p className="text-small text-text-muted" role="status">กำลังอัปโหลดและสแกนไฟล์…</p>}

      <div>
        <div role="tablist" aria-label="กลุ่มสถานะ" className="flex border-b-[1.5px] border-rule-strong">
          {QUEUE_TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-[1.5px] flex items-center gap-2 border-[1.5px] px-3.5 py-1.5 ${tab === t.key ? "border-rule-strong border-b-surface bg-surface font-bold text-text" : "border-transparent text-text-muted"}`}
            >
              {t.label} <span className="num text-label">{counts[t.key] ?? 0}</span>
            </button>
          ))}
        </div>
        <div role="tabpanel" className="border-[1.5px] border-t-0 border-rule-strong bg-surface">
          {error ? (
            <div className="p-4">
              <ErrorState title={error} message="ตรวจสอบการเชื่อมต่อ แล้วลองใหม่" onRetry={reload} />
            </div>
          ) : rows === null ? (
            <Skeleton lines={6} label="กำลังโหลดคิวเอกสาร…" />
          ) : visible.length === 0 ? (
            <EmptyState title={`ไม่มีเอกสารในกลุ่ม “${active.label}”`} body={canUpload ? "ลากไฟล์ใบแจ้งหนี้หรือใบกำกับภาษีมาวางด้านบนเพื่อเริ่ม" : undefined} />
          ) : (
            <table className="w-full border-collapse text-body">
              <thead>
                <tr>
                  {["เลขที่", "ไฟล์ / ผู้ขาย", "เลขใบกำกับ", "วันที่ใบกำกับ", "ยอดรวม (บาท)", "สถานะ", ""].map((h, i) => (
                    <th key={i} scope="col" className={`sticky top-0 border-b border-rule bg-surface-sunken px-2.5 py-1.5 text-label font-semibold text-text-muted ${i === 4 ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} data-doc={r.docNo} className="h-[var(--row-height)] border-b border-rule-soft">
                    <td className="num px-2.5 text-left font-semibold">
                      {OPENABLE.has(r.status) ? (
                        <Link href={`/documents/${r.id}`} className="underline underline-offset-[3px] hover:text-action">
                          {r.docNo}
                        </Link>
                      ) : (
                        r.docNo
                      )}
                    </td>
                    <td className="max-w-[280px] truncate px-2.5" title={r.vendorName ?? r.fileName}>
                      {r.vendorName ?? <span className="text-text-muted">{r.fileName}</span>}
                    </td>
                    <td className="px-2.5">{r.invoiceNo ?? "—"}</td>
                    <td className="px-2.5">{r.invoiceDate ? formatThaiDate(r.invoiceDate.slice(0, 10)) : "—"}</td>
                    <td className="num px-2.5">{r.grandTotal ? formatMoney(r.grandTotal) : "—"}</td>
                    <td className="px-2.5">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-2.5 text-right">
                      {r.status === "EXTRACTED" && (
                        <span className="inline-flex items-center gap-2">
                          {(r.issueCount ?? 0) > 0 && (
                            <span data-testid="issue-count" className="num text-label font-semibold text-risk">
                              ต้องแก้ {r.issueCount}
                            </span>
                          )}
                          <Link href={`/documents/${r.id}`} className="inline-flex min-h-8 items-center border border-rule-strong px-3 text-small font-semibold hover:bg-surface-sunken">
                            {canUpload ? "ตรวจ" : "ดู"}
                          </Link>
                        </span>
                      )}
                      {r.status === "FAILED" && canUpload && (
                        <Button className="!py-0.5" loading={retrying === r.id} onClick={() => retry(r.id, r.docNo)} icon={<RefreshCw aria-hidden className="size-4" />}>
                          อ่านใหม่
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
