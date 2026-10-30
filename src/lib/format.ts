// การจัดรูปแบบเงินและวันที่ — ทำงานกับ string ทศนิยมเพื่อไม่ให้เกิดความคลาดเคลื่อนของ float

const MINUS = "−"; // เครื่องหมายลบที่เห็นชัดกว่า hyphen

/** "1234.5" → "1,234.50", "-12" → "−12.00" */
export function formatMoney(value: string | number): string {
  const raw = typeof value === "number" ? value.toFixed(2) : value.trim();
  const m = raw.match(/^(-?)(\d*)(?:\.(\d*))?$/);
  if (!m) throw new Error(`จำนวนเงินไม่ถูกต้อง: ${value}`);
  const [, sign, intPart, frac = ""] = m;
  if (frac.length > 2) throw new Error(`ทศนิยมเกิน 2 ตำแหน่ง: ${value}`);
  const int = (intPart.replace(/^0+(?=\d)/, "") || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const isZero = /^0*$/.test(intPart) && /^0*$/.test(frac);
  return `${sign && !isZero ? MINUS : ""}${int}.${frac.padEnd(2, "0")}`;
}

export type AmountParse =
  | { ok: true; value: string }
  | { ok: false; error: "invalid" | "too-many-decimals" };

/** แปลงข้อความที่ผู้ใช้กรอก/วาง ("12,345.60") เป็นทศนิยมมาตรฐาน ("12345.60") */
export function parseAmountInput(input: string): AmountParse {
  const cleaned = input.replace(/[,\s]/g, "").replace(MINUS, "-");
  if (cleaned === "" || cleaned === "-") return { ok: false, error: "invalid" };
  if (!/^-?\d*(\.\d*)?$/.test(cleaned) || cleaned === ".") return { ok: false, error: "invalid" };
  const frac = cleaned.split(".")[1] ?? "";
  if (frac.length > 2) return { ok: false, error: "too-many-decimals" };
  return { ok: true, value: cleaned };
}

const bangkok = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bangkok",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** "2026-10-29" หรือ ISO timestamp → "29/10/2569" (พ.ศ., เขตเวลา Asia/Bangkok) */
export function formatThaiDate(iso: string): string {
  const dateOnly = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return `${d}/${m}/${Number(y) + 543}`;
  }
  const parts = bangkok.formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("day")}/${get("month")}/${Number(get("year")) + 543}`;
}

const bangkokTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** ISO timestamp → "29/10/2569 14:05" (เวลาไทย) */
export function formatDateTime(iso: string): string {
  return `${formatThaiDate(iso)} ${bangkokTime.format(new Date(iso))}`;
}

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** "2026-10" → "ต.ค. 2569" */
export function formatThaiMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return `${THAI_MONTHS[Number(m) - 1]} ${Number(y) + 543}`;
}

/** วินาที → "18 วินาที" / "4 นาที" / "1 ชม. 31 นาที" */
export function formatSeconds(sec: number | null): string {
  if (sec === null) return "—";
  if (sec < 60) return `${Math.round(sec)} วินาที`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} นาที`;
  return `${Math.floor(min / 60)} ชม. ${min % 60} นาที`;
}
