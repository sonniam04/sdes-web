// ข้อมูลและกติกาของหน้าตรวจเอกสาร (spec document-review) — ฟังก์ชันล้วน ทดสอบได้ตรง
import type { BBox, DocumentData, FieldMeta, RiskFlag, ValidationIssue } from "@/lib/core";
import type { DocumentStatus } from "@/lib/status";

export type EditRecord = {
  field: string;
  aiValue: unknown;
  before: unknown;
  after: unknown;
  by: { id: string | null; name: string | null };
  at: string;
};

export type DocumentDetail = {
  id: string;
  docNo: string;
  status: DocumentStatus;
  version: number;
  fileName: string;
  mimeType: string;
  confidence: string | null;
  data: DocumentData;
  fieldMeta: FieldMeta;
  validationIssues: ValidationIssue[];
  riskFlags: RiskFlag[];
  verifiedById: string | null;
  edits: EditRecord[];
  history: { id: string; from: string | null; to: string; actor: { kind: string; name?: string | null }; reason: string | null; at: string }[];
};

/** ชื่อ field ภาษาไทยที่แสดงในรายการ "ต้องตรวจ" */
export const FIELD_LABELS: Record<string, string> = {
  invoiceNo: "เลขที่เอกสาร",
  invoiceDate: "วันที่เอกสาร",
  vendorName: "ชื่อผู้ขาย",
  vendorTaxId: "เลขประจำตัวผู้เสียภาษีผู้ขาย",
  vendorBranch: "สาขาผู้ขาย",
  buyerTaxId: "เลขประจำตัวผู้เสียภาษีผู้ซื้อ",
  buyerBranch: "สาขาผู้ซื้อ",
  subtotal: "ยอดก่อนภาษี",
  discount: "ส่วนลด",
  vatBase: "ฐานภาษี",
  vatRate: "อัตรา VAT",
  vatAmount: "ภาษีมูลค่าเพิ่ม",
  vatExempt: "ยกเว้น VAT",
  grandTotal: "ยอดรวม",
  whtBase: "ฐานหัก ณ ที่จ่าย",
  whtRate: "อัตราหัก ณ ที่จ่าย",
  whtAmount: "ภาษีหัก ณ ที่จ่าย",
  netPayable: "ยอดจ่ายสุทธิ",
  description: "รายการ",
  quantity: "จำนวน",
  unitPrice: "ราคาต่อหน่วย",
  amount: "จำนวนเงิน",
  vat: "ภาษี",
};

export function fieldLabel(path: string): string {
  const header = /^header\.(\w+)$/.exec(path);
  if (header) return FIELD_LABELS[header[1]!] ?? header[1]!;
  const item = /^items\[(\d+)\](?:\.(\w+))?$/.exec(path);
  if (item) return `รายการที่ ${Number(item[1]) + 1}${item[2] ? ` ${FIELD_LABELS[item[2]] ?? item[2]}` : ""}`;
  return path === "items" ? "รายการสินค้า" : path;
}

/** ค่าปัจจุบันของ field ตาม path */
export function valueAt(d: DocumentData, path: string): string | boolean | null | undefined {
  const header = /^header\.(\w+)$/.exec(path);
  if (header) return d[header[1] as keyof DocumentData] as string | boolean | null;
  const item = /^items\[(\d+)\]\.(\w+)$/.exec(path);
  if (item) return (d.items[Number(item[1])] as unknown as Record<string, string | null | undefined> | undefined)?.[item[2]!];
  return undefined;
}

/** field ที่ค่าปัจจุบันต่างจากค่าที่ AI อ่าน = ถูกแก้ */
export function editedPaths(d: DocumentData, meta: FieldMeta): Set<string> {
  const out = new Set<string>();
  for (const [path, m] of Object.entries(meta)) {
    const v = valueAt(d, path);
    if (v !== undefined && (v ?? null) !== (m.aiValue ?? null)) out.add(path);
  }
  return out;
}

export type CheckItem = {
  key: string;
  /** field ที่จะพาไปเมื่อคลิก */
  path: string;
  message: string;
  kind: "ERROR" | "WARNING" | "LOW_CONFIDENCE";
  /** field ความมั่นใจต่ำที่ผู้ใช้แก้แล้ว */
  done: boolean;
};

/**
 * รายการ "ต้องตรวจ": ผลตรวจที่ไม่ผ่าน (ERROR ก่อน WARNING) ตามด้วย field ความมั่นใจต่ำ
 * field ความมั่นใจต่ำที่แก้แล้วยังอยู่ในรายการแต่ถูกขีดว่าเสร็จ
 */
export function buildCheckList(d: DocumentData, issues: ValidationIssue[], meta: FieldMeta, threshold: number): CheckItem[] {
  const errors = issues.filter((i) => i.severity === "ERROR");
  const warnings = issues.filter((i) => i.severity === "WARNING");
  const toItem = (i: ValidationIssue, n: number): CheckItem => ({
    key: `${i.code}-${n}`,
    path: i.fields[0] ?? "header.invoiceNo",
    message: i.message,
    kind: i.severity,
    done: false,
  });
  const edited = editedPaths(d, meta);
  const covered = new Set(issues.flatMap((i) => i.fields));
  const low = Object.entries(meta)
    .filter(([path, m]) => m.confidence < threshold && m.aiValue !== null && !covered.has(path) && valueAt(d, path) !== undefined)
    .sort(([a], [b]) => fieldOrder(a) - fieldOrder(b))
    .map(([path, m]): CheckItem => ({
      key: `low-${path}`,
      path,
      message: `${fieldLabel(path)}: AI มั่นใจ ${Math.round(m.confidence * 100)}%`,
      kind: "LOW_CONFIDENCE",
      done: edited.has(path),
    }));
  return [...errors.map(toItem), ...warnings.map(toItem), ...low];
}

/** ลำดับ field ตามที่อยู่บนฟอร์ม เพื่อให้ J/K ไล่ตามสายตา */
const ORDER = [
  "invoiceNo", "invoiceDate", "vendorName", "vendorTaxId", "vendorBranch", "buyerTaxId", "buyerBranch",
  "subtotal", "discount", "vatBase", "vatRate", "vatAmount", "vatExempt", "grandTotal", "whtBase", "whtRate", "whtAmount", "netPayable",
];
function fieldOrder(path: string): number {
  const header = /^header\.(\w+)$/.exec(path);
  if (header) {
    const i = ORDER.indexOf(header[1]!);
    // หมวดสรุปยอดอยู่หลังรายการสินค้า
    return i < 7 ? i : 1000 + i;
  }
  const item = /^items\[(\d+)\]/.exec(path);
  return item ? 100 + Number(item[1]) : 999;
}

/** รายการถัดไป/ก่อนหน้าที่ยังไม่เสร็จ (วนรอบ) — คืน -1 เมื่อไม่มี */
export function nextCheck(list: CheckItem[], current: number, dir: 1 | -1): number {
  const open = list.map((c, i) => ({ c, i })).filter(({ c }) => !c.done);
  if (!open.length) return -1;
  if (dir === 1) return (open.find(({ i }) => i > current) ?? open[0]!).i;
  return ([...open].reverse().find(({ i }) => i < current) ?? open[open.length - 1]!).i;
}

/** กรอบในพิกัดสัดส่วน → พิกเซลบนหน้าที่แสดงจริง */
export function toPixels(b: Omit<BBox, "page">, size: { w: number; h: number }) {
  return { left: b.x * size.w, top: b.y * size.h, width: b.w * size.w, height: b.h * size.h };
}

/** ข้อความหนึ่งชิ้นจาก getTextContent ของ PDF.js (พิกัด PDF: จุดกำเนิดมุมล่างซ้าย) */
export type PdfTextItem = { str: string; transform: number[]; width: number; height: number };

const squash = (s: string) => s.replace(/[\s,]/g, "");

/**
 * ปรับกรอบของ AI ให้ตรงกับตำแหน่งข้อความจริงในชั้นข้อความของ PDF (design D3)
 * หาข้อความที่ตรงกับค่า (ไม่สนช่องว่าง/จุลภาค) และอยู่ใกล้กรอบของ AI ที่สุด; ไม่พบคืนกรอบเดิม
 */
export function refineBBox(
  items: PdfTextItem[],
  value: string | null | undefined,
  near: Omit<BBox, "page"> | null,
  page: { width: number; height: number },
): Omit<BBox, "page"> | null {
  if (!value) return near;
  const target = squash(value);
  if (target.length < 2) return near;
  const candidates = items
    .filter((it) => squash(it.str).includes(target))
    .map((it) => {
      const [, , , , x = 0, y = 0] = it.transform;
      const h = it.height || Math.abs(it.transform[3] ?? 0);
      return { x: x / page.width, y: (page.height - y - h) / page.height, w: it.width / page.width, h: h / page.height };
    })
    .filter((b) => b.w > 0 && b.h > 0);
  if (!candidates.length) return near;
  if (!near) return candidates[0]!;
  const cx = near.x + near.w / 2;
  const cy = near.y + near.h / 2;
  const dist = (b: { x: number; y: number; w: number; h: number }) => Math.hypot(b.x + b.w / 2 - cx, b.y + b.h / 2 - cy);
  const best = candidates.reduce((a, b) => (dist(b) < dist(a) ? b : a));
  // ไกลเกินหนึ่งในสี่ของหน้า = น่าจะเป็นค่าซ้ำที่อื่น ใช้กรอบของ AI
  return dist(best) <= 0.25 ? best : near;
}

/** บรรทัดบอกผลหลังยืนยัน (รายการส่งต่อข้อ 3) */
export function afterConfirmText(nextDocNo: string | null): string {
  return nextDocNo ? `หลังยืนยัน: เปิด ${nextDocNo} ต่อทันที` : "หลังยืนยัน: กลับไปคิวเอกสาร";
}
