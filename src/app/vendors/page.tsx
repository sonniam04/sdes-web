"use client";

// ทะเบียนผู้ขาย — ค้นหาและดูภาพรวม อ่านอย่างเดียว (spec vendor-directory, design D7)
import Link from "next/link";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { AppFrame } from "@/components/AppFrame";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatMoney, formatThaiDate } from "@/lib/format";
import { NewVendorBadge } from "@/components/NewVendorBadge";
import { branchLabel, type Vendor } from "@/lib/vendors";

const PAGE_SIZE = 50;

export default function VendorsPage() {
  return (
    <AppFrame roles={["AP_CLERK", "AP_LEAD"]}>
      <Vendors />
    </AppFrame>
  );
}

function Vendors() {
  const { client } = useAuth();
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [pageNo, setPageNo] = useState(1);
  const [data, setData] = useState<{ items: Vendor[]; total: number }>();
  const [error, setError] = useState<string>();
  const [reload, setReload] = useState(0);

  // ค้นหาเมื่อหยุดพิมพ์ 300 ms
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(input.trim());
      setPageNo(1);
    }, 300);
    return () => clearTimeout(t);
  }, [input]);

  useEffect(() => {
    let cancelled = false;
    setData(undefined);
    setError(undefined);
    const params = new URLSearchParams({ page: String(pageNo), pageSize: String(PAGE_SIZE) });
    if (q) params.set("q", q);
    client
      .request<{ items: Vendor[]; total: number }>(`/vendors?${params}`)
      .then((r) => !cancelled && setData(r))
      .catch((e) => !cancelled && setError(e instanceof ApiError ? e.message : "โหลดทะเบียนผู้ขายไม่สำเร็จ"));
    return () => {
      cancelled = true;
    };
  }, [client, q, pageNo, reload]);

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <main className="mx-auto flex max-w-[1180px] flex-col gap-3 px-5 py-4">
      <div className="flex items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-heading font-bold">ผู้ขาย</h1>
          <p className="text-small text-text-muted">ผู้ขายทุกรายที่ระบบรู้จักจากเอกสาร ยอดรวมนับเฉพาะเอกสารที่ยืนยันแล้วขึ้นไปและไม่ถูกปฏิเสธ</p>
        </div>
        <label className="relative w-80">
          <span className="sr-only">ค้นหาผู้ขาย</span>
          <Search aria-hidden className="absolute top-1/2 left-2 size-4 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="ชื่อ หรือเลขประจำตัวผู้เสียภาษี"
            className="w-full rounded-sm border border-rule bg-surface py-[3px] pr-2 pl-8 outline-none focus:border-focus focus:outline-2 focus:outline-focus"
          />
        </label>
      </div>

      <section aria-label="รายการผู้ขาย" className="border-[1.5px] border-rule-strong bg-surface">
        {error ? (
          <div className="p-4">
            <ErrorState title={error} onRetry={() => setReload((n) => n + 1)} />
          </div>
        ) : !data ? (
          <Skeleton lines={6} />
        ) : data.items.length === 0 ? (
          <EmptyState title={q ? `ไม่พบผู้ขายที่ตรงกับ "${q}"` : "ยังไม่มีผู้ขายในระบบ"} body={q ? undefined : "ผู้ขายจะถูกเพิ่มเมื่อยืนยันเอกสารฉบับแรกของผู้ขายรายนั้น"} />
        ) : (
          <table className="w-full border-collapse text-small">
            <thead>
              <tr>
                {["ผู้ขาย", "เลขประจำตัวผู้เสียภาษี", "สาขา", "เอกสาร", "ยอดรวม (บาท)", "เอกสารล่าสุด", "คู่ค้าใน ERP"].map((h, i) => (
                  <th key={h} scope="col" className={`border-b border-rule-strong px-2.5 py-1.5 text-label font-semibold text-text-muted ${i === 3 || i === 4 ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((v) => (
                <tr key={v.id} data-vendor={v.id} className="h-[var(--row-height)] border-b border-rule-soft">
                  <td className="px-2.5">
                    <Link href={`/vendors/${v.id}`} className="font-semibold underline-offset-[3px] hover:underline">
                      {v.name}
                    </Link>{" "}
                    {v.isNew && <NewVendorBadge />}
                  </td>
                  <td className="num px-2.5">{v.taxId}</td>
                  <td className="px-2.5">{branchLabel(v.branchCode)}</td>
                  <td className="num px-2.5 text-right">{v.documentCount}</td>
                  <td className="num px-2.5 text-right">{formatMoney(v.totalAmount)}</td>
                  <td className="px-2.5">{v.lastInvoiceDate ? formatThaiDate(v.lastInvoiceDate) : "—"}</td>
                  <td className="num px-2.5 text-text-muted">{v.erpPartnerId ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-small text-text-muted" data-testid="vendor-page">
            หน้า {pageNo} จาก {pages} · {data.total} ราย
          </span>
          <Button disabled={pageNo <= 1} onClick={() => setPageNo((p) => p - 1)}>
            ก่อนหน้า
          </Button>
          <Button disabled={pageNo >= pages} onClick={() => setPageNo((p) => p + 1)}>
            ถัดไป
          </Button>
        </div>
      )}
    </main>
  );
}
