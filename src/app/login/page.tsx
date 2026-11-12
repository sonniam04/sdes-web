"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ApiError } from "@/lib/api/client";
import { th } from "@/i18n/th";
import { homeFor } from "@/lib/auth/home";

function LoginForm() {
  const { state, client } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (state.status !== "authenticated") return;
    router.replace(state.user.mustChangePassword ? "/change-password" : (next ?? homeFor()));
  }, [state, router, next]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await client.login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่อีกครั้ง");
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 p-5" noValidate>
      <TextField label="อีเมล" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      <TextField label="รหัสผ่าน" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && (
        <p role="alert" className="border border-risk bg-risk-bg px-3 py-2 text-small text-risk">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" loading={busy} disabled={!email || !password} icon={<LogIn aria-hidden className="size-4" />} className="justify-center">
        เข้าสู่ระบบ
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-start justify-center px-4 pt-[12vh]">
      <div className="w-full max-w-sm border-[1.5px] border-rule-strong bg-surface">
        <h1 className="flex items-stretch border-b border-rule-strong bg-surface-sunken text-title font-bold">
          <span className="flex items-center bg-action px-3 text-action-text">{th.app.name}</span>
          <span className="px-3 py-2">เข้าสู่ระบบ</span>
        </h1>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
