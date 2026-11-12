"use client";

// API key ของระบบภายนอก: สร้าง (แสดงค่าครั้งเดียว), ดูการใช้งาน, เพิกถอน (spec api-keys, design D7)
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Copy, KeyRound } from "lucide-react";
import { AppFrame } from "@/components/AppFrame";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Panel } from "@/components/ui/Panel";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDateTime, formatThaiDate } from "@/lib/format";

type Scope = "document.upload" | "document.read";
type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  scopes: Scope[];
  expiresAt: string;
  lastUsedAt: string | null;
  createdAt: string;
  createdBy: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  status: "active" | "expired" | "revoked";
};

const SCOPES: { value: Scope; label: string; hint: string }[] = [
  { value: "document.upload", label: "อัปโหลดเอกสาร", hint: "รวมการอ่านสถานะเอกสาร" },
  { value: "document.read", label: "อ่านสถานะเอกสาร", hint: "อ่านรายการและสถานะเท่านั้น" },
];
const SCOPE_LABEL: Record<Scope, string> = { "document.upload": "อัปโหลดเอกสาร", "document.read": "อ่านสถานะเอกสาร" };
const STATUS: Record<ApiKey["status"], { label: string; tone: string }> = {
  active: { label: "ใช้งานได้", tone: "border-status-success bg-status-success-bg text-status-success" },
  expired: { label: "หมดอายุ", tone: "border-status-ended bg-status-ended-bg text-status-ended" },
  revoked: { label: "เพิกถอนแล้ว", tone: "border-risk bg-risk-bg text-risk" },
};

export default function ApiKeysPage() {
  return (
    <AppFrame roles={["SYS_ADMIN"]}>
      <ApiKeys />
    </AppFrame>
  );
}

function ApiKeys() {
  const { client } = useAuth();
  const toast = useToast();
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [error, setError] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<{ name: string; key: string } | null>(null);
  const [revoking, setRevoking] = useState<ApiKey | null>(null);

  const load = useCallback(async () => {
    try {
      setKeys(await client.request<ApiKey[]>("/admin/api-keys"));
      setError(undefined);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลด API key ไม่สำเร็จ");
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(k: ApiKey) {
    setRevoking(null);
    try {
      await client.request(`/admin/api-keys/${k.id}/revoke`, { method: "POST" });
      toast(`เพิกถอน "${k.name}" แล้ว ระบบภายนอกที่ใช้ key นี้จะเรียก API ไม่ได้ทันที`, "success");
      await load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "เพิกถอนไม่สำเร็จ", "error");
    }
  }

  return (
    <main className="mx-auto flex max-w-[1180px] flex-col gap-3 px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-heading font-bold">API keys</h1>
          <p className="text-small text-text-muted">ให้ระบบภายนอก (เช่น เครื่องสแกน) อัปโหลดหรืออ่านสถานะเอกสารได้โดยไม่ใช้บัญชีของคน</p>
        </div>
        <Button variant="primary" icon={<KeyRound aria-hidden className="size-4" />} onClick={() => setCreating(true)}>
          สร้าง API key
        </Button>
      </div>

      <section aria-label="รายการ API key" className="border-[1.5px] border-rule-strong bg-surface">
        {error ? (
          <div className="p-4">
            <ErrorState title={error} onRetry={() => void load()} />
          </div>
        ) : !keys ? (
          <Skeleton lines={4} />
        ) : keys.length === 0 ? (
          <EmptyState title="ยังไม่มี API key" body="สร้าง key ให้ระบบภายนอกที่ต้องเรียก API ของ SDES" />
        ) : (
          <table className="w-full border-collapse text-small">
            <thead>
              <tr>
                {["ชื่อ", "Key", "ขอบเขต", "หมดอายุ", "ใช้ล่าสุด", "สร้างโดย", "สถานะ", ""].map((h, i) => (
                  <th key={i} scope="col" className="border-b border-rule-strong px-2.5 py-1.5 text-left text-label font-semibold text-text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} data-key={k.name} className="border-b border-rule-soft align-top">
                  <td className="px-2.5 py-2 font-semibold">{k.name}</td>
                  <td className="px-2.5 py-2 font-mono text-text-muted">sdes_{k.prefix}_…</td>
                  <td className="px-2.5 py-2">{k.scopes.map((s) => SCOPE_LABEL[s]).join(", ")}</td>
                  <td className="px-2.5 py-2">{formatThaiDate(k.expiresAt)}</td>
                  <td className="px-2.5 py-2" data-testid="last-used">
                    {k.lastUsedAt ? formatDateTime(k.lastUsedAt) : <span className="text-text-muted">ยังไม่เคยใช้</span>}
                  </td>
                  <td className="px-2.5 py-2">{k.createdBy ?? "—"}</td>
                  <td className="px-2.5 py-2">
                    <span data-testid="key-status" className={`inline-block border px-1.5 text-label font-semibold ${STATUS[k.status].tone}`}>
                      {STATUS[k.status].label}
                    </span>
                    {k.revokedAt && (
                      <span className="mt-0.5 block text-label text-text-muted">
                        โดย {k.revokedBy ?? "—"} {formatDateTime(k.revokedAt)}
                      </span>
                    )}
                  </td>
                  <td className="px-2.5 py-2 text-right">
                    {k.status === "active" && (
                      <Button variant="danger" className="!py-0.5" onClick={() => setRevoking(k)}>
                        เพิกถอน
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <CreateKey
        open={creating}
        onOpenChange={setCreating}
        onCreated={(name, key) => {
          setCreating(false);
          setRevealed({ name, key });
          void load();
        }}
      />
      <RevealKey value={revealed} onClose={() => setRevealed(null)} />
      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={`เพิกถอน "${revoking?.name ?? ""}"`}
        summary={<p>ระบบภายนอกที่ใช้ key นี้จะเรียก API ไม่ได้ทันที และนำ key นี้กลับมาใช้อีกไม่ได้</p>}
        confirmLabel="เพิกถอน"
        tone="danger"
        onConfirm={() => revoking && void revoke(revoking)}
      />
    </main>
  );
}

function CreateKey({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (name: string, key: string) => void }) {
  const { client } = useAuth();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<Scope[]>(["document.upload"]);
  const [days, setDays] = useState("90");
  const [formError, setFormError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setScopes(["document.upload"]);
    setDays("90");
    setFormError(undefined);
  }, [open]);

  const daysNum = Number(days);
  const daysOk = /^\d+$/.test(days) && daysNum >= 1 && daysNum <= 365;
  const valid = name.trim() !== "" && scopes.length > 0 && daysOk;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    setFormError(undefined);
    try {
      const r = await client.request<{ key: string; apiKey: { name: string } }>("/admin/api-keys", {
        method: "POST",
        json: { name: name.trim(), scopes, expiresInDays: daysNum },
      });
      onCreated(r.apiKey.name, r.key);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "สร้าง API key ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel open={open} onOpenChange={onOpenChange} title="สร้าง API key">
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <TextField label="ชื่อ (บอกว่าใช้กับระบบไหน)" placeholder="เครื่องสแกนชั้น 3" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-label text-text-muted">ขอบเขตสิทธิ์</legend>
          {SCOPES.map((s) => (
            <label key={s.value} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={scopes.includes(s.value)}
                onChange={(e) => setScopes(e.target.checked ? [...scopes, s.value] : scopes.filter((x) => x !== s.value))}
                className="size-4 accent-[var(--color-action)]"
              />
              {s.label} <span className="text-label text-text-muted">{s.hint}</span>
            </label>
          ))}
          {scopes.length === 0 && <span className="text-label text-risk">เลือกขอบเขตสิทธิ์อย่างน้อยหนึ่งอย่าง</span>}
        </fieldset>
        <TextField
          label="อายุ (วัน)"
          inputMode="numeric"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          error={daysOk ? undefined : "อายุต้องอยู่ระหว่าง 1 ถึง 365 วัน"}
          hint="ค่าเริ่มต้น 90 วัน — หมดอายุแล้วต้องสร้างใหม่"
        />
        {formError && (
          <p role="alert" className="border border-risk bg-risk-bg px-3 py-2 text-small text-risk">
            {formError}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button type="submit" variant="primary" disabled={!valid} loading={saving}>
            สร้าง
          </Button>
        </div>
      </form>
    </Panel>
  );
}

/** แสดงค่า key ครั้งเดียว — ปิดได้หลังยืนยันว่าเก็บแล้วเท่านั้น */
function RevealKey({ value, onClose }: { value: { name: string; key: string } | null; onClose: () => void }) {
  const toast = useToast();
  const [saved, setSaved] = useState(false);

  useEffect(() => setSaved(false), [value]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value!.key);
      toast("คัดลอก API key แล้ว", "success");
    } catch {
      toast("คัดลอกไม่ได้ เลือกข้อความแล้วคัดลอกเอง", "error");
    }
  }

  return (
    <Panel open={!!value} onOpenChange={(o) => !o && saved && onClose()} title={`API key: ${value?.name ?? ""}`} dismissible={false}>
      <p className="text-small">
        คัดลอก key นี้ไปตั้งในระบบภายนอกตอนนี้ <b>ระบบจะไม่แสดงค่านี้อีก</b> ถ้าหายต้องเพิกถอนแล้วสร้างใหม่
      </p>
      <output data-testid="api-key-value" className="mt-3 block border border-rule-strong bg-surface-sunken px-3 py-2 font-mono text-small break-all select-all">
        {value?.key}
      </output>
      <div className="mt-2 flex">
        <Button icon={<Copy aria-hidden className="size-4" />} onClick={() => void copy()}>
          คัดลอก
        </Button>
      </div>
      <label className="mt-3 flex items-center gap-2 text-small">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="size-4 accent-[var(--color-action)]" />
        ฉันเก็บ key นี้ไว้แล้ว
      </label>
      <div className="mt-4 flex justify-end">
        <Button variant="primary" disabled={!saved} onClick={onClose}>
          ปิด
        </Button>
      </div>
    </Panel>
  );
}
