import type { ReactNode } from "react";
import { menuFor, ROLE_LABEL, type Role } from "@/lib/roles";
import { th } from "@/i18n/th";

export function AppShell({
  roles,
  userName,
  currentPath,
  counts = {},
  fullHeight = true,
  children,
}: {
  roles: readonly Role[];
  userName: string;
  currentPath: string;
  /** จำนวนงานค้างต่อเมนู เช่น { "/approvals": 9 } */
  counts?: Record<string, number>;
  /** false เมื่อฝังเป็นตัวอย่างในหน้าอื่น */
  fullHeight?: boolean;
  children: ReactNode;
}) {
  const items = menuFor(roles);
  return (
    <div className={`flex flex-col ${fullHeight ? "min-h-screen" : ""}`}>
      <nav aria-label="เมนูหลัก" className="flex h-12 items-center gap-1 bg-shell px-5 text-text-on-shell">
        <span className="mr-5 text-[17px] font-bold tracking-[0.06em]">{th.app.name}</span>
        {items.map((m) => {
          const active = currentPath === m.href || currentPath.startsWith(`${m.href}/`);
          return (
            <a
              key={m.href}
              href={m.href}
              aria-current={active ? "page" : undefined}
              className={`flex h-12 items-center gap-1.5 px-3 ${active ? "text-text-on-shell shadow-[inset_0_-3px_0_var(--color-text-on-shell)]" : "text-text-on-shell-muted hover:text-text-on-shell"}`}
            >
              {m.label}
              {counts[m.href] ? (
                <span className="num rounded-md bg-shell-raised px-1.5 text-label text-text-on-shell">
                  {counts[m.href]}
                </span>
              ) : null}
            </a>
          );
        })}
        <span className="ml-auto text-small text-text-on-shell-muted">
          {userName} · {roles.map((r) => ROLE_LABEL[r]).join(", ")}
        </span>
      </nav>
      <div className="flex-1">{children}</div>
    </div>
  );
}
