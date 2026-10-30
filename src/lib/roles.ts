// สำเนาฝั่ง web ของ permission matrix (spec user-access) ใช้ซ่อน/แสดงเมนูเท่านั้น
// การบังคับสิทธิ์จริงอยู่ที่ sdes-service
export const ROLES = ["AP_CLERK", "AP_LEAD", "FINANCE_EXEC", "SYS_ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export type MenuItem = { href: string; label: string; roles: readonly Role[] };

export const MENU: readonly MenuItem[] = [
  { href: "/documents", label: "คิวเอกสาร", roles: ["AP_CLERK", "AP_LEAD", "FINANCE_EXEC"] },
  { href: "/approvals", label: "รออนุมัติ", roles: ["AP_LEAD"] },
  { href: "/vendors", label: "ผู้ขาย", roles: ["AP_CLERK", "AP_LEAD"] },
  { href: "/reports", label: "รายงาน", roles: ["FINANCE_EXEC"] },
  { href: "/audit", label: "Audit trail", roles: ["FINANCE_EXEC", "SYS_ADMIN"] },
  { href: "/admin/sync", label: "ติดตามการส่ง", roles: ["FINANCE_EXEC", "SYS_ADMIN"] },
  { href: "/admin/users", label: "ผู้ใช้", roles: ["SYS_ADMIN"] },
  { href: "/admin/erp", label: "ERP", roles: ["SYS_ADMIN"] },
  { href: "/admin/settings", label: "ตั้งค่า", roles: ["SYS_ADMIN"] },
];

export const ROLE_LABEL: Record<Role, string> = {
  AP_CLERK: "เจ้าหน้าที่บัญชี",
  AP_LEAD: "หัวหน้าฝ่ายบัญชี",
  FINANCE_EXEC: "ผู้บริหารฝ่ายการเงิน",
  SYS_ADMIN: "ผู้ดูแลระบบ",
};

/** role ที่เปิดหน้าเอกสารได้ (permission document.view) — SYS_ADMIN ไม่มี */
export const canViewDocuments = (roles: readonly Role[]) => roles.some((r) => r !== "SYS_ADMIN");

/** เมนูที่ผู้ใช้เห็น = รวมสิทธิ์ของทุก role ที่มี */
export function menuFor(roles: readonly Role[]): MenuItem[] {
  return MENU.filter((m) => m.roles.some((r) => roles.includes(r)));
}
