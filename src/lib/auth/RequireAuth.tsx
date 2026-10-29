"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@/lib/roles";
import { Skeleton } from "@/components/ui/States";
import { useAuth } from "./AuthProvider";

/**
 * Route guard ฝั่งเว็บ (เพื่อ UX เท่านั้น — server บังคับสิทธิ์เสมอ)
 * ยังไม่ล็อกอิน → /login, ต้องเปลี่ยนรหัสชั่วคราว → /change-password, role ไม่ตรง → แจ้งไม่มีสิทธิ์
 */
export function RequireAuth({ roles, children }: { roles: readonly Role[]; children: ReactNode }) {
  const { state } = useAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (state.status === "anonymous") router.replace(`/login?next=${encodeURIComponent(path)}`);
    else if (state.status === "authenticated" && state.user.mustChangePassword) router.replace("/change-password");
  }, [state, router, path]);

  if (state.status !== "authenticated" || state.user.mustChangePassword) {
    return (
      <div className="mx-auto mt-24 max-w-md">
        <Skeleton lines={3} label="กำลังตรวจสอบการเข้าสู่ระบบ…" />
      </div>
    );
  }
  if (!state.user.roles.some((r) => roles.includes(r))) {
    return (
      <div role="alert" className="mx-auto mt-24 max-w-md border border-rule bg-surface p-6">
        <b className="text-title">ไม่มีสิทธิ์เข้าหน้านี้</b>
        <p className="mt-1 text-text-muted">หากต้องใช้งาน กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์</p>
      </div>
    );
  }
  return <>{children}</>;
}
