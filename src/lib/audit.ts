// ตัวช่วยของหน้า Audit trail (spec audit-trail "Audit trail viewer")
import { STATUS_META, type DocumentStatus } from "./status";

export type AuditEvent = {
  id: string;
  occurredAt: string;
  actorType: "USER" | "SYSTEM";
  actorUserId: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  ip: string | null;
  details: unknown;
};

export type AuditFilters = { from?: string; to?: string; actorUserId?: string; action?: string; docNo?: string };

const ACTION_LABEL: Record<string, string> = {
  "auth.login": "เข้าสู่ระบบ",
  "auth.login_failed": "เข้าสู่ระบบไม่สำเร็จ",
  "auth.login_blocked": "เข้าสู่ระบบขณะบัญชีถูกล็อก",
  "auth.login_inactive": "เข้าสู่ระบบด้วยบัญชีที่ปิดใช้งาน",
  "auth.locked": "บัญชีถูกล็อก",
  "auth.logout": "ออกจากระบบ",
  "auth.refresh_reuse_detected": "พบการใช้ refresh token ซ้ำ",
  "user.created": "สร้างผู้ใช้",
  "user.seeded": "สร้างผู้ใช้เริ่มต้น",
  "user.roles_changed": "เปลี่ยน role ผู้ใช้",
  "user.activated": "เปิดใช้งานผู้ใช้",
  "user.deactivated": "ปิดใช้งานผู้ใช้",
  "user.password_changed": "เปลี่ยนรหัสผ่าน",
  "user.password_reset": "รีเซ็ตรหัสผ่าน",
  "document.uploaded": "อัปโหลดเอกสาร",
  "document.upload_rejected": "ปฏิเสธไฟล์ที่อัปโหลด",
  "document.file_viewed": "เปิดดูไฟล์เอกสาร",
  "document.field_edited": "แก้ข้อมูลเอกสาร",
  "document.status_changed": "เปลี่ยนสถานะเอกสาร",
  "document.risk_assessed": "ประเมินความเสี่ยง",
  "settings.seeded": "ตั้งค่าเริ่มต้น",
  "settings.updated": "แก้การตั้งค่า",
  "erp.connection_updated": "แก้การเชื่อมต่อ ERP",
  "erp.secret_changed": "เปลี่ยน secret ของการเชื่อมต่อ ERP",
  "erp.connection_tested": "ทดสอบการเชื่อมต่อ ERP",
  "erp.auto_sync_changed": "เปิด/ปิดการส่งอัตโนมัติ",
  "audit.exported": "ส่งออก audit trail",
};

export const actionLabel = (action: string) => ACTION_LABEL[action] ?? action;

/** ตัวกรองของฟอร์ม → query string ของ API; วันที่เป็นวันเต็มตามเวลาไทย */
export function auditQuery(f: AuditFilters, before?: string): URLSearchParams {
  const q = new URLSearchParams();
  if (f.from) q.set("from", `${f.from}T00:00:00+07:00`);
  if (f.to) q.set("to", `${f.to}T23:59:59.999+07:00`);
  if (f.actorUserId) q.set("actorUserId", f.actorUserId);
  if (f.action) q.set("action", f.action);
  const docNo = f.docNo?.trim().toUpperCase();
  if (docNo) q.set("docNo", docNo);
  if (before) q.set("before", before);
  return q;
}

const show = (v: unknown, field: string) => {
  if (v === null || v === undefined || v === "") return "—";
  if (field === "status" && typeof v === "string" && v in STATUS_META) return STATUS_META[v as DocumentStatus].label;
  return typeof v === "string" ? v : JSON.stringify(v);
};

/** ค่าก่อน/หลังจาก details ของ event (รูปแบบ { field, before, after }) — null ถ้าไม่ใช่การเปลี่ยนค่า */
export function changeOf(details: unknown): { field: string; before: string; after: string } | null {
  if (!details || typeof details !== "object") return null;
  const d = details as Record<string, unknown>;
  if (typeof d.field !== "string" || !("before" in d || "after" in d)) return null;
  return { field: d.field, before: show(d.before, d.field), after: show(d.after, d.field) };
}
