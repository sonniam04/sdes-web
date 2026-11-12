"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ApiError, type ApiClient } from "@/lib/api/client";
import type { RiskFlag } from "@/lib/core";
import { formatMoney } from "@/lib/format";
import { fieldLabel, type DocumentDetail, type EditRecord } from "@/lib/review";

export function RiskReasons({ flags }: { flags: RiskFlag[] }) {
  return (
    <div data-testid="risk-reasons" className="border border-risk bg-risk-bg px-3 py-2 text-risk">
      <h2 className="flex items-center gap-1.5 text-small font-bold">
        <AlertTriangle aria-hidden className="size-4" /> เหตุผลที่ต้องอนุมัติ
      </h2>
      <ul className="mt-1 list-disc pl-5 text-small">
        {flags.map((f) => (
          <li key={f.code}>
            {f.message}
            {Array.isArray(f.value) && f.code === "MONEY_EDITED" ? ` (${(f.value as string[]).map(fieldLabel).join(", ")})` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? "แถวรายการ" : String(v));

/** ใครแก้อะไร: ค่าที่ AI อ่าน → ค่าก่อน → ค่าหลัง */
export function EditHistory({ edits }: { edits: EditRecord[] }) {
  return (
    <section className="border-[1.5px] border-rule-strong" aria-label="ประวัติการแก้ไข">
      <h2 className="border-b border-rule-strong bg-surface-sunken px-2.5 py-1 text-small font-bold">ประวัติการแก้ไข</h2>
      {edits.length === 0 ? (
        <p className="p-2.5 text-small text-text-muted">ไม่มีการแก้จากค่าที่ AI อ่าน</p>
      ) : (
        <table className="w-full text-small" data-testid="edit-history">
          <thead>
            <tr className="text-left text-label text-text-muted">
              <th className="px-2 py-1">ช่อง</th>
              <th className="px-2 py-1">AI อ่าน</th>
              <th className="px-2 py-1">ก่อน</th>
              <th className="px-2 py-1">หลัง</th>
              <th className="px-2 py-1">ผู้แก้</th>
            </tr>
          </thead>
          <tbody>
            {edits.map((e, i) => (
              <tr key={i} className="border-t border-rule-soft">
                <td className="px-2 py-1">{fieldLabel(e.field)}</td>
                <td className="num px-2 py-1 text-text-muted">{show(e.aiValue)}</td>
                <td className="num px-2 py-1">{show(e.before)}</td>
                <td className="num px-2 py-1 font-semibold">{show(e.after)}</td>
                <td className="px-2 py-1">{e.by.name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

type Props = {
  client: ApiClient;
  doc: DocumentDetail;
  meId: string;
  onDone: (message: string) => void;
  onError: (message: string) => void;
};

/** ปุ่มอนุมัติ/ปฏิเสธ — ถ้าผู้ใช้เป็นผู้ยืนยันหรือเคยแก้เอง บอกเหตุผลแทนการซ่อนปุ่ม (spec "Separation of duties") */
export function ApprovalPanel({ client, doc, meId, onDone, onError }: Props) {
  const [dialog, setDialog] = useState<"approve" | "reject" | null>(null);
  const [busy, setBusy] = useState(false);
  const own = doc.verifiedById === meId || doc.edits.some((e) => e.by.id === meId);

  async function decide(kind: "approve" | "reject", reason?: string) {
    setBusy(true);
    try {
      await client.request(`/documents/${doc.id}/${kind}`, { method: "POST", json: { version: doc.version, reason } });
      onDone(kind === "approve" ? `อนุมัติ ${doc.docNo} แล้ว` : `ปฏิเสธ ${doc.docNo} แล้ว`);
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "ทำรายการไม่สำเร็จ");
    } finally {
      setBusy(false);
      setDialog(null);
    }
  }

  const summary = (
    <span>
      {doc.docNo} · {doc.data.vendorName ?? "ไม่ทราบผู้ขาย"} · ยอดรวม {doc.data.grandTotal ? formatMoney(doc.data.grandTotal) : "—"} บาท
    </span>
  );

  return (
    <div className="flex flex-wrap items-center gap-2 border-t-[1.5px] border-rule-strong bg-surface-sunken px-4 py-2">
      {own ? (
        <span data-testid="self-approval" role="note" className="mr-auto text-label text-risk">
          อนุมัติเอกสารที่คุณยืนยันหรือแก้ไขเองไม่ได้ ต้องให้หัวหน้าคนอื่นอนุมัติ
        </span>
      ) : (
        <span className="mr-auto text-label text-text-muted">ตรวจเหตุผลและประวัติการแก้ก่อนตัดสิน</span>
      )}
      <Button variant="danger" disabled={own || busy} onClick={() => setDialog("reject")}>
        ปฏิเสธ
      </Button>
      <Button variant="primary" disabled={own || busy} onClick={() => setDialog("approve")}>
        อนุมัติ
      </Button>
      <ConfirmDialog
        open={dialog === "approve"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="อนุมัติเอกสารนี้?"
        summary={summary}
        confirmLabel="อนุมัติ"
        onConfirm={() => void decide("approve")}
      />
      <ConfirmDialog
        open={dialog === "reject"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="ปฏิเสธเอกสารนี้?"
        summary={summary}
        confirmLabel="ปฏิเสธ"
        tone="danger"
        requireReason
        onConfirm={(reason) => void decide("reject", reason)}
      />
    </div>
  );
}
