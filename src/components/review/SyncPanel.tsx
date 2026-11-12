// สถานะการส่งเข้า ERP ในหน้ารายละเอียด (spec erp-sync "Sync status visibility", "Attempt history")
// ไม่มีปุ่มส่งใหม่ที่นี่ — ส่งใหม่ได้เฉพาะ System Admin จากหน้าติดตาม (/admin/sync)
import { formatDateTime } from "@/lib/format";
import type { DocumentDetail } from "@/lib/review";

const ATTEMPT_TEXT = { PENDING: "กำลังส่ง", SUCCESS: "สำเร็จ", FAILED: "ไม่สำเร็จ" } as const;

/** แสดงเมื่อเอกสารเข้าสู่ขั้นการส่งแล้ว หรือเคยมีการส่ง */
export const showSyncPanel = (doc: DocumentDetail) =>
  doc.status === "SYNCING" || doc.status === "SYNCED" || doc.status === "SYNC_FAILED" || doc.syncAttempts.length > 0;

export function SyncPanel({ doc }: { doc: DocumentDetail }) {
  return (
    <section className="border-[1.5px] border-rule-strong" aria-label="การส่งเข้า ERP">
      <h2 className="border-b border-rule-strong bg-surface-sunken px-2.5 py-1 text-small font-bold">การส่งเข้า ERP</h2>
      <div className="flex flex-col gap-1.5 p-2.5 text-small">
        {doc.status === "SYNCED" && doc.erpTransactionId && (
          <p data-testid="erp-ref">
            เลขอ้างอิง ERP <b className="num">{doc.erpTransactionId}</b>
            {doc.syncedAt && <span className="text-text-muted"> · ส่งสำเร็จ {formatDateTime(doc.syncedAt)}</span>}
          </p>
        )}
        {doc.status === "SYNCING" && <p className="text-status-progress">กำลังส่งเข้า ERP…</p>}
        {doc.status === "SYNC_FAILED" && (
          <div role="alert" data-testid="sync-error" className="border border-risk bg-risk-bg px-2.5 py-1.5 text-risk">
            <b>ส่งไม่สำเร็จ:</b> {doc.syncError ?? "ไม่ทราบสาเหตุ"}
            <span className="mt-0.5 block text-text-muted">ผู้ดูแลระบบส่งใหม่ได้จากหน้าติดตามการส่ง</span>
          </div>
        )}
        {doc.syncAttempts.length > 0 && (
          <table className="w-full" data-testid="sync-attempts">
            <thead>
              <tr className="text-left text-label text-text-muted">
                <th className="py-0.5 font-semibold">ครั้งที่</th>
                <th className="font-semibold">เวลา</th>
                <th className="font-semibold">ผล</th>
                <th className="font-semibold">รายละเอียด</th>
              </tr>
            </thead>
            <tbody>
              {doc.syncAttempts.map((a, i) => (
                <tr key={i} className="border-t border-rule-soft align-top">
                  <td className="num py-0.5">{a.attempt}</td>
                  <td className="whitespace-nowrap pr-2">{formatDateTime(a.requestedAt)}</td>
                  <td className={a.status === "FAILED" ? "text-risk" : a.status === "SUCCESS" ? "text-status-success" : ""}>{ATTEMPT_TEXT[a.status] ?? a.status}</td>
                  <td className="text-text-muted">{a.status === "FAILED" ? a.error : a.transactionId ? `${a.transactionId}${a.reused ? " (ใช้รายการเดิมใน ERP)" : ""}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
