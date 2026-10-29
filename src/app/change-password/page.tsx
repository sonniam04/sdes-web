"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ApiError } from "@/lib/api/client";
import { homeFor } from "@/lib/auth/home";

const MIN = 12;

export default function ChangePasswordPage() {
  const { state, client } = useAuth();
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (state.status === "anonymous") router.replace("/login");
  }, [state, router]);

  const tooShort = next.length > 0 && next.length < MIN;
  const mismatch = confirm.length > 0 && confirm !== next;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (tooShort || mismatch || !current) return;
    setBusy(true);
    setError(undefined);
    try {
      const s = await client.changePassword(current, next);
      router.replace(s ? homeFor(s.user.roles) : "/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  const forced = state.status === "authenticated" && state.user.mustChangePassword;

  return (
    <main className="flex min-h-screen items-start justify-center px-4 pt-[12vh]">
      <div className="w-full max-w-sm border-[1.5px] border-rule-strong bg-surface">
        <h1 className="border-b border-rule-strong bg-surface-sunken px-4 py-2 text-title font-bold">เปลี่ยนรหัสผ่าน</h1>
        <form onSubmit={submit} className="flex flex-col gap-3 p-5" noValidate>
          {forced && <p className="text-small text-text-muted">รหัสผ่านนี้เป็นรหัสชั่วคราว กรุณาตั้งรหัสผ่านใหม่ก่อนเริ่มใช้งาน</p>}
          <TextField label="รหัสผ่านปัจจุบัน" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus />
          <TextField
            label="รหัสผ่านใหม่"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            hint={`อย่างน้อย ${MIN} ตัวอักษร`}
            error={tooShort ? `รหัสผ่านใหม่ต้องยาวอย่างน้อย ${MIN} ตัวอักษร` : undefined}
          />
          <TextField
            label="ยืนยันรหัสผ่านใหม่"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={mismatch ? "รหัสผ่านทั้งสองช่องไม่ตรงกัน" : undefined}
          />
          {error && (
            <p role="alert" className="border border-risk bg-risk-bg px-3 py-2 text-small text-risk">
              {error}
            </p>
          )}
          <Button
            type="submit"
            variant="primary"
            loading={busy}
            disabled={!current || next.length < MIN || confirm !== next}
            icon={<KeyRound aria-hidden className="size-4" />}
            className="justify-center"
          >
            บันทึกรหัสผ่านใหม่
          </Button>
        </form>
      </div>
    </main>
  );
}
