"use client";

// ตั้งค่าเกณฑ์ความเสี่ยงและข้อมูลบริษัท (spec risk-assessment "Configurable thresholds")
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AppFrame } from "@/components/AppFrame";
import { AmountField } from "@/components/ui/AmountField";
import { Button } from "@/components/ui/Button";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";

type RiskSettings = { confidenceThreshold: number; highAmountThreshold: string | null; companyTaxId: string | null; companyName: string | null };

export default function SettingsPage() {
  return (
    <AppFrame roles={["SYS_ADMIN"]}>
      <Settings />
    </AppFrame>
  );
}

function Settings() {
  const { client } = useAuth();
  const toast = useToast();
  const [loaded, setLoaded] = useState<RiskSettings>();
  const [error, setError] = useState<string>();
  const [percent, setPercent] = useState("");
  const [highAmount, setHighAmount] = useState("");
  const [taxId, setTaxId] = useState("");
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const apply = (s: RiskSettings) => {
    setLoaded(s);
    setPercent(String(Math.round(s.confidenceThreshold * 10000) / 100));
    setHighAmount(s.highAmountThreshold ?? "");
    setTaxId(s.companyTaxId ?? "");
    setName(s.companyName ?? "");
  };

  const load = useCallback(async () => {
    setError(undefined);
    try {
      apply(await client.request<RiskSettings>("/settings/risk"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดการตั้งค่าไม่สำเร็จ");
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setFormError(undefined);
    const pct = Number(percent);
    if (percent.trim() === "" || Number.isNaN(pct) || pct < 0 || pct > 100) {
      setFormError("เกณฑ์ความมั่นใจต้องอยู่ระหว่าง 0 ถึง 100%");
      return;
    }
    setSaving(true);
    try {
      const saved = await client.request<RiskSettings>("/settings/risk", {
        method: "PUT",
        json: {
          // ช่องรับเป็น % แต่ API เก็บเป็น 0–1
          confidenceThreshold: pct / 100,
          highAmountThreshold: highAmount === "" ? null : highAmount,
          companyTaxId: taxId.trim() === "" ? null : taxId.trim(),
          companyName: name.trim() === "" ? null : name.trim(),
        },
      });
      apply(saved);
      toast("บันทึกการตั้งค่าแล้ว", "success");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-[720px] flex-col gap-3 px-5 py-4">
      <h1 className="text-heading font-bold">ตั้งค่าการตรวจความเสี่ยง</h1>
      {error ? (
        <ErrorState title={error} onRetry={() => void load()} />
      ) : !loaded ? (
        <Skeleton lines={4} />
      ) : (
        <form onSubmit={save} className="flex flex-col gap-3 border-[1.5px] border-rule-strong bg-surface p-4" noValidate>
          <TextField
            label="เกณฑ์ความมั่นใจของ AI (%)"
            hint="เอกสารที่ความมั่นใจต่ำกว่านี้ต้องให้หัวหน้าอนุมัติ (ค่าเริ่มต้น 85)"
            inputMode="decimal"
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
          />
          <AmountField
            label="เกณฑ์ยอดสูง (บาท)"
            hint="เว้นว่าง = ยังไม่ใช้กฎยอดสูง"
            value={highAmount}
            onValueChange={setHighAmount}
          />
          <TextField
            label="เลขประจำตัวผู้เสียภาษีของบริษัท"
            hint="ใช้ตรวจว่าใบกำกับภาษีออกให้บริษัทนี้"
            inputMode="numeric"
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
          />
          <TextField label="ชื่อบริษัท" value={name} onChange={(e) => setName(e.target.value)} />
          {formError && (
            <p role="alert" className="border border-risk bg-risk-bg px-3 py-2 text-small text-risk">
              {formError}
            </p>
          )}
          <Button type="submit" variant="primary" className="self-end" loading={saving}>
            บันทึก
          </Button>
        </form>
      )}
    </main>
  );
}
