"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type ApiClient, type SessionUser } from "@/lib/api/client";

type AuthState =
  | { status: "loading"; user: null }
  | { status: "anonymous"; user: null }
  | { status: "authenticated"; user: SessionUser };

const AuthContext = createContext<{ state: AuthState; client: ApiClient } | null>(null);

/** เก็บสถานะผู้ใช้ และพยายามคืน session จาก refresh cookie ตอนเปิดหน้า */
export function AuthProvider({ children, client = api }: { children: ReactNode; client?: ApiClient }) {
  const [state, setState] = useState<AuthState>({ status: "loading", user: null });

  useEffect(() => {
    const off = client.onSession((s) => setState(s ? { status: "authenticated", user: s.user } : { status: "anonymous", user: null }));
    if (!client.accessToken) void client.refresh();
    return () => {
      off();
    };
  }, [client]);

  return <AuthContext.Provider value={{ state, client }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth ต้องอยู่ภายใน <AuthProvider>");
  return ctx;
}
