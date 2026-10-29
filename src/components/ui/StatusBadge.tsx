import { STATUS_META, type DocumentStatus, type StatusGroup } from "@/lib/status";

const tone: Record<StatusGroup, string> = {
  progress: "text-status-progress bg-status-progress-bg",
  waiting: "text-status-waiting bg-status-waiting-bg",
  success: "text-status-success bg-status-success-bg",
  failed: "text-status-failed bg-status-failed-bg",
  ended: "text-status-ended bg-status-ended-bg",
};

/** ป้ายสถานะเอกสาร: ข้อความไทย + ไอคอน + สีกลุ่ม (แยกได้แม้ไม่เห็นสี) */
export function StatusBadge({ status }: { status: DocumentStatus }) {
  const { label, group, icon: Icon } = STATUS_META[status];
  return (
    <span
      data-status={status}
      data-group={group}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border border-current py-px pr-2 pl-1.5 text-label font-semibold ${tone[group]}`}
    >
      <Icon aria-hidden className="size-[13px]" strokeWidth={2.25} />
      {label}
    </span>
  );
}
