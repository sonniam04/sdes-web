import {
  AlertTriangle,
  Ban,
  BadgeCheck,
  CheckCheck,
  ClipboardCheck,
  CloudOff,
  Loader,
  PencilLine,
  Send,
  Upload,
  UserCheck,
  type LucideIcon,
} from "lucide-react";

export const DOCUMENT_STATUSES = [
  "UPLOADED",
  "PROCESSING",
  "FAILED",
  "EXTRACTED",
  "VERIFIED",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "SYNCING",
  "SYNCED",
  "SYNC_FAILED",
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];
export type StatusGroup = "progress" | "waiting" | "success" | "failed" | "ended";

export const STATUS_META: Record<DocumentStatus, { label: string; group: StatusGroup; icon: LucideIcon }> = {
  UPLOADED: { label: "อัปโหลดแล้ว", group: "progress", icon: Upload },
  PROCESSING: { label: "กำลังอ่าน", group: "progress", icon: Loader },
  FAILED: { label: "อ่านไม่สำเร็จ", group: "failed", icon: AlertTriangle },
  EXTRACTED: { label: "รอตรวจ", group: "waiting", icon: PencilLine },
  VERIFIED: { label: "ตรวจแล้ว", group: "waiting", icon: ClipboardCheck },
  PENDING_APPROVAL: { label: "รออนุมัติ", group: "waiting", icon: UserCheck },
  APPROVED: { label: "อนุมัติแล้ว", group: "success", icon: BadgeCheck },
  REJECTED: { label: "ปฏิเสธแล้ว", group: "ended", icon: Ban },
  SYNCING: { label: "กำลังส่ง ERP", group: "progress", icon: Send },
  SYNCED: { label: "ส่ง ERP แล้ว", group: "success", icon: CheckCheck },
  SYNC_FAILED: { label: "ส่ง ERP ไม่สำเร็จ", group: "failed", icon: CloudOff },
};

export type ConfidenceLevel = "high" | "mid" | "low";

/** confidence 0–1: สูง ≥ 95%, กลาง 85–94%, ต่ำ < 85% */
export function confidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.95) return "high";
  if (confidence >= 0.85) return "mid";
  return "low";
}
