// คัดลอกกติกากลาง (ผลการอ่าน, Tax ID, กฎตรวจ, ความเสี่ยง, ความมั่นใจ) และ test ของมันจาก sdes-service
// ใช้: node scripts/sync-core.mjs [--check] [--from ../Service/packages/core/src]
// --check ไม่เขียนไฟล์ แต่ออกด้วยรหัส 1 เมื่อสำเนาในเว็บไม่ตรงกับต้นฉบับ
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MODULES = ["extraction", "taxid", "validation", "risk", "confidence"];
const HEADER = "// สร้างอัตโนมัติจาก sdes-service packages/core ด้วย `pnpm sync:core` — ห้ามแก้ที่นี่\n";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const check = args.includes("--check");
const fromArg = args.indexOf("--from");
const from = resolve(root, fromArg >= 0 ? args[fromArg + 1] : "../Service/packages/core/src");
const to = join(root, "src/lib/core");

if (!existsSync(from)) {
  console.error(`ไม่พบต้นฉบับที่ ${from} (ต้อง clone sdes-service ไว้ข้างกันเป็นโฟลเดอร์ Service)`);
  process.exit(2);
}

// import แบบ NodeNext (./x.js) → แบบ bundler (./x)
// ต้นฉบับอาจเป็น CRLF หลัง git checkout บน Windows — ใช้ LF เสมอ
const transform = (src) => HEADER + src.replace(/\r\n/g, "\n").replace(/from "\.\/([\w-]+)\.js"/g, 'from "./$1"');

const files = new Map();
for (const m of MODULES) {
  for (const name of [`${m}.ts`, `${m}.test.ts`]) {
    const p = join(from, name);
    if (existsSync(p)) files.set(name, transform(readFileSync(p, "utf8")));
  }
}
files.set("index.ts", HEADER + MODULES.map((m) => `export * from "./${m}";`).join("\n") + "\n");

let drift = 0;
mkdirSync(to, { recursive: true });
for (const [name, content] of files) {
  const dest = join(to, name);
  const current = existsSync(dest) ? readFileSync(dest, "utf8").replace(/\r\n/g, "\n") : null;
  if (current === content) continue;
  drift++;
  if (check) console.error(`ไม่ตรงกับต้นฉบับ: src/lib/core/${name}`);
  else writeFileSync(dest, content);
}
for (const name of readdirSync(to)) {
  if (!files.has(name)) {
    drift++;
    console.error(`ไฟล์เกินที่ไม่มีในต้นฉบับ: src/lib/core/${name}`);
  }
}

if (check && drift) process.exit(1);
console.log(check ? "src/lib/core ตรงกับต้นฉบับ" : `ซิงก์ src/lib/core แล้ว (${drift} ไฟล์เปลี่ยน)`);
