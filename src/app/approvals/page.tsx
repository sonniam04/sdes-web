"use client";

// คิวรออนุมัติของ AP Lead (spec document-review "Approval queue")
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { AppFrame } from "@/components/AppFrame";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { RiskFlag } from "@/lib/core";
import { formatMoney } from "@/lib/format";

type Row = { id: string; docNo: string; vendorName: string | null; invoiceNo: string | null; grandTotal: string | null; riskFlags: RiskFlag[] };

export default function ApprovalsPage() {
  return (
    <AppFrame roles={["AP_LEAD"]}>
      <Approvals />
    </AppFrame>
  );
}

function Approvals() {
  const { client } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setError(undefined);
    try {
      setRows((await client.request<{ items: Row[] }>("/documents/approvals")).items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดคิวรออนุมัติไม่สำเร็จ");
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto flex max-w-[1400px] flex-col gap-3 px-5 py-4">
      <div className="flex items-center gap-3">
        <h1 className="mr-auto text-heading font-bold">รออนุมัติ</h1>
        <Button onClick={() => void load()} icon={<RefreshCw aria-hidden className="size-4" />}>
          โหลดใหม่
        </Button>
      </div>
      <div className="border-[1.5px] border-rule-strong bg-surface">
        {error ? (
          <div className="p-4">
            <ErrorState title={error} onRetry={() => void load()} />
          </div>
        ) : rows === null ? (
          <Skeleton lines={5} label="กำลังโหลดคิวรออนุมัติ…" />
        ) : rows.length === 0 ? (
          <EmptyState title="ไม่มีเอกสารรออนุมัติ" body="เอกสารที่มีความเสี่ยงจะเข้ามาที่นี่หลังเจ้าหน้าที่ยืนยัน" />
        ) : (
          <table className="w-full border-collapse text-body">
            <thead>
              <tr>
                {["เลขที่", "ผู้ขาย", "เลขใบกำกับ", "ยอดรวม (บาท)", "เหตุผลที่ต้องอนุมัติ"].map((h, i) => (
                  <th key={h} scope="col" className={`border-b border-rule bg-surface-sunken px-2.5 py-1.5 text-label font-semibold text-text-muted ${i === 3 ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} data-doc={r.docNo} className="h-[var(--row-height)] border-b border-rule-soft">
                  <td className="num px-2.5 font-semibold">
                    <Link href={`/documents/${r.id}`} className="underline underline-offset-[3px] hover:text-action">
                      {r.docNo}
                    </Link>
                  </td>
                  <td className="max-w-[260px] truncate px-2.5">{r.vendorName ?? "—"}</td>
                  <td className="px-2.5">{r.invoiceNo ?? "—"}</td>
                  <td className="num px-2.5">{r.grandTotal ? formatMoney(r.grandTotal) : "—"}</td>
                  <td className="px-2.5 text-small text-risk">{r.riskFlags.map((f) => f.message).join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
