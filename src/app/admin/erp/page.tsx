"use client";

// ตั้งค่า ทดสอบ และเปิด/ปิดการส่งไป ERP (spec erp-connection, design D8)
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AppFrame } from "@/components/AppFrame";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime } from "@/lib/format";

type Adapter = "odoo" | "webhook";
type ApiMode = "json2" | "jsonrpc";
export type ErpConnection =
  | { configured: false; autoSync: false }
  | {
      configured: true;
      adapter: Adapter;
      url: string;
      database: string | null;
      apiMode?: ApiMode;
      login?: string | null;
      journalId?: number;
      purchaseTaxId?: number;
      expenseAccountId?: number;
      hasSecret: boolean;
      autoSync: boolean;
      testedAt: string | null;
      testPassed: boolean;
    };
type Check = { key: string; label: string; ok: boolean | null; message: string };

type Form = { adapter: Adapter; url: string; database: string; apiMode: ApiMode; login: string; journalId: string; purchaseTaxId: string; expenseAccountId: string; secret: string };
const EMPTY: Form = { adapter: "odoo", url: "", database: "", apiMode: "json2", login: "", journalId: "", purchaseTaxId: "", expenseAccountId: "", secret: "" };

const formOf = (c: ErpConnection): Form =>
  !c.configured
    ? EMPTY
    : {
        adapter: c.adapter,
        url: c.url,
        database: c.database ?? "",
        apiMode: c.apiMode ?? "json2",
        login: c.login ?? "",
        journalId: c.journalId ? String(c.journalId) : "",
        purchaseTaxId: c.purchaseTaxId ? String(c.purchaseTaxId) : "",
        expenseAccountId: c.expenseAccountId ? String(c.expenseAccountId) : "",
        secret: "",
      };

/** ตรวจฝั่งเว็บก่อนส่ง — ข้อความเดียวกับที่ API ใช้ (API ตรวจซ้ำเสมอ) */
function validate(f: Form, hasSecret: boolean): Partial<Record<keyof Form, string>> {
  const e: Partial<Record<keyof Form, string>> = {};
  if (!/^https?:\/\/[^\s/]+/.test(f.url.trim())) e.url = "URL ต้องขึ้นต้นด้วย http:// หรือ https://";
  if (!hasSecret && !f.secret) e.secret = f.adapter === "odoo" ? "ต้องระบุ API key ของ Odoo" : "ต้องระบุ secret ของ webhook";
  if (f.adapter === "odoo") {
    const ids: [keyof Form, string][] = [["journalId", "journal ซื้อ"], ["purchaseTaxId", "รหัสภาษีซื้อ"], ["expenseAccountId", "บัญชีค่าใช้จ่าย"]];
    for (const [k, label] of ids) if (!/^[1-9]\d*$/.test(f[k].trim())) e[k] = `${label}ต้องเป็นตัวเลขที่มากกว่า 0`;
    if (f.apiMode === "jsonrpc" && !f.login.trim()) e.login = "โหมด JSON-RPC ต้องระบุชื่อผู้ใช้";
    if (f.apiMode === "jsonrpc" && !f.database.trim()) e.database = "โหมด JSON-RPC ต้องระบุฐานข้อมูล";
  }
  return e;
}

export default function ErpPage() {
  return (
    <AppFrame roles={["SYS_ADMIN"]}>
      <ErpSettings />
    </AppFrame>
  );
}

function ErpSettings() {
  const { client } = useAuth();
  const toast = useToast();
  const [conn, setConn] = useState<ErpConnection>();
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [loadError, setLoadError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [checks, setChecks] = useState<Check[]>();
  const [switching, setSwitching] = useState(false);

  const apply = (c: ErpConnection) => {
    setConn(c);
    setForm(formOf(c));
  };

  const load = useCallback(async () => {
    setLoadError(undefined);
    try {
      apply(await client.request<ErpConnection>("/erp/connection"));
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "โหลดการตั้งค่าไม่สำเร็จ");
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const hasSecret = conn?.configured === true && conn.hasSecret;

  async function save(e: FormEvent) {
    e.preventDefault();
    setFormError(undefined);
    const found = validate(form, hasSecret);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      const odoo = form.adapter === "odoo";
      const saved = await client.request<ErpConnection>("/erp/connection", {
        method: "PUT",
        json: {
          adapter: form.adapter,
          url: form.url.trim(),
          ...(odoo && {
            database: form.database.trim() || null,
            apiMode: form.apiMode,
            login: form.login.trim() || null,
            journalId: Number(form.journalId),
            purchaseTaxId: Number(form.purchaseTaxId),
            expenseAccountId: Number(form.expenseAccountId),
          }),
          // เว้นว่าง = คง secret เดิม (spec "Secret protection")
          ...(form.secret && { secret: form.secret }),
        },
      });
      const wasOn = conn?.autoSync === true;
      apply(saved);
      setChecks(undefined);
      toast(wasOn && !saved.autoSync ? "บันทึกแล้ว การส่งอัตโนมัติถูกปิด ทดสอบการเชื่อมต่ออีกครั้งก่อนเปิด" : "บันทึกการตั้งค่าแล้ว", "success");
    } catch (err) {
      if (err instanceof ApiError) {
        const field = (err.body as { field?: string } | undefined)?.field;
        if (field && field in EMPTY) setErrors({ [field]: err.message });
        else setFormError(err.message);
      } else setFormError("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    setFormError(undefined);
    try {
      const r = await client.request<{ ok: boolean; checks: Check[] }>("/erp/connection/test", { method: "POST" });
      setChecks(r.checks);
      // ผลทดสอบผ่านเปลี่ยนสถานะของสวิตช์ จึงโหลดค่าล่าสุด
      setConn(await client.request<ErpConnection>("/erp/connection"));
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "ทดสอบไม่สำเร็จ");
    } finally {
      setTesting(false);
    }
  }

  async function toggleAutoSync(enabled: boolean) {
    setSwitching(true);
    try {
      setConn(await client.request<ErpConnection>("/erp/connection/auto-sync", { method: "PUT", json: { enabled } }));
      toast(enabled ? "เปิดการส่งอัตโนมัติแล้ว" : "ปิดการส่งอัตโนมัติแล้ว", "success");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "เปลี่ยนการส่งอัตโนมัติไม่สำเร็จ", "error");
    } finally {
      setSwitching(false);
    }
  }

  if (loadError) return <ErrorState title={loadError} onRetry={() => void load()} />;
  if (!conn) return <Skeleton lines={6} />;

  const odoo = form.adapter === "odoo";
  const dirty = JSON.stringify(form) !== JSON.stringify(formOf(conn));
  const blocked = !conn.configured
    ? "บันทึกการตั้งค่าการเชื่อมต่อก่อน"
    : !conn.testPassed
      ? "ทดสอบการเชื่อมต่อให้ผ่านก่อนเปิดการส่งอัตโนมัติ"
      : dirty
        ? "บันทึกการแก้ไขและทดสอบอีกครั้งก่อน"
        : null;

  return (
    <main className="mx-auto flex max-w-[720px] flex-col gap-3 px-5 py-4">
      <h1 className="text-heading font-bold">การเชื่อมต่อ ERP</h1>

      <section aria-label="การส่งอัตโนมัติ" className="flex items-start gap-3 border-[1.5px] border-rule-strong bg-surface p-4">
        <div className="flex flex-1 flex-col gap-0.5">
          <span id="auto-sync-label" className="font-semibold">
            ส่งเอกสารไป ERP อัตโนมัติ
          </span>
          <span className="text-small text-text-muted" data-testid="auto-sync-reason">
            {conn.autoSync ? "เอกสารที่ยืนยันหรืออนุมัติแล้วจะถูกส่งทันที" : (blocked ?? "ปิดอยู่ เอกสารที่พร้อมส่งจะรอจนกว่าจะเปิด")}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={conn.autoSync}
          aria-labelledby="auto-sync-label"
          disabled={switching || (!conn.autoSync && blocked !== null)}
          onClick={() => void toggleAutoSync(!conn.autoSync)}
          className={`relative h-6 w-11 shrink-0 rounded-full border-[1.5px] transition-colors duration-150 focus:outline-2 focus:outline-focus disabled:cursor-not-allowed disabled:opacity-45 ${conn.autoSync ? "border-action bg-action" : "border-rule-strong bg-surface-sunken"}`}
        >
          <span aria-hidden className={`absolute top-0.5 size-4 rounded-full bg-surface shadow transition-[left] duration-150 ${conn.autoSync ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </section>

      <form onSubmit={save} className="flex flex-col gap-3 border-[1.5px] border-rule-strong bg-surface p-4" noValidate>
        <Select
          label="ชนิดการเชื่อมต่อ"
          value={form.adapter}
          onValueChange={(v) => set("adapter", v as Adapter)}
          options={[
            { value: "odoo", label: "Odoo (ใบแจ้งหนี้ผู้ขายแบบร่าง)" },
            { value: "webhook", label: "Webhook (ส่ง JSON ที่ลงลายเซ็น)" },
          ]}
        />
        <TextField label={odoo ? "URL ของ Odoo" : "URL ปลายทาง"} placeholder="https://erp.example.com" value={form.url} error={errors.url} onChange={(e) => set("url", e.target.value)} />
        {odoo && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="รูปแบบ API"
                value={form.apiMode}
                onValueChange={(v) => set("apiMode", v as ApiMode)}
                options={[
                  { value: "json2", label: "JSON-2 (Odoo 19 ขึ้นไป)" },
                  { value: "jsonrpc", label: "JSON-RPC (Odoo 17–18)" },
                ]}
              />
              <TextField label="ฐานข้อมูล" hint={form.apiMode === "json2" ? "เว้นว่างได้ถ้า Odoo มีฐานเดียว" : undefined} value={form.database} error={errors.database} onChange={(e) => set("database", e.target.value)} />
            </div>
            {form.apiMode === "jsonrpc" && <TextField label="ชื่อผู้ใช้ Odoo" value={form.login} error={errors.login} onChange={(e) => set("login", e.target.value)} />}
            <div className="grid grid-cols-3 gap-3">
              <TextField label="Journal ซื้อ (id)" inputMode="numeric" value={form.journalId} error={errors.journalId} onChange={(e) => set("journalId", e.target.value)} />
              <TextField label="ภาษีซื้อ 7% (id)" inputMode="numeric" value={form.purchaseTaxId} error={errors.purchaseTaxId} onChange={(e) => set("purchaseTaxId", e.target.value)} />
              <TextField label="บัญชีค่าใช้จ่าย (id)" inputMode="numeric" value={form.expenseAccountId} error={errors.expenseAccountId} onChange={(e) => set("expenseAccountId", e.target.value)} />
            </div>
          </>
        )}
        <TextField
          label={odoo ? "API key" : "Webhook secret"}
          type="password"
          autoComplete="new-password"
          placeholder={hasSecret ? "ตั้งแล้ว" : undefined}
          hint={hasSecret ? "ตั้งแล้ว — กรอกเฉพาะเมื่อต้องการเปลี่ยน เว้นว่างเพื่อใช้ค่าเดิม" : "ระบบเก็บแบบเข้ารหัสและไม่แสดงค่านี้อีก"}
          value={form.secret}
          error={errors.secret}
          onChange={(e) => set("secret", e.target.value)}
          data-testid="secret"
        />
        {formError && (
          <p role="alert" className="border border-risk bg-risk-bg px-3 py-2 text-small text-risk">
            {formError}
          </p>
        )}
        <div className="flex items-center gap-2">
          {conn.configured && (
            <span className="text-small text-text-muted">
              {conn.testPassed && conn.testedAt ? `ทดสอบผ่านล่าสุด ${formatDateTime(conn.testedAt)}` : "ยังไม่ได้ทดสอบการตั้งค่านี้"}
            </span>
          )}
          <Button type="button" className="ml-auto" loading={testing} disabled={!conn.configured || dirty} title={dirty ? "บันทึกก่อนทดสอบ" : undefined} onClick={() => void test()}>
            ทดสอบการเชื่อมต่อ
          </Button>
          <Button type="submit" variant="primary" loading={saving} disabled={conn.configured && !dirty}>
            บันทึก
          </Button>
        </div>
      </form>

      {checks && (
        <section aria-label="ผลการทดสอบ" className="border-[1.5px] border-rule-strong bg-surface p-4">
          <h2 className="mb-2 font-semibold">ผลการทดสอบ</h2>
          <ul className="flex flex-col gap-1.5">
            {checks.map((c) => (
              <li key={c.key} data-check={c.key} data-ok={c.ok === null ? "skipped" : String(c.ok)} className="flex gap-2 text-small">
                <span aria-hidden className={`w-4 font-bold ${c.ok === true ? "text-status-success" : c.ok === false ? "text-risk" : "text-text-muted"}`}>
                  {c.ok === true ? "✓" : c.ok === false ? "✗" : "–"}
                </span>
                <span className="w-44 shrink-0">{c.label}</span>
                <span className={c.ok === false ? "text-risk" : "text-text-muted"}>{c.ok === null ? "ไม่ได้ตรวจ" : c.message}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
