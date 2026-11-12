/** ป้าย "ผู้ขายรายใหม่" — เงื่อนไขเดียวกับเหตุผลความเสี่ยง NEW_VENDOR (spec vendor-directory) */
export function NewVendorBadge() {
  return (
    <span data-testid="new-vendor" className="inline-block border border-status-waiting bg-status-waiting-bg px-1.5 text-label font-semibold text-status-waiting">
      ผู้ขายรายใหม่
    </span>
  );
}
