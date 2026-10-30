// ทะเบียนผู้ขาย (spec vendor-directory)
import type { DocumentStatus } from "@/lib/status";

export type Vendor = {
  id: string;
  name: string;
  taxId: string;
  branchCode: string;
  erpPartnerId: string | null;
  documentCount: number;
  totalAmount: string;
  lastInvoiceDate: string | null;
  isNew: boolean;
};

export type VendorDocument = { id: string; docNo: string; invoiceNo: string | null; invoiceDate: string | null; grandTotal: string | null; status: DocumentStatus };

/** สาขา 00000 = สำนักงานใหญ่ */
export const branchLabel = (code: string) => (code === "00000" ? "สำนักงานใหญ่" : `สาขา ${code}`);
