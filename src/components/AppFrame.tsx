"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { AppShell } from "@/components/ui/AppShell";
import { useAuth } from "@/lib/auth/AuthProvider";
import { RequireAuth } from "@/lib/auth/RequireAuth";
import type { Role } from "@/lib/roles";

/** หน้าที่ต้องล็อกอิน: route guard + แถบเมนูตาม role + ปุ่มออกจากระบบ */
export function AppFrame({ roles, children }: { roles: readonly Role[]; children: ReactNode }) {
  return (
    <RequireAuth roles={roles}>
      <Frame>{children}</Frame>
    </RequireAuth>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const { state, client } = useAuth();
  const path = usePathname();
  const router = useRouter();
  if (state.status !== "authenticated") return null;
  return (
    <AppShell roles={state.user.roles} userName={state.user.displayName} currentPath={path}>
      <div className="flex justify-end border-b border-rule bg-surface px-5 py-1">
        <button
          type="button"
          onClick={async () => {
            await client.logout();
            router.replace("/login");
          }}
          className="inline-flex items-center gap-1.5 text-small text-text-muted hover:text-text"
        >
          <LogOut aria-hidden className="size-4" /> ออกจากระบบ
        </button>
      </div>
      {children}
    </AppShell>
  );
}
