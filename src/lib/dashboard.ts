// ชนิดข้อมูลและกติกาลิงก์ของหน้าภาพรวม (spec overview-dashboard, design D1/D5)
import { canViewDocuments, type Role } from "./roles";

export type Money = { documentCount: number; subtotal: string; vat: string; wht: string; grandTotal: string };
export type BacklogGroup = "waiting" | "failed" | "reading" | "approval" | "syncFailed";
export type Dashboard = {
  generatedAt: string;
  backlog?: Record<BacklogGroup, { count: number; oldestAt: string | null }>;
  throughput?: { days: { date: string; uploaded: number; verified: number; synced: number }[] };
  indicators?: {
    windowDays: number;
    avgSecondsToExtracted: number | null;
    noEditRate: number | null;
    approvalRate: number | null;
    targets: { seconds: number; noEditRate: number };
  };
  finance?: { month: string; current: Money; previous: Money };
  health?: {
    queues: { extract: number; sync: number };
    connected: boolean;
    autoSync: boolean;
    lastSyncedAt: string | null;
    syncFailed: number;
    errors24h?: number;
    expiringKeys?: { id: string; name: string; expiresAt: string }[];
  };
};

const TAB: Record<BacklogGroup, string> = { waiting: "waiting", reading: "progress", failed: "failed", syncFailed: "failed", approval: "approval" };

/** ลิงก์ของจำนวนงานค้างแต่ละกลุ่ม ตามสิทธิ์ของผู้ใช้ */
export function backlogLink(group: BacklogGroup, roles: readonly Role[]): string {
  if (group === "approval" && roles.includes("AP_LEAD")) return "/approvals";
  if (group === "syncFailed" && !canViewDocuments(roles)) return "/admin/sync";
  return `/documents?tab=${TAB[group]}`;
}
