"use client";

// รายละเอียดผู้ขาย + เอกสารของผู้ขาย — อ่านอย่างเดียว (spec vendor-directory "Vendor detail")
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { NewVendorBadge } from "@/components/NewVendorBadge";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatMoney, formatThaiDate } from "@/lib/format";
import { branchLabel, type Vendor, type VendorDocument } from "@/lib/vendors";

export default function VendorPage() {
  return (
    <AppFrame roles={["AP_CLERK", "AP_LEAD"]}>
      <VendorDetail />
    </AppFrame>
  );
}

function VendorDetail() {
  const { id } = useParams<{ id: string }>();
  const { client } = useAuth();
  const [data, setData] = useState<{ vendor: Vendor; documents: VendorDocument[] }>();
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setError(undefined);
    try {
      setData(await client.request<{ vendor: Vendor; documents: VendorDocument[] }>(`/vendors/${id}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดข้อมูลผู้ขายไม่สำเร็จ");
    }
  }, [client, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <div className="mx-auto mt-16 max-w-md"><ErrorState title={error} onRetry={() => void load()} /></div>;
  if (!data) return <div className="p-6"><Skeleton lines={8} /></div>;
  const v = data.vendor;

  const facts: [string, React.ReactNode][] = [
    ["เลขประจำตัวผู้เสียภาษี", <span key="tax" className="num">{v.taxId}</span>],
    ["สาขา", branchLabel(v.branchCode)],
    ["จำนวนเอกสาร", <span key="count" className="num">{v.documentCount}</span>],
    ["ยอดรวม (บาท)", <span key="total" className="num">{formatMoney(v.totalAmount)}</span>],
    ["เอกสารล่าสุด", v.lastInvoiceDate ? formatThaiDate(v.lastInvoiceDate) : "—"],
    ["คู่ค้าใน ERP", <span key="erp" className="num">{v.erpPartnerId ?? "ยังไม่ได้ส่งเข้า ERP"}</span>],
  ];

  return (
    <main className="mx-auto flex max-w-[1180px] flex-col gap-3 px-5 py-4">
      <div className="text-small">
        <Link href="/vendors" className="text-text-muted hover:text-text">
          ผู้ขาย
        </Link>
        <span aria-hidden> / </span>
        <span>{v.name}</span>
      </div>
      <div className="flex items-center gap-3">
        <h1 className="text-heading font-bold">{v.name}</h1>
        {v.isNew && <NewVendorBadge />}
      </div>

      <dl data-testid="vendor-facts" className="grid grid-cols-3 gap-px border-[1.5px] border-rule-strong bg-rule-strong">
        {facts.map(([k, val]) => (
          <div key={k} className="bg-surface px-4 py-2.5">
            <dt className="text-label text-text-muted">{k}</dt>
            <dd className="font-semibold">{val}</dd>
          </div>
        ))}
      </dl>

      <section aria-label="เอกสารของผู้ขาย" className="flex flex-col gap-2 border-[1.5px] border-rule-strong bg-surface p-4">
        <h2 className="font-semibold">เอกสาร {data.documents.length === 100 ? "(100 ฉบับล่าสุด)" : ""}</h2>
        {data.documents.length === 0 ? (
          <EmptyState title="ยังไม่มีเอกสารของผู้ขายรายนี้" />
        ) : (
          <table className="w-full border-collapse text-small">
            <thead>
              <tr>
                {["เลขที่", "เลขใบกำกับ", "วันที่ใบกำกับ", "ยอดรวม (บาท)", "สถานะ"].map((h, i) => (
                  <th key={h} scope="col" className={`border-b border-rule-strong px-2.5 py-1.5 text-label font-semibold text-text-muted ${i === 3 ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.documents.map((d) => (
                <tr key={d.id} data-doc={d.docNo} className="h-[var(--row-height)] border-b border-rule-soft">
                  <td className="num px-2.5 font-semibold">
                    <Link href={`/documents/${d.id}`} className="underline underline-offset-[3px] hover:text-action">
                      {d.docNo}
                    </Link>
                  </td>
                  <td className="px-2.5">{d.invoiceNo ?? "—"}</td>
                  <td className="px-2.5">{d.invoiceDate ? formatThaiDate(d.invoiceDate) : "—"}</td>
                  <td className="num px-2.5 text-right">{d.grandTotal ? formatMoney(d.grandTotal) : "—"}</td>
                  <td className="px-2.5">
                    <StatusBadge status={d.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
