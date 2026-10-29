// ตรวจ contrast ของคู่สี semantic ใน src/styles/tokens.css ตาม WCAG 2.2 AA
//   pnpm test:contrast
// ข้อความ ≥ 4.5:1, ข้อความใหญ่/องค์ประกอบที่ไม่ใช่ข้อความ (เส้น, กรอบ focus) ≥ 3:1
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const css = readFileSync(fileURLToPath(new URL("../src/styles/tokens.css", import.meta.url)), "utf8");
const vars = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

function resolve(name, seen = new Set()) {
  if (seen.has(name)) throw new Error(`token วนอ้างตัวเอง: --${name}`);
  seen.add(name);
  const v = vars[name];
  if (v === undefined) throw new Error(`ไม่พบ token --${name}`);
  const ref = v.match(/^var\(--([\w-]+)\)$/);
  return ref ? resolve(ref[1], seen) : v;
}

function luminance(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const ratio = (a, b) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const TEXT = 4.5;
const LARGE = 3;
const statuses = ["progress", "waiting", "success", "failed", "ended"];
const pairs = [
  ["color-text", "color-surface", TEXT],
  ["color-text", "color-canvas", TEXT],
  ["color-text", "color-surface-sunken", TEXT],
  ["color-text-muted", "color-surface", TEXT],
  ["color-text-muted", "color-canvas", TEXT],
  ["color-text-muted", "color-surface-sunken", TEXT],
  ["color-text-on-shell", "color-shell", TEXT],
  ["color-text-on-shell-muted", "color-shell", TEXT],
  ["color-action-text", "color-action", TEXT],
  ["color-action-text", "color-action-hover", TEXT],
  ["color-risk", "color-risk-bg", TEXT],
  ["color-risk", "color-surface", TEXT],
  ...statuses.flatMap((s) => [
    [`color-status-${s}`, `color-status-${s}-bg`, TEXT],
    [`color-status-${s}`, "color-surface", TEXT],
  ]),
  // ไม่ใช่ข้อความ: กรอบ focus, เส้นแบ่งหมวด
  ["color-focus", "color-surface", LARGE],
  ["color-focus", "color-canvas", LARGE],
  ["color-rule-strong", "color-surface", LARGE],
];

let failed = 0;
for (const [fg, bg, min] of pairs) {
  const r = ratio(resolve(fg), resolve(bg));
  const ok = r >= min;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${r.toFixed(2).padStart(5)}:1  (≥ ${min})  --${fg} บน --${bg}`);
}
console.log(failed ? `\n${failed} คู่ไม่ผ่าน` : `\nผ่านทั้งหมด ${pairs.length} คู่`);
process.exitCode = failed ? 1 : 0;
