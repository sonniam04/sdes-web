// สร้างใบกำกับภาษีตัวอย่าง (HTML → PDF ด้วย Edge headless) และไฟล์พิกัด bbox ที่ตรงกัน
// node scripts/make-sample-invoice.mjs   — ข้อมูลทั้งหมดเป็นตัวอย่าง ไม่ใช่ข้อมูลจริง
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const items = [
  ["กระดาษ A4 80 แกรม", 50, "รีม", 125],
  ["หมึกพิมพ์เลเซอร์ 87A", 6, "กล่อง", 2900],
  ["แฟ้มสันกว้าง 3 นิ้ว", 120, "แฟ้ม", 72],
  ["ค่าขนส่งและติดตั้ง", 1, "งาน", 12710],
  ["ปากกาลูกลื่น สีน้ำเงิน", 20, "กล่อง", 95],
  ["กระดาษโน้ตกาว 3x3 นิ้ว", 40, "แพ็ค", 38],
  ["ซองเอกสารสีน้ำตาล A4", 10, "แพ็ค", 120],
  ["ลวดเย็บกระดาษ เบอร์ 10", 30, "กล่อง", 12],
  ["เครื่องเย็บกระดาษ", 6, "เครื่อง", 185],
  ["เทปใส 1 นิ้ว", 24, "ม้วน", 25],
  ["คลิปดำ 2 นิ้ว", 15, "กล่อง", 48],
  ["สมุดบันทึก A5", 30, "เล่ม", 45],
  ["ถ่านอัลคาไลน์ AA", 12, "แพ็ค", 89],
  ["ปลั๊กพ่วง 4 ช่อง", 3, "ตัว", 590],
];
const cents = (n) => Math.round(n * 100);
const money = (c) => (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });
const subtotal = items.reduce((a, [, q, , p]) => a + cents(q * p), 0);
const vat = Math.round(subtotal * 0.07);

// กล่องข้อความทุกกล่อง: [x, y, w, h] เป็นสัดส่วนของหน้า (0–1)
const boxes = [];
const box = (id, text, x, y, w, h, extra = "") => boxes.push({ id, text, x, y, w, h, extra });
box("vendorName", "บริษัท สยามซัพพลาย จำกัด (ตัวอย่าง)", 0.07, 0.045, 0.5, 0.03, "font-weight:700;font-size:4.6mm");
box(null, "99/9 ถนนตัวอย่าง แขวงตัวอย่าง เขตตัวอย่าง กรุงเทพฯ 10000", 0.07, 0.08, 0.55, 0.02);
box("taxId", "เลขประจำตัวผู้เสียภาษี 0105569012345 สำนักงานใหญ่", 0.07, 0.105, 0.5, 0.02);
box(null, "ใบกำกับภาษี / ใบแจ้งหนี้", 0.62, 0.045, 0.31, 0.03, "font-weight:700;font-size:4.6mm");
box("invoiceNo", "เลขที่ IV2569-00981", 0.62, 0.085, 0.31, 0.02);
box("invoiceDate", "วันที่ 28/10/2569", 0.62, 0.108, 0.31, 0.02);
box(null, "ลูกค้า บริษัท ตัวอย่างการค้า จำกัด สำนักงานใหญ่", 0.07, 0.16, 0.6, 0.02);
box("buyerTaxId", "เลขประจำตัวผู้เสียภาษี 0105560098760", 0.07, 0.183, 0.5, 0.02);
const head = 0.25, rowH = 0.026;
[["ลำดับ", 0.07, 0.06], ["รายการ", 0.14, 0.4], ["จำนวน", 0.55, 0.12], ["ราคา/หน่วย", 0.68, 0.12], ["จำนวนเงิน", 0.81, 0.12]].forEach(
  ([t, x, w]) => box(null, t, x, head, w, 0.022, "font-weight:700"),
);
items.forEach(([desc, q, unit, p], i) => {
  const y = head + 0.03 + i * rowH;
  box(null, String(i + 1), 0.07, y, 0.06, 0.02);
  box(`item${i + 1}.desc`, desc, 0.14, y, 0.4, 0.02);
  box(`item${i + 1}.qty`, `${q} ${unit}`, 0.55, y, 0.12, 0.02);
  box(`item${i + 1}.price`, money(cents(p)), 0.68, y, 0.12, 0.02, "text-align:right");
  box(`item${i + 1}.amount`, money(cents(q * p)), 0.81, y, 0.12, 0.02, "text-align:right");
});
const ty = head + 0.03 + items.length * rowH + 0.03;
box(null, "รวมเงิน", 0.55, ty, 0.2, 0.02);
box("subtotal", money(subtotal), 0.81, ty, 0.12, 0.02, "text-align:right");
box(null, "ภาษีมูลค่าเพิ่ม 7%", 0.55, ty + 0.026, 0.2, 0.02);
box("vatAmount", money(vat), 0.81, ty + 0.026, 0.12, 0.02, "text-align:right");
box(null, "รวมทั้งสิ้น", 0.55, ty + 0.052, 0.2, 0.02, "font-weight:700");
box("grandTotal", money(subtotal + vat), 0.81, ty + 0.052, 0.12, 0.02, "text-align:right;font-weight:700");
box(null, "เอกสารตัวอย่างสำหรับการพัฒนา — ไม่ใช่เอกสารจริง", 0.07, 0.95, 0.6, 0.018, "color:#777;font-size:2.6mm");

const pct = (n) => `${(n * 100).toFixed(3)}%`;
const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><style>
@page{size:A4;margin:0}html,body{margin:0}
.p{position:relative;width:210mm;height:297mm;font-family:Tahoma,sans-serif;font-size:3.2mm;color:#222}
.p span{position:absolute;white-space:nowrap;display:flex;align-items:center}
.p span[style*="text-align:right"]{justify-content:flex-end}
.rule{position:absolute;left:7%;width:86%;border-top:0.3mm solid #999}
</style></head><body><div class="p">
${boxes.map((b) => `<span style="left:${pct(b.x)};top:${pct(b.y)};width:${pct(b.w)};height:${pct(b.h)};${b.extra}">${b.text}</span>`).join("\n")}
<div class="rule" style="top:14.5%"></div><div class="rule" style="top:${pct(head - 0.004)}"></div><div class="rule" style="top:${pct(head + 0.025)}"></div><div class="rule" style="top:${pct(ty - 0.012)}"></div>
</div></body></html>`;

const out = (p) => fileURLToPath(new URL(p, import.meta.url));
writeFileSync(out("../public/samples/invoice-sample.html"), html);
const fields = Object.fromEntries(boxes.filter((b) => b.id).map(({ id, x, y, w, h }) => [id, { x, y, w, h }]));
writeFileSync(
  out("../src/app/dev/review/sample-invoice.json"),
  JSON.stringify({ items: items.map(([desc, qty, unit, price]) => ({ desc, qty, unit, price: price.toFixed(2), amount: (cents(qty * price) / 100).toFixed(2) })), subtotal: (subtotal / 100).toFixed(2), vat: (vat / 100).toFixed(2), grandTotal: ((subtotal + vat) / 100).toFixed(2), boxes: fields }, null, 1),
);
const edge = process.env.EDGE ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
execFileSync(edge, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", `--print-to-pdf=${out("../public/samples/invoice-sample.pdf")}`, pathToFileURL(out("../public/samples/invoice-sample.html")).href], { stdio: "ignore" });
console.log(`subtotal ${money(subtotal)} vat ${money(vat)} total ${money(subtotal + vat)}; ${Object.keys(fields).length} fields`);
