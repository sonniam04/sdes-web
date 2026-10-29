// ข้อความ UI ภาษาไทยรวมไว้ที่เดียว เพื่อตรวจน้ำเสียงและแก้ได้จุดเดียว
export const th = {
  app: { name: "SDES", tagline: "ระบบอ่านเอกสารบัญชี" },
  common: {
    retry: "ลองใหม่",
    cancel: "ยกเลิก",
    loading: "กำลังโหลด…",
    sampleData: "ข้อมูลตัวอย่าง",
  },
  amount: {
    tooManyDecimals: "ทศนิยมได้ไม่เกิน 2 ตำแหน่ง",
    invalid: "กรอกเป็นตัวเลข เช่น 12,345.60",
  },
  confidence: { high: "สูง", mid: "กลาง", low: "ต่ำ", prefix: "ความมั่นใจ" },
  confirm: {
    reasonLabel: "เหตุผล",
    reasonRequired: "กรอกเหตุผลก่อนยืนยัน",
  },
  upload: {
    dropTitle: "ลากไฟล์มาวาง",
    or: "หรือ",
    choose: "เลือกไฟล์",
    rules: "PDF, TIFF, JPG, PNG · ไม่เกิน 20 MB ต่อไฟล์ · ครั้งละหลายไฟล์ได้",
    tooLarge: "ไฟล์ใหญ่เกิน 20 MB",
    unsupported: "ชนิดไฟล์ไม่รองรับ (รองรับ PDF, TIFF, JPG, PNG)",
    resultsTitle: (accepted: number, total: number) => `อัปโหลดล่าสุด: รับ ${accepted} จาก ${total} ไฟล์`,
  },
} as const;
