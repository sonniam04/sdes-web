import { notFound } from "next/navigation";

// หน้าตรวจ token สำหรับ dev เท่านั้น (task 2.2) — production ตอบ 404
const amounts = ["1,234.50", "98,765.25", "186,900.00", "0.30"];
const thaiSamples = [
  "ใบกำกับภาษี / ใบแจ้งหนี้ ฉบับที่ปรึกษาสำนักงานใหญ่",
  "ผู้ขายนี้ไม่อยู่ในทะเบียน ตรวจสอบเลขประจำตัวผู้เสียภาษีก่อนยืนยัน",
  "ภาษีหัก ณ ที่จ่าย 1% · ยอดจ่ายสุทธิ · ปฏิเสธพร้อมเหตุผล",
];
const swatches = [
  "shell", "canvas", "surface", "surface-sunken", "document-canvas", "rule-strong", "rule", "rule-soft",
  "text", "text-muted", "action", "action-hover", "focus", "risk", "risk-bg",
  "status-progress", "status-progress-bg", "status-waiting", "status-waiting-bg",
  "status-success", "status-success-bg", "status-failed", "status-failed-bg",
  "status-ended", "status-ended-bg",
];

export default function TokensPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6">
      <h1 className="text-heading font-bold">Design tokens</h1>

      <section className="border-[1.5px] border-rule-strong bg-surface">
        <h2 className="border-b border-rule-strong bg-surface-sunken px-3 py-1 text-small font-bold">ตัวเลขจำนวนเงิน (tabular)</h2>
        <table className="w-80" data-testid="amounts">
          <tbody>
            {amounts.map((a) => (
              <tr key={a} className="border-b border-rule-soft">
                <td className="px-3 py-1 text-text-muted">ยอด</td>
                <td className="num px-3 py-1 font-semibold">{a}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="border-[1.5px] border-rule-strong bg-surface">
        <h2 className="border-b border-rule-strong bg-surface-sunken px-3 py-1 text-small font-bold">ข้อความไทย (สระบน/ล่าง)</h2>
        <div className="space-y-1 p-3" data-testid="thai">
          {thaiSamples.map((t) => (
            <p key={t}>{t}</p>
          ))}
          <p className="text-small text-text-muted">{thaiSamples[1]}</p>
          <p className="text-label text-text-muted">{thaiSamples[2]}</p>
        </div>
      </section>

      <section className="grid grid-cols-5 gap-2">
        {swatches.map((s) => (
          <div key={s} className="border border-rule bg-surface p-2 text-label">
            <div className="mb-1 h-10 border border-rule-soft" style={{ background: `var(--color-${s})` }} />
            {s}
          </div>
        ))}
      </section>
    </main>
  );
}
