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

## Environment

ไม่ต้องตั้งค่าอะไรถ้า API อยู่ที่ `127.0.0.1:3000` ถ้าไม่ใช่ ให้สร้าง `.env.local`:

| ตัวแปร | ค่าเริ่มต้น | ใช้ทำอะไร |
|---|---|---|
| `SDES_API_ORIGIN` | `http://127.0.0.1:3000` | ปลายทางที่ Next ส่งต่อ `/auth/*` และ `/api/*` (ฝั่ง server) |
| `NEXT_PUBLIC_SDES_WS_URL` | `http://127.0.0.1:3000` | ที่อยู่ socket.io ที่ browser ต่อเพื่อรับสถานะเอกสาร |

`NEXT_PUBLIC_*` ถูกฝังตอน build — เปลี่ยนแล้วต้อง build ใหม่

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
