# sdes-web

หน้าเว็บของ SDES — Smart Document Extraction & ERP Sync Pipeline (Next.js 15, Tailwind 4)

ออกแบบสำหรับจอโน้ตบุ๊ก 1366×768 เป็นหลัก ระบบดีไซน์อยู่ใน [DESIGN.md](DESIGN.md) และ token ใน `src/styles/tokens.css` บริบทผลิตภัณฑ์อยู่ใน [PRODUCT.md](PRODUCT.md)

## สิ่งที่ต้องมี

- Node.js 22 ขึ้นไป และ pnpm 10 (`corepack enable`)
- [sdes-service](../Service/README.md) ที่รันอยู่ (API ที่ `127.0.0.1:3000`)
- Microsoft Edge หรือ Chrome สำหรับ Playwright บนเครื่อง

## รัน dev

```bash
pnpm install
pnpm dev --port 3100
```

เปิด `http://127.0.0.1:3100` แล้วล็อกอินด้วย System Admin จาก `Service/.env` (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`) ระบบจะให้เปลี่ยนรหัสผ่านชั่วคราวก่อน แล้วไปที่หน้า "ผู้ใช้" เพื่อสร้างเจ้าหน้าที่บัญชีและ role อื่น

หน้าเว็บเรียก backend ผ่าน origin เดียวกัน: Next ส่งต่อ `/auth/*` และ `/api/*` ไปที่ API (ตั้งใน `next.config.ts`) เพื่อให้ refresh cookie แบบ `SameSite=Strict` ใช้ได้ ส่วนสถานะ real-time ต่อ socket.io ตรงไปที่ API เพราะ rewrite ของ Next ไม่รองรับ websocket

หน้าตัวอย่างสำหรับนักพัฒนา (มีเฉพาะตอน `pnpm dev`): `/dev/components`, `/dev/tokens`, `/dev/review`

## หน้าหลักของระบบ

| หน้า | ใครใช้ | ทำอะไร |
|---|---|---|
| `/documents` | Clerk, Lead, Exec | อัปโหลด, คิวพร้อมสถานะ real-time, จำนวนจุดที่ต้องแก้, ปุ่ม "ตรวจ" |
| `/documents/[id]` | Clerk, Lead, Exec | หน้าตรวจสองฝั่ง — ดูรายละเอียดด้านล่าง |
| `/approvals` | AP Lead | คิวรออนุมัติพร้อมเหตุผลความเสี่ยง |
| `/admin/users`, `/admin/settings` | System Admin | จัดการผู้ใช้, เกณฑ์ความเสี่ยงและ Tax ID บริษัท |
| `/admin/erp` | System Admin | ตั้งค่าการเชื่อมต่อ ERP (Odoo หรือ webhook), ทดสอบแสดงผลรายข้อ, สวิตช์ส่งอัตโนมัติ (เปิดได้หลังทดสอบผ่าน) |
| `/admin/sync` | System Admin, Exec | ภาพรวมคิวและการส่ง ERP (รีเฟรชทุก 30 วินาที), รายการ `SYNC_FAILED` — Admin เลือกหลายรายการแล้วส่งใหม่ได้, Exec อ่านอย่างเดียว |
| `/audit` | System Admin, Exec | ค้นหา audit trail ตามช่วงเวลา ผู้กระทำ ประเภท และเลขเอกสาร พร้อมค่าก่อน/หลัง และส่งออก CSV (UTF-8 + BOM เปิดใน Excel ได้) |

เมนูแสดงตาม role ใน `src/lib/roles.ts` (สำเนาของ permission matrix ใช้ซ่อนเมนูเท่านั้น — การบังคับสิทธิ์อยู่ที่ API) System Admin ไม่มีสิทธิ์เปิดเอกสาร จึงเห็นเลขเอกสารในหน้าติดตามและ audit แบบไม่มีลิงก์

### หน้าตรวจเอกสาร (`/documents/[id]`)

- **ซ้าย:** ไฟล์ต้นฉบับ โหลดผ่าน `GET /api/documents/:id/file/content` พร้อม token — PDF แสดงด้วย PDF.js (`pdfjs-dist`, worker โหลดแบบ dynamic import เฉพาะหน้านี้) ส่วน JPG/PNG/TIFF แสดงเป็นภาพทีละหน้า (TIFF แปลงเป็น PNG ที่ API)
- **กรอบไฮไลต์:** ใช้พิกัดสัดส่วนของหน้าจาก `field_meta` ถ้า PDF มีชั้นข้อความ จะหาข้อความที่ตรงกับค่าใกล้กรอบของ AI แล้วใช้ตำแหน่งนั้นแทน (`refineBBox` ใน `src/lib/review.ts`)
- **ขวา:** ฟอร์ม 4 หมวด, แถบ "ต้องตรวจ" (คลิกเพื่อไปที่ช่อง, `J`/`K` เมื่อไม่ได้พิมพ์อยู่ หรือ `Alt+J`/`Alt+K` ได้ทุกที่), ผลรวมรายการตรึงไว้ล่างฟอร์ม
- **ผลตรวจสด:** ใช้กฎชุดเดียวกับ server จาก `src/lib/core` (คัดลอกจาก sdes-service — ดูหัวข้อถัดไป) ส่วนกฎที่ต้องใช้ข้อมูลฝั่ง server (Tax ID บริษัท, เลขที่ซ้ำ) ใช้ผลจากการบันทึกล่าสุด
- **บันทึกอัตโนมัติ:** 800 ms หลังพิมพ์ ส่ง `PATCH /api/documents/:id/data` พร้อม `version` ถ้ามีคนแก้ไปก่อน (409) จะแสดงค่าล่าสุดให้แก้ต่อ
- **ยืนยัน:** `Ctrl+Enter` — ถ้ายังมีจุดที่ต้องแก้จะพาไปที่ช่องนั้นแทน ยืนยันแล้วเปิดเอกสารรอตรวจฉบับถัดไปพร้อม toast ที่มีปุ่ม "กลับไปดู"
- **โหมดอนุมัติ** (เอกสาร `PENDING_APPROVAL` + AP Lead): ฟอร์มอ่านอย่างเดียว, เหตุผลความเสี่ยง, ประวัติการแก้ (ค่า AI/ก่อน/หลัง/ผู้แก้), อนุมัติหรือปฏิเสธผ่านกล่องยืนยัน ผู้ที่ยืนยันหรือแก้เอกสารเองจะเห็นเหตุผลว่าอนุมัติไม่ได้
- จอแคบกว่า 1280 px สลับเป็นแท็บ "เอกสาร / ข้อมูล" เริ่มที่ข้อมูล และกดรายการ "ต้องตรวจ" แล้วสลับไปดูตำแหน่งในเอกสาร
- **การส่งเข้า ERP:** เมื่อเอกสารเข้าสู่การส่งแล้ว มีกล่องแสดงเลขอ้างอิง ERP และเวลา, เหตุผลล่าสุดเมื่อ `SYNC_FAILED` และประวัติการส่งทุกครั้ง อัปเดตตาม event real-time ไม่มีปุ่มส่งใหม่ในหน้านี้ (ส่งใหม่ได้เฉพาะ Admin ที่ `/admin/sync`)

## กติกากลางที่คัดลอกจาก sdes-service

`src/lib/core/` (ผลการอ่าน, Tax ID, กฎตรวจยอด, ความเสี่ยง, ความมั่นใจ) สร้างจาก `Service/packages/core/src` พร้อม test ของมัน **ห้ามแก้ในเว็บ** ให้แก้ที่ sdes-service แล้วรัน:

```bash
pnpm sync:core          # คัดลอกใหม่ (ต้องมีโฟลเดอร์ Service อยู่ข้างกัน)
pnpm sync:core --check  # ตรวจว่าสำเนาตรงกับต้นฉบับ — ไม่ตรงจะออกด้วยรหัส 1
```

## Environment

ไม่ต้องตั้งค่าอะไรถ้า API อยู่ที่ `127.0.0.1:3000` ถ้าไม่ใช่ ให้สร้าง `.env.local`:

| ตัวแปร | ค่าเริ่มต้น | ใช้ทำอะไร |
|---|---|---|
| `SDES_API_ORIGIN` | `http://127.0.0.1:3000` | ปลายทางที่ Next ส่งต่อ `/auth/*` และ `/api/*` (ฝั่ง server) |
| `NEXT_PUBLIC_SDES_WS_URL` | `http://127.0.0.1:3000` | ที่อยู่ socket.io ที่ browser ต่อเพื่อรับสถานะเอกสาร |

`NEXT_PUBLIC_*` ถูกฝังตอน build — เปลี่ยนแล้วต้อง build ใหม่

## Security headers

`next.config.ts` ตั้ง Content-Security-Policy และ header ความปลอดภัยให้ทุกหน้า: `connect-src` อนุญาตเฉพาะ origin ตัวเองกับ origin ของ `NEXT_PUBLIC_SDES_WS_URL` (socket.io), `worker-src 'self' blob:` สำหรับ PDF.js, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff` และ `Referrer-Policy` — ถ้าย้าย API ไป origin อื่น ต้องตั้ง `NEXT_PUBLIC_SDES_WS_URL` ตอน build ไม่อย่างนั้น browser จะบล็อกการเชื่อมต่อ real-time CI รัน `pnpm audit:gate` เหมือน sdes-service (รายการยกเว้นใน `security/audit-exceptions.json`)

## ทดสอบ

```bash
pnpm lint
pnpm typecheck
pnpm test            # Vitest: component, API client, การรวมคิวเอกสาร
pnpm test:contrast   # สีทุกคู่ใน token ผ่านเกณฑ์ contrast
pnpm build
pnpm test:e2e        # Playwright กับ API จำลอง — ไม่ต้องเปิด backend
```

- `pnpm test:e2e` เปิด dev server ที่ port 3100 ให้เอง (หรือใช้ตัวที่เปิดอยู่) และใช้ Edge ที่ติดตั้งในเครื่อง ถ้าไม่มี Edge: `npx playwright install chromium` แล้วรันด้วย `PW_CHANNEL=chromium`
- E2E กับ stack จริงทั้งสาย (Admin → Clerk → อัปโหลด → real-time → audit) อยู่ใน `qa/e2e` ของ repo วางแผน (smart-document-extraction-erp-sync)
