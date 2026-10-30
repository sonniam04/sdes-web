"use client";

// รายงานยอดซื้อ ภาษี และตัวชี้วัดกระบวนการ (spec finance-reports, design D7)
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Download } from "lucide-react";
import { AppFrame } from "@/components/AppFrame";
import { Button } from "@/components/ui/Button";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatMoney, formatSeconds, formatThaiMonth } from "@/lib/format";
import { DOCUMENT_STATUSES, type DocumentStatus } from "@/lib/status";

type Money = { subtotal: string; vat: string; wht: string; grandTotal: string };
type Report = {
  period: { from: string; to: string };
  months: ({ month: string; documentCount: number } & Money)[];
  totals: { documentCount: number } & Money;
  topVendors: { vendorId: string; name: string; taxId: string; branchCode: string; documentCount: number; grandTotal: string }[];
  process: {
    uploaded: number;
    statusCounts: Record<DocumentStatus, number>;
    avgSeconds: { toExtracted: number | null; toVerified: number | null; toSynced: number | null };
    approvalRate: number | null;
    noEditRate: number | null;
  };
};

const MAX_MONTHS = 24;
const currentMonth = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
const monthIndex = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
const percent = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);

export default function ReportsPage() {
  return (
    <AppFrame roles={["FINANCE_EXEC"]}>
      <Reports />
    </AppFrame>
  );
}

function Reports() {
  const { client } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState({ from: currentMonth(), to: currentMonth() });
  const [period, setPeriod] = useState(draft);
  const [report, setReport] = useState<Report>();
  const [error, setError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setError(undefined);
    setReport(undefined);
    try {
      setReport(await client.request<Report>(`/reports/summary?${new URLSearchParams(period)}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดรายงานไม่สำเร็จ");
    }
  }, [client, period]);

  useEffect(() => {
    void load();
  }, [load]);

  function apply(e: FormEvent) {
    e.preventDefault();
    const span = monthIndex(draft.to) - monthIndex(draft.from) + 1;
    if (!draft.from || !draft.to) return setFormError("เลือกเดือนเริ่มและเดือนสิ้นสุด");
    if (span < 1) return setFormError("เดือนเริ่มต้องไม่หลังเดือนสิ้นสุด");
    if (span > MAX_MONTHS) return setFormError(`เลือกช่วงเวลาได้ไม่เกิน ${MAX_MONTHS} เดือน`);
    setFormError(undefined);
    setPeriod({ ...draft });
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const { data, headers } = await client.requestBinary(`/reports/summary/export?${new URLSearchParams(period)}`);
      const name = /filename="([^"]+)"/.exec(headers.get("Content-Disposition") ?? "")?.[1] ?? "report.csv";
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

  const label = period.from === period.to ? formatThaiMonth(period.from) : `${formatThaiMonth(period.from)} – ${formatThaiMonth(period.to)}`;

  return (
    <main className="mx-auto flex max-w-[1180px] flex-col gap-3 px-5 py-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-heading font-bold">รายงาน</h1>
          <p className="text-small text-text-muted" data-testid="report-period">
            {label} · ยอดเงินตามวันที่ในใบกำกับ เฉพาะเอกสารที่ยืนยันแล้วขึ้นไปและไม่ถูกปฏิเสธ
          </p>
        </div>
        <form onSubmit={apply} aria-label="ช่วงเวลารายงาน" className="flex items-end gap-2" noValidate>
          <TextField label="ตั้งแต่เดือน" type="month" value={draft.from} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} />
          <TextField label="ถึงเดือน" type="month" value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} />
          <Button type="submit" variant="primary">
            แสดง
          </Button>
        </form>
        <Button icon={<Download aria-hidden className="size-4" />} loading={exporting} onClick={() => void exportCsv()}>
          ส่งออก CSV
        </Button>
      </div>
      {formError && (
        <p role="alert" data-testid="period-error" className="self-end border border-risk bg-risk-bg px-3 py-1.5 text-small text-risk">
          {formError}
        </p>
      )}

      {error ? (
        <ErrorState title={error} onRetry={() => void load()} />
      ) : !report ? (
        <Skeleton lines={10} />
      ) : (
        <>
          <section aria-label="ยอดรวมของช่วง" className="grid grid-cols-4 gap-px border-[1.5px] border-rule-strong bg-rule-strong">
            <Stat label="ยอดรวม (บาท)" testId="total-grand">{formatMoney(report.totals.grandTotal)}</Stat>
            <Stat label="ภาษีซื้อ (บาท)" testId="total-vat">{formatMoney(report.totals.vat)}</Stat>
            <Stat label="ภาษีหัก ณ ที่จ่าย (บาท)" testId="total-wht">{formatMoney(report.totals.wht)}</Stat>
            <Stat label="จำนวนเอกสาร" testId="total-count">{report.totals.documentCount.toLocaleString("th-TH")}</Stat>
          </section>

          <MonthlyTable report={report} />

          <div className="grid grid-cols-[3fr_2fr] gap-3">
            <TopVendors report={report} />
            <Process report={report} />
          </div>
        </>
      )}
    </main>
  );
}

function Stat({ label, testId, children }: { label: string; testId: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 bg-surface px-4 py-3">
      <span className="text-label text-text-muted">{label}</span>
      <span className="num text-heading font-bold" data-testid={testId}>
        {children}
      </span>
    </div>
  );
}

const th = (right = false) => `border-b border-rule-strong px-2.5 py-1.5 text-label font-semibold text-text-muted ${right ? "text-right" : "text-left"}`;

function MonthlyTable({ report }: { report: Report }) {
  const max = Math.max(...report.months.map((m) => Number(m.grandTotal)), 0);
  return (
    <section aria-label="ยอดรายเดือน" className="border-[1.5px] border-rule-strong bg-surface p-4">
      <h2 className="mb-2 font-semibold">ยอดรายเดือน</h2>
      <table className="w-full border-collapse text-small">
        <thead>
          <tr>
            <th scope="col" className={th()}>เดือน</th>
            <th scope="col" className={th(true)}>เอกสาร</th>
            <th scope="col" className={th(true)}>ยอดก่อนภาษี</th>
            <th scope="col" className={th(true)}>ภาษีซื้อ</th>
            <th scope="col" className={th(true)}>หัก ณ ที่จ่าย</th>
            <th scope="col" className={th(true)}>ยอดรวม</th>
            <th scope="col" className={`${th()} w-[22%]`}>
              <span className="sr-only">สัดส่วนยอดรวม</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {report.months.map((m) => {
            const value = Number(m.grandTotal);
            const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 1 : 0) : 0;
            return (
              <tr key={m.month} data-month={m.month} className="h-[var(--row-height)] border-b border-rule-soft">
                <td className="px-2.5">{formatThaiMonth(m.month)}</td>
                <td className="num px-2.5 text-right">{m.documentCount}</td>
                <td className="num px-2.5 text-right">{formatMoney(m.subtotal)}</td>
                <td className="num px-2.5 text-right">{formatMoney(m.vat)}</td>
                <td className="num px-2.5 text-right">{formatMoney(m.wht)}</td>
                <td className="num px-2.5 text-right font-semibold">{formatMoney(m.grandTotal)}</td>
                <td className="px-2.5" aria-hidden>
                  {/* แท่งสีเดียวยาวตามยอดรวม ปลายมน 4px ชิดฐาน — ตัวเลขอยู่ในคอลัมน์ซ้ายแล้ว */}
                  <div className="h-2.5" title={`${formatThaiMonth(m.month)}: ${formatMoney(m.grandTotal)} บาท`}>
                    <div className="h-full rounded-r-[4px] bg-focus" style={{ width: `${width}%` }} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr data-month="total" className="h-[var(--row-height)] border-t-[1.5px] border-rule-strong font-bold">
            <td className="px-2.5">รวม</td>
            <td className="num px-2.5 text-right">{report.totals.documentCount}</td>
            <td className="num px-2.5 text-right">{formatMoney(report.totals.subtotal)}</td>
            <td className="num px-2.5 text-right">{formatMoney(report.totals.vat)}</td>
            <td className="num px-2.5 text-right">{formatMoney(report.totals.wht)}</td>
            <td className="num px-2.5 text-right">{formatMoney(report.totals.grandTotal)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

function TopVendors({ report }: { report: Report }) {
  return (
    <section aria-label="ผู้ขายยอดสูงสุด" className="border-[1.5px] border-rule-strong bg-surface p-4">
      <h2 className="mb-2 font-semibold">ผู้ขายยอดสูงสุด 10 อันดับ</h2>
      {report.topVendors.length === 0 ? (
        <p className="text-small text-text-muted">ไม่มีเอกสารที่นับในช่วงนี้</p>
      ) : (
        <table className="w-full border-collapse text-small">
          <thead>
            <tr>
              <th scope="col" className={th()}>#</th>
              <th scope="col" className={th()}>ผู้ขาย</th>
              <th scope="col" className={th(true)}>เอกสาร</th>
              <th scope="col" className={th(true)}>ยอดรวม (บาท)</th>
            </tr>
          </thead>
          <tbody>
            {report.topVendors.map((v, i) => (
              <tr key={v.vendorId} className="h-[var(--row-height)] border-b border-rule-soft">
                <td className="num px-2.5 text-text-muted">{i + 1}</td>
                <td className="px-2.5">
                  {v.name} <span className="num text-label text-text-muted">{v.taxId}</span>
                </td>
                <td className="num px-2.5 text-right">{v.documentCount}</td>
                <td className="num px-2.5 text-right">{formatMoney(v.grandTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Process({ report }: { report: Report }) {
  const p = report.process;
  const rows: [string, string, string][] = [
    ["อัปโหลด → อ่านเสร็จ", formatSeconds(p.avgSeconds.toExtracted), "to-extracted"],
    ["อ่านเสร็จ → ยืนยัน", formatSeconds(p.avgSeconds.toVerified), "to-verified"],
    ["ยืนยัน → ส่ง ERP สำเร็จ", formatSeconds(p.avgSeconds.toSynced), "to-synced"],
    ["ต้องให้หัวหน้าอนุมัติ", percent(p.approvalRate), "approval-rate"],
    ["ยืนยันโดยไม่ต้องแก้ค่าที่ AI อ่าน", percent(p.noEditRate), "no-edit-rate"],
  ];
  return (
    <section aria-label="ตัวชี้วัดกระบวนการ" className="flex flex-col gap-3 border-[1.5px] border-rule-strong bg-surface p-4">
      <div>
        <h2 className="font-semibold">ตัวชี้วัดกระบวนการ</h2>
        <p className="text-label text-text-muted">เอกสารที่อัปโหลดในช่วงนี้ {p.uploaded.toLocaleString("th-TH")} ฉบับ (เวลาเฉลี่ย)</p>
      </div>
      <dl className="flex flex-col">
        {rows.map(([k, v, id]) => (
          <div key={id} className="flex items-baseline justify-between border-b border-rule-soft py-1.5 text-small">
            <dt>{k}</dt>
            <dd className="num font-semibold" data-testid={id}>
              {v}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5" data-testid="status-counts">
        {DOCUMENT_STATUSES.filter((s) => p.statusCounts[s] > 0).map((s) => (
          <span key={s} className="flex items-center gap-1.5" data-count={s}>
            <StatusBadge status={s} /> <span className="num text-small font-semibold">{p.statusCounts[s]}</span>
          </span>
        ))}
      </div>
    </section>
  );
}
