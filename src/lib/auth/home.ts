/** หน้าแรกตาม role หลังล็อกอิน */
export function homeFor(roles: readonly string[]) {
  if (roles.some((r) => r === "AP_CLERK" || r === "AP_LEAD" || r === "FINANCE_EXEC")) return "/documents";
  return "/admin/users";
}
