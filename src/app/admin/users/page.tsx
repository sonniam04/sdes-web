"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { KeyRound, UserPlus } from "lucide-react";
import { AppFrame } from "@/components/AppFrame";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ROLE_LABEL, ROLES, type Role } from "@/lib/roles";

type AdminUser = { id: string; email: string; displayName: string; roles: Role[]; isActive: boolean; mustChangePassword: boolean };

export default function AdminUsersPage() {
  return (
    <AppFrame roles={["SYS_ADMIN"]}>
      <Users />
    </AppFrame>
  );
}

function RoleChecks({ value, onChange, idPrefix }: { value: Role[]; onChange: (r: Role[]) => void; idPrefix: string }) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-label text-text-muted">Role (เลือกได้หลาย role)</legend>
      {ROLES.map((r) => (
        <label key={r} htmlFor={`${idPrefix}-${r}`} className="flex items-center gap-2">
          <input
            id={`${idPrefix}-${r}`}
            type="checkbox"
            checked={value.includes(r)}
            onChange={(e) => onChange(e.target.checked ? [...value, r] : value.filter((x) => x !== r))}
            className="size-4 accent-[var(--color-action)]"
          />
          {ROLE_LABEL[r]} <span className="text-label text-text-muted">{r}</span>
        </label>
      ))}
      {value.length === 0 && <span className="text-label text-risk">ต้องเลือกอย่างน้อยหนึ่ง role</span>}
    </fieldset>
  );
}

function Panel({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: React.ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgb(27_43_75/0.35)]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-50 w-[min(460px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 border-[1.5px] border-rule-strong bg-surface font-sans text-text"
        >
          <Dialog.Title className="border-b border-rule-strong bg-surface-sunken px-4 py-2 text-title font-bold">{title}</Dialog.Title>
          <div className="p-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Users() {
  const { client, state } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [toggling, setToggling] = useState<AdminUser | null>(null);
  const [resetting, setResetting] = useState<AdminUser | null>(null);
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setUsers(await client.request<AdminUser[]>("/admin/users"));
      setError(undefined);
    } catch {
      setError("โหลดรายชื่อผู้ใช้ไม่สำเร็จ");
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const fail = (e: unknown, fallback: string) => toast(e instanceof ApiError ? e.message : fallback, "error");
  const me = state.status === "authenticated" ? state.user.id : "";

  return (
    <main className="mx-auto flex max-w-[1200px] flex-col gap-3 px-5 py-4">
      <div className="flex items-center gap-3">
        <h1 className="mr-auto text-heading font-bold">ผู้ใช้</h1>
        <Button variant="primary" icon={<UserPlus aria-hidden className="size-4" />} onClick={() => setCreating(true)}>
          เพิ่มผู้ใช้
        </Button>
      </div>

      <section className="border-[1.5px] border-rule-strong bg-surface">
        {error ? (
          <div className="p-4">
            <ErrorState title={error} onRetry={load} />
          </div>
        ) : users === null ? (
          <Skeleton lines={5} label="กำลังโหลดรายชื่อผู้ใช้…" />
        ) : users.length === 0 ? (
          <EmptyState title="ยังไม่มีผู้ใช้" />
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["ชื่อ", "อีเมล", "Role", "สถานะ", ""].map((h, i) => (
                  <th key={i} scope="col" className="border-b border-rule bg-surface-sunken px-2.5 py-1.5 text-left text-label font-semibold text-text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} data-user={u.email} className="h-[var(--row-height)] border-b border-rule-soft">
                  <td className="px-2.5 font-semibold">
                    {u.displayName}
                    {u.id === me && <span className="ml-1.5 text-label font-normal text-text-muted">(คุณ)</span>}
                  </td>
                  <td className="px-2.5">{u.email}</td>
                  <td className="px-2.5 text-small">{u.roles.map((r) => ROLE_LABEL[r]).join(", ")}</td>
                  <td className="px-2.5 text-small">
                    {u.isActive ? (u.mustChangePassword ? "รอเปลี่ยนรหัสผ่าน" : "ใช้งาน") : <span className="text-status-ended">ปิดใช้งาน</span>}
                  </td>
                  <td className="flex justify-end gap-1.5 px-2.5 py-1">
                    <Button className="!py-0.5" onClick={() => setEditing(u)}>เปลี่ยน role</Button>
                    <Button className="!py-0.5" icon={<KeyRound aria-hidden className="size-4" />} onClick={() => setResetting(u)}>
                      รีเซ็ตรหัสผ่าน
                    </Button>
                    <Button className="!py-0.5" variant={u.isActive ? "danger" : "secondary"} onClick={() => setToggling(u)}>
                      {u.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <CreateUser
        open={creating}
        onOpenChange={setCreating}
        onCreated={(email, password) => {
          setCreating(false);
          setSecret({ email, password });
          void load();
        }}
        onError={(e) => fail(e, "สร้างผู้ใช้ไม่สำเร็จ")}
      />

      {editing && (
        <EditRoles
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            toast("บันทึก role แล้ว", "success");
            void load();
          }}
          onError={(e) => fail(e, "บันทึก role ไม่สำเร็จ")}
        />
      )}

      <ConfirmDialog
        open={!!toggling}
        onOpenChange={(o) => !o && setToggling(null)}
        title={toggling?.isActive ? `ปิดใช้งาน ${toggling?.displayName}` : `เปิดใช้งาน ${toggling?.displayName ?? ""}`}
        summary={
          <p>
            {toggling?.isActive
              ? "ผู้ใช้นี้จะเข้าสู่ระบบไม่ได้ และ session ที่เปิดอยู่จะหมดอายุภายใน 15 นาที ประวัติการทำงานยังอยู่ครบ"
              : "ผู้ใช้นี้จะกลับมาเข้าสู่ระบบได้ด้วยรหัสผ่านเดิม"}
          </p>
        }
        confirmLabel={toggling?.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
        tone={toggling?.isActive ? "danger" : "primary"}
        onConfirm={async () => {
          const u = toggling!;
          setToggling(null);
          try {
            await client.request(`/admin/users/${u.id}/${u.isActive ? "deactivate" : "activate"}`, { method: "POST" });
            toast(u.isActive ? "ปิดใช้งานแล้ว" : "เปิดใช้งานแล้ว", "success");
            void load();
          } catch (e) {
            fail(e, "เปลี่ยนสถานะผู้ใช้ไม่สำเร็จ");
          }
        }}
      />

      <ConfirmDialog
        open={!!resetting}
        onOpenChange={(o) => !o && setResetting(null)}
        title={`รีเซ็ตรหัสผ่าน ${resetting?.displayName ?? ""}`}
        summary={<p>ระบบจะสร้างรหัสผ่านชั่วคราวใหม่ ผู้ใช้ต้องเปลี่ยนรหัสผ่านตอนเข้าสู่ระบบครั้งถัดไป และ session เดิมจะถูกยกเลิก</p>}
        confirmLabel="รีเซ็ตรหัสผ่าน"
        onConfirm={async () => {
          const u = resetting!;
          setResetting(null);
          try {
            const r = await client.request<{ temporaryPassword: string }>(`/admin/users/${u.id}/reset-password`, { method: "POST" });
            setSecret({ email: u.email, password: r.temporaryPassword });
            void load();
          } catch (e) {
            fail(e, "รีเซ็ตรหัสผ่านไม่สำเร็จ");
          }
        }}
      />

      <Panel open={!!secret} onOpenChange={(o) => !o && setSecret(null)} title="รหัสผ่านชั่วคราว">
        <p className="text-small">
          ส่งรหัสนี้ให้ <b>{secret?.email}</b> ทางช่องทางที่ปลอดภัย ระบบจะแสดงรหัสนี้ครั้งเดียวเท่านั้น
        </p>
        <output data-testid="temp-password" className="num mt-3 block border border-rule-strong bg-surface-sunken px-3 py-2 text-left text-title font-bold select-all">
          {secret?.password}
        </output>
        <div className="mt-4 flex justify-end">
          <Button variant="primary" onClick={() => setSecret(null)}>
            ปิด
          </Button>
        </div>
      </Panel>
    </main>
  );

}

function CreateUser({
  open,
  onOpenChange,
  onCreated,
  onError,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (email: string, password: string) => void;
  onError: (e: unknown) => void;
}) {
  const { client } = useAuth();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [roles, setRoles] = useState<Role[]>(["AP_CLERK"]);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await client.request<{ user: AdminUser; temporaryPassword: string }>("/admin/users", { method: "POST", json: { email, displayName, roles } });
      onCreated(r.user.email, r.temporaryPassword);
      setEmail("");
      setDisplayName("");
      setRoles(["AP_CLERK"]);
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel open={open} onOpenChange={onOpenChange} title="เพิ่มผู้ใช้">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <TextField label="อีเมล" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        <TextField label="ชื่อที่แสดง" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <RoleChecks value={roles} onChange={setRoles} idPrefix="new" />
        <div className="flex justify-end gap-2">
          <Button onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button type="submit" variant="primary" loading={busy} disabled={!email || !displayName || roles.length === 0}>
            สร้างผู้ใช้
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function EditRoles({ user, onClose, onSaved, onError }: { user: AdminUser; onClose: () => void; onSaved: () => void; onError: (e: unknown) => void }) {
  const { client } = useAuth();
  const [roles, setRoles] = useState<Role[]>(user.roles);
  const [busy, setBusy] = useState(false);
  return (
    <Panel open onOpenChange={(o) => !o && onClose()} title={`เปลี่ยน role: ${user.displayName}`}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await client.request(`/admin/users/${user.id}/roles`, { method: "PATCH", json: { roles } });
            onSaved();
          } catch (err) {
            onError(err);
          } finally {
            setBusy(false);
          }
        }}
        className="flex flex-col gap-3"
      >
        <RoleChecks value={roles} onChange={setRoles} idPrefix={`edit-${user.id}`} />
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>ยกเลิก</Button>
          <Button type="submit" variant="primary" loading={busy} disabled={roles.length === 0}>
            บันทึก
          </Button>
        </div>
      </form>
    </Panel>
  );
}
