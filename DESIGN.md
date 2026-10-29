---
name: SDES
description: ระบบอ่านเอกสารบัญชีและส่งเข้า ERP — หน้าจอทำงานในโลกของแบบฟอร์มภาษีไทย
colors:
  ink: "#1b2b4b"
  ink-raised: "#33456b"
  ink-muted: "#5a6a88"
  rule: "#b8c6dd"
  rule-soft: "#dce3ee"
  document-canvas: "#cbd5e3"
  form-blue: "#e8eef7"
  surface-sunken: "#f4f7fb"
  paper: "#ffffff"
  on-shell-muted: "#b9c6de"
  stamp-red: "#b42318"
  stamp-red-bg: "#fcecea"
  waiting-amber: "#8a5a00"
  waiting-amber-bg: "#fff4db"
  progress-teal: "#145a73"
  progress-teal-bg: "#e0f0f5"
  success-green: "#1e6b45"
  success-green-bg: "#e2f2e8"
  ended-slate: "#4b5568"
  ended-slate-bg: "#eceef2"
  focus-blue: "#2f6fed"
typography:
  headline:
    fontFamily: "Sarabun, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.6
  title:
    fontFamily: "Sarabun, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.6
  body:
    fontFamily: "Sarabun, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  small:
    fontFamily: "Sarabun, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Sarabun, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.6
  amount:
    fontFamily: "Sarabun, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    fontFeature: "tnum, lnum"
rounded:
  sm: "2px"
  md: "3px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "6px 14px"
  button-primary-hover:
    backgroundColor: "{colors.ink-raised}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "6px 14px"
  button-danger:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.stamp-red}"
    rounded: "{rounded.sm}"
    padding: "6px 14px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "3px 8px"
  shell-bar:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    height: "48px"
  section-number:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
  risk-banner:
    backgroundColor: "{colors.stamp-red-bg}"
    textColor: "{colors.stamp-red}"
    padding: "8px 12px"
---

# Design System: SDES

## Overview

**Creative North Star: "แบบฟอร์มภาษีที่ทำงานได้" (The Working Tax Form)**

SDES เป็นหน้าจอทำงานของฝ่ายบัญชี ไม่ใช่ dashboard โลกของภาพยืมมาจากแบบฟอร์มที่คนบัญชีไทยกรอกทุกเดือน เช่น แบบ ภ.พ.30 และ ภ.ง.ด.53 ข้อมูลแบ่งเป็นหมวดที่มีเลขกำกับ ตัวเลขอยู่ในตำแหน่งตายตัว เส้นแบ่งเป็นสีน้ำเงินหมึกพิมพ์บนกระดาษขาว คนที่ใช้แบบฟอร์มเหล่านี้มาหลายปีจะรู้ว่าต้องมองตรงไหนก่อนที่จะสังเกตว่าหน้าจอ "มีสไตล์"

ความหนาแน่นสูงแต่อ่านง่าย เพราะผู้ใช้หลักทำงานบน notebook จอเดียว (1366×768) ต่อเนื่องทั้งวัน ความสนใจของผู้ใช้ต้องไปที่จุดที่ AI ไม่มั่นใจ แดงตรายางจึงสงวนไว้ให้ความเสี่ยงอย่างเดียว ส่วนที่ระบบมั่นใจแล้วจะเงียบ

ปฏิเสธ: dashboard การ์ดมุมมนแบบ SaaS ทั่วไป, ตัวเลข KPI ใหญ่ ๆ, การลอกแบบฟอร์มราชการตรงตัว (ไม่มีตราครุฑหรือหัวกระดาษราชการ), กระดาษบัญชีเส้นเขียวที่มาแทนตาราง

**Key Characteristics:**
- หมวดมีเลขกำกับแบบเลขกลับสีบนพื้นน้ำเงินหมึก
- Tax ID แสดงในช่องทีละหลัก จัดกลุ่ม 1-4-5-2-1
- ยอดเงินเป็นแถวที่มีเส้นประนำสายตาไปยังตัวเลขชิดขวา ยอดสุดท้ายมีเส้นคู่ใต้
- มุมเกือบฉาก (2–3 px), เส้น 1–1.5 px, ไม่มีเงาบนพื้นที่ทำงาน
- ตัวเลขทุกตัวใช้ความกว้างเท่ากัน

## Colors

ชุดสีเป็นน้ำเงินหมึกพิมพ์บนกระดาษและพื้นฟ้าแบบฟอร์ม มีแดงตรายางเป็นเสียงเดียวที่ดัง

### Primary
- **น้ำเงินหมึกพิมพ์** (#1b2b4b): แถบบน (shell), เส้นแบ่งหมวด, กรอบฟอร์ม, เลขหมวด และปุ่มหลัก ในพื้นที่ทำงานสีนี้บนพื้นทึบหมายถึง "กดได้"
- **น้ำเงินหมึกยกระดับ** (#33456b): hover ของปุ่มหลัก และป้ายจำนวนบนแถบบน

### Secondary
- **แดงตรายาง** (#b42318 บน #fcecea): ความเสี่ยงเท่านั้น ได้แก่ แถบ "ต้องตรวจ", field ที่ confidence ต่ำ, ยอดไม่ตรง, สถานะล้มเหลว และกรอบ bbox บนเอกสาร

### Neutral
- **ฟ้าแบบฟอร์ม** (#e8eef7): พื้นของ shell รอบพื้นที่ทำงาน
- **กระดาษ** (#ffffff): พื้นของฟอร์ม ตาราง และพื้นที่ทำงาน
- **กระดาษร่ม** (#f4f7fb): หัวตาราง หัวหมวด และแถบปุ่มล่าง
- **พื้นโต๊ะเอกสาร** (#cbd5e3): พื้นหลังที่วางภาพเอกสาร PDF
- **หมึกจาง** (#5a6a88): ข้อความรอง, label, หมายเหตุ
- **เส้นดินสอ** (#b8c6dd) / **เส้นจาง** (#dce3ee): กรอบช่องกรอกและเส้นแบ่งแถว

### สีสถานะ (5 กลุ่มความหมาย ข้อความเข้มบนพื้นอ่อน)
- **กำลังดำเนินการ** teal (#145a73 / #e0f0f5): `UPLOADED`, `PROCESSING`, `SYNCING`
- **รอคน** amber (#8a5a00 / #fff4db): `EXTRACTED`, `VERIFIED`, `PENDING_APPROVAL`
- **สำเร็จ** green (#1e6b45 / #e2f2e8): `APPROVED`, `SYNCED`
- **ล้มเหลว** แดงตรายาง (#b42318 / #fcecea): `FAILED`, `SYNC_FAILED`
- **ยุติ** slate (#4b5568 / #eceef2): `REJECTED`

### Named Rules
**The Stamp Rule.** แดงตรายางใช้กับความเสี่ยงและความล้มเหลวเท่านั้น ห้ามใช้ตกแต่ง ห้ามใช้กับปุ่มที่ไม่ได้ทำลายหรือปฏิเสธ
**The Ink Means Action Rule.** ในพื้นที่ทำงาน พื้นทึบสีน้ำเงินหมึกหมายถึงสิ่งที่กดได้ ข้อความน้ำเงินหมึกบนกระดาษคือข้อมูล
**The Never Color Alone Rule.** ทุกสถานะมีข้อความไทยและไอคอนคู่กับสีเสมอ

## Typography

**Body Font:** Sarabun (with system-ui, sans-serif) — self-host ผ่าน `next/font`

**Character:** ฟอนต์มาตรฐานเอกสารราชการไทยที่ฝ่ายบัญชีอ่านทุกวัน ใช้ตระกูลเดียวทั้งระบบ ลำดับชั้นมาจากน้ำหนักและขนาด ไม่ใช่การเปลี่ยนฟอนต์

### Hierarchy
- **Headline** (700, 20px, 1.6): ชื่อหน้า
- **Title** (700, 16px, 1.6): ยอดจ่ายสุทธิ และหัวข้อในกล่องยืนยัน
- **Body** (400, 14px, 1.6): ข้อมูลในตารางและฟอร์ม
- **Small** (400, 13px, 1.6): ข้อมูลรอง, เหตุผลในคิว, breadcrumb
- **Label** (600 สำหรับหัวหมวด / 400 สำหรับ label ของ field, 12px): label, ป้ายสถานะ, หัวตาราง
- **Amount** (600, 14px, `tabular-nums lining-nums`): ยอดเงินทุกตัว ชิดขวา

### Named Rules
**The Line Height Floor Rule.** line-height ของข้อความไทยไม่ต่ำกว่า 1.6 เพื่อไม่ให้สระบนและสระล่างชนกัน
**The Tabular Rule.** ตัวเลขข้อมูลทุกตัว (ยอดเงิน, จำนวน, เลขเอกสาร) ใช้ `.num` หรือ `tabular-nums` เพื่อให้จุดทศนิยมตรงกัน

## Layout

- เป้าหมายหลักคือ notebook 1366×768 และต้องยังดีที่ 1920×1080
- เมนูอยู่ใน**แถบบน** สูง 48 px ไม่ใช้แถบข้าง เพื่อเก็บความกว้างให้ split-view
- หน้าตรวจข้อมูลแบ่ง PDF 55% / ฟอร์ม 45% แต่ละฝั่งเลื่อนแยกกัน แถบปุ่มล่างติดอยู่ตลอด
- ต่ำกว่า 1280 px หน้าตรวจข้อมูลเปลี่ยนเป็นแท็บ "เอกสาร / ข้อมูล"; ต่ำกว่า 768 px ดูสถานะได้อย่างเดียว
- ความสูงแถวตาราง 36–40 px (`--row-height: 38px`) ระยะห่างตามสเกล 4 px (4, 8, 12, 16, 20, 24, 32) ภายในหมวดแน่น ระหว่างหมวดห่าง 12 px

## Elevation & Depth

ระบบแบนเหมือนกระดาษบนโต๊ะ ความลึกมาจากโทนพื้น (ฟ้าแบบฟอร์ม → กระดาษ → กระดาษร่ม) และน้ำหนักเส้น ไม่ใช่เงา มีเงาที่เดียวคือหน้าเอกสาร PDF ที่วางบนพื้นโต๊ะ

### Shadow Vocabulary
- **document-page** (`box-shadow: 0 2px 8px rgba(27,43,75,.18)`): หน้าเอกสารบนพื้นโต๊ะเอกสารเท่านั้น

### Named Rules
**The Paper Rule.** พื้นที่ทำงานไม่มีเงา แยกส่วนด้วยเส้นและโทนพื้น

## Shapes

มุมเกือบฉาก: 2 px สำหรับปุ่มและช่องกรอก, 3 px สำหรับป้ายเล็ก ช่อง Tax ID เป็นมุมฉากต่อกันเหมือนช่องในแบบฟอร์ม เส้นมีสองน้ำหนัก: 1.5 px สีหมึกสำหรับกรอบหมวดและเส้นใต้แท็บ, 1 px สีเส้นดินสอสำหรับช่องกรอกและแถว ยอดสุดท้ายมีเส้นบน 1.5 px และเส้นคู่ล่าง 3 px

## Components

### Buttons
- **Shape:** มุม 2 px, เส้น 1.5 px สีหมึก, ตัวหนา 600
- **Primary:** พื้นน้ำเงินหมึก ข้อความขาว padding 6px 14px มีป้ายคีย์ลัดเล็กด้านในได้ (เช่น `Ctrl+Enter`)
- **Hover / Focus:** primary เปลี่ยนเป็นน้ำเงินหมึกยกระดับ; secondary เปลี่ยนพื้นเป็นฟ้าแบบฟอร์ม; focus เป็นกรอบน้ำเงิน 2 px ห่าง 2 px
- **Secondary:** พื้นกระดาษ ข้อความและเส้นสีหมึก
- **Danger:** พื้นกระดาษ ข้อความและเส้นแดงตรายาง ใช้กับ "ปฏิเสธ" เท่านั้น

### Status tags
- **Style:** สี่เหลี่ยมมุม 2 px เส้น 1 px สีเดียวกับข้อความ บนพื้นอ่อนของกลุ่ม มีไอคอน 13 px นำหน้าและข้อความไทย
- **State:** สีตามกลุ่มความหมาย 5 กลุ่ม (ดู Colors)

### Form sections (signature)
- กรอบ 1.5 px สีหมึก หัวหมวดพื้นกระดาษร่ม มีเลขหมวดกลับสีพื้นหมึกชิดซ้ายเต็มความสูง ด้านขวาของหัวเป็นหมายเหตุสั้น เช่น "อยู่ในทะเบียนผู้ขาย"

### Inputs / Fields
- **Style:** เส้น 1 px สีเส้นดินสอ มุม 2 px พื้นกระดาษ label 12 px สีหมึกจางอยู่เหนือช่อง และ confidence (%) ชิดขวาของ label
- **Focus:** เส้นและกรอบ 2 px สีน้ำเงิน focus พร้อมแสดงกรอบ bbox บนเอกสาร
- **Low confidence:** เส้นแดงตรายางพร้อมเส้นใต้ด้านใน 2 px และ % เป็นสีแดง เมื่อผู้ใช้แก้แล้วเปลี่ยนเป็นสีเขียว

### Tax ID cells (signature)
- 13 ช่อง กว้าง 24 px สูง 30 px เส้นหมึก 1 px ต่อกันเป็นแถว เว้น 10 px ระหว่างกลุ่ม 1-4-5-2-1 ตัวเลขหนา 15 px

### Amount leader rows (signature)
- label ซ้าย → เส้นประจางนำสายตา → ยอดชิดขวาแบบ tabular หนา 600 มีเครื่องหมายถูก/ผิดนำหน้าในสรุปยอดชั้นที่ 1

### Risk banner
- กรอบ 1 px แดงตรายางทั้งสี่ด้านบนพื้นแดงอ่อน หัวข้อ "ต้องตรวจ N จุดก่อนยืนยัน" ตามด้วยรายการที่คลิกแล้วไปยัง field นั้น เมื่อตรวจครบเปลี่ยนเป็นสีเขียว "ตรวจครบทุกจุดแล้ว"

### Navigation
- แถบบนพื้นน้ำเงินหมึก ชื่อระบบตัวหนา เมนูสีหมึกจางบนพื้นเข้ม รายการที่เลือกเป็นสีขาวพร้อมเส้นใต้ขาว 3 px ด้านใน ป้ายจำนวนงานเป็นพื้นหมึกยกระดับ

## Do's and Don'ts

### Do:
- **Do** ใช้หมวดมีเลขกำกับเมื่อฟอร์มมีมากกว่าหนึ่งกลุ่มข้อมูล เพราะเลขหมวดใช้อ้างอิงในแถบความเสี่ยง (เช่น "หมวด 3–4")
- **Do** ให้ทุกยอดเงินชิดขวา, `tabular-nums`, ทศนิยม 2 ตำแหน่ง, มีตัวคั่นหลักพัน
- **Do** บอกขั้นต่อไปเสมอ เช่น "หลังยืนยัน: ส่งเข้า ERP อัตโนมัติ"
- **Do** ระบุว่าข้อมูลเป็นตัวอย่างทุกครั้งที่ใช้ข้อมูลจำลองใน mockup หรือ wireframe

### Don't:
- **Don't** ใช้ตราครุฑ หัวกระดาษราชการ หรือลอกแบบฟอร์มราชการตรงตัว
- **Don't** ตีกรอบช่องทีละหลักกับ field อื่นนอกจาก Tax ID
- **Don't** ใช้แดงตรายางตกแต่ง หรือใช้กับสิ่งที่ไม่ใช่ความเสี่ยง
- **Don't** ใช้เงา การ์ดมุมมน หรือ gradient บนพื้นที่ทำงาน
- **Don't** ใช้เส้นสีหนาเกิน 1 px ที่ขอบซ้ายของแถว รายการ หรือแถบแจ้งเตือน
- **Don't** ใช้ตัวอักษร emoji หรือ unicode แทนไอคอน ไอคอนต้องมาจากชุดเดียวกัน เส้นหนาเท่ากัน
