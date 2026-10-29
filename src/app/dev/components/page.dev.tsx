"use client";

// หน้ารวม component ทุกตัวทุก state — dev เท่านั้น (ไม่อยู่ใน production build)
// ข้อมูลทั้งหมดเป็นตัวอย่าง
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { AmountField } from "@/components/ui/AmountField";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dropzone, type UploadResult } from "@/components/ui/Dropzone";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { AppShell } from "@/components/ui/AppShell";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { DOCUMENT_STATUSES } from "@/lib/status";
import { ROLES } from "@/lib/roles";
import { Send, Save } from "lucide-react";

function Section({ no, title, children }: { no: number; title: string; children: ReactNode }) {
  return (
    <section className="border-[1.5px] border-rule-strong bg-surface" aria-labelledby={`sec-${no}`}>
      <h2 id={`sec-${no}`} className="flex items-stretch gap-2 border-b border-rule-strong bg-surface-sunken text-small font-bold">
        <span className="flex items-center bg-action px-2.5 text-action-text">{no}</span>
        <span className="py-1">{title}</span>
      </h2>
      <div className="flex flex-col gap-4 p-4">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] items-start gap-4">
      <span className="pt-1 text-label text-text-muted">{label}</span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function ToastDemo() {
  const show = useToast();
  return (
    <>
      <Button onClick={() => show("ยืนยันแล้ว · เปิดใบถัดไป DOC-004215")}>แจ้งทั่วไป</Button>
      <Button onClick={() => show("ส่งเข้า ERP แล้ว · ERP-88213", "success")}>สำเร็จ</Button>
      <Button onClick={() => show("เอกสารนี้ถูกเปลี่ยนโดยผู้อื่นแล้ว โหลดข้อมูลล่าสุดก่อนแก้ต่อ", "error")}>ผิดพลาด</Button>
    </>
  );
}

export default function ComponentsPage() {
  const [amount, setAmount] = useState("12710.30");
  const [rate, setRate] = useState("1");
  const [dialog, setDialog] = useState<null | "approve" | "reject">(null);
  const [results, setResults] = useState<UploadResult[]>([
    { name: "siamsupply_IV2569-00981.pdf", ok: true, message: "กำลังอ่านข้อมูล", docNo: "DOC-004218" },
    { name: "officemate_110928.pdf", ok: false, message: "ไฟล์ซ้ำกับเอกสาร DOC-004212" },
  ]);

  return (
    <ToastProvider>
      <AppShell roles={["AP_LEAD"]} userName="สมศรี ใจดี (ตัวอย่าง)" currentPath="/documents" counts={{ "/approvals": 9 }}>
        <main className="mx-auto flex max-w-6xl flex-col gap-4 p-5">
          <h1 className="text-heading font-bold">Component ทั้งหมด</h1>
          <p className="text-small text-text-muted">หน้าสำหรับ dev · ข้อมูลทั้งหมดเป็นตัวอย่าง</p>

          <Section no={1} title="ปุ่ม">
            <Row label="ปกติ">
              <Button variant="primary" shortcut="Ctrl+Enter" icon={<Send aria-hidden className="size-4" />}>ยืนยันและไปใบถัดไป</Button>
              <Button icon={<Save aria-hidden className="size-4" />}>บันทึกร่าง</Button>
              <Button variant="danger">ปฏิเสธ…</Button>
            </Row>
            <Row label="disabled / loading">
              <Button variant="primary" disabled>อนุมัติและส่ง ERP</Button>
              <Button disabled>บันทึกร่าง</Button>
              <Button variant="primary" loading>กำลังบันทึก</Button>
            </Row>
          </Section>

          <Section no={2} title="ป้ายสถานะ (11) และความมั่นใจ (3 ระดับ)">
            <Row label="สถานะเอกสาร">
              <div data-testid="status-badges" className="flex flex-wrap gap-2">
                {DOCUMENT_STATUSES.map((s) => (
                  <StatusBadge key={s} status={s} />
                ))}
              </div>
            </Row>
            <Row label="ความมั่นใจ">
              <ConfidenceBadge value={0.99} showLevel />
              <ConfidenceBadge value={0.9} showLevel />
              <ConfidenceBadge value={0.74} showLevel />
            </Row>
          </Section>

          <Section no={3} title="ช่องกรอก">
            <div className="grid grid-cols-2 gap-4">
              <TextField label="ชื่อผู้ขาย" confidence={0.98} defaultValue="บริษัท สยามซัพพลาย จำกัด (ตัวอย่าง)" />
              <TextField label="เลขที่ใบกำกับ" confidence={0.81} defaultValue="IV2569-0O981" />
              <TextField label="เลขที่ใบกำกับ (แก้แล้ว)" confidence={0.81} resolved defaultValue="IV2569-00981" />
              <TextField label="วันที่" error="กรอกวันที่เป็น วว/ดด/ปปปป พ.ศ." defaultValue="31/02/2569" />
              <TextField label="สาขา" disabled defaultValue="สำนักงานใหญ่" />
              <TextField label="หมายเหตุ" hint="ไม่บังคับ" placeholder="เช่น เลขที่ใบสั่งซื้อ" />
              <AmountField label="จำนวนเงินรายการที่ 4" confidence={0.74} value={amount} onValueChange={setAmount} />
              <Select
                label="อัตราหัก ณ ที่จ่าย"
                value={rate}
                onValueChange={setRate}
                options={[
                  { value: "0", label: "ไม่หัก" },
                  { value: "1", label: "1% ค่าขนส่ง" },
                  { value: "3", label: "3% ค่าบริการ" },
                  { value: "5", label: "5% ค่าเช่า" },
                ]}
              />
            </div>
          </Section>

          <Section no={4} title="อัปโหลด">
            <Dropzone
              onFiles={(files, rejected) =>
                setResults([
                  ...files.map((f, i) => ({ name: f.name, ok: true, message: "กำลังอ่านข้อมูล", docNo: `DOC-00${4300 + i}` })),
                  ...rejected,
                ])
              }
              results={results}
            />
          </Section>

          <Section no={5} title="กล่องยืนยันและการแจ้งเตือน">
            <Row label="กล่องยืนยัน">
              <Button variant="primary" onClick={() => setDialog("approve")}>อนุมัติ…</Button>
              <Button variant="danger" onClick={() => setDialog("reject")}>ปฏิเสธ…</Button>
            </Row>
            <Row label="Toast">
              <ToastDemo />
            </Row>
          </Section>

          <Section no={6} title="สถานะว่าง / ผิดพลาด / กำลังโหลด">
            <div className="grid grid-cols-3 gap-4">
              <div className="border border-rule-soft">
                <EmptyState title="ยังไม่มีเอกสารรอตรวจ" body="ลากไฟล์ใบแจ้งหนี้มาวางเพื่อเริ่ม" action={<a className="font-semibold underline underline-offset-3" href="#sec-4">ไปที่อัปโหลด</a>} />
              </div>
              <ErrorState title="โหลดคิวเอกสารไม่สำเร็จ" message="การเชื่อมต่อขัดข้อง ข้อมูลที่แก้ไว้ยังไม่หาย" onRetry={() => {}} />
              <div className="border border-rule-soft">
                <Skeleton lines={4} />
              </div>
            </div>
          </Section>

          <Section no={7} title="เมนูตาม role">
            {ROLES.map((r) => (
              <div key={r} className="overflow-hidden border border-rule-soft">
                <AppShell roles={[r]} userName="ผู้ทดสอบ" currentPath="/" fullHeight={false}>
                  <span className="sr-only">ตัวอย่างเมนูของ {r}</span>
                </AppShell>
              </div>
            ))}
          </Section>
        </main>

        <ConfirmDialog
          open={dialog === "approve"}
          onOpenChange={(o) => !o && setDialog(null)}
          title="อนุมัติเอกสาร DOC-004216"
          summary={<p>บริษัท ขนส่งเร็ว จำกัด (ตัวอย่าง) · ยอดจ่ายสุทธิ <b className="num">185,031.00</b> บาท · ส่งเข้า ERP ทันทีหลังอนุมัติ</p>}
          confirmLabel="อนุมัติและส่ง ERP"
          onConfirm={() => setDialog(null)}
        />
        <ConfirmDialog
          open={dialog === "reject"}
          onOpenChange={(o) => !o && setDialog(null)}
          title="ปฏิเสธเอกสาร DOC-004216"
          summary={<p>เอกสารจะถูกปิดเป็น “ปฏิเสธแล้ว” และแจ้งเจ้าหน้าที่บัญชีที่อัปโหลด</p>}
          confirmLabel="ยืนยันการปฏิเสธ"
          tone="danger"
          requireReason
          onConfirm={() => setDialog(null)}
        />
      </AppShell>
    </ToastProvider>
  );
}
