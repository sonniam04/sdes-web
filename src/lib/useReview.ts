"use client";

// โหลดเอกสาร + บันทึกอัตโนมัติแบบ debounce พร้อม version (design D9, spec "Editing extracted data")
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, type ApiClient } from "@/lib/api/client";
import { validateDocument, type DocumentData, type ValidationIssue } from "@/lib/core";
import type { DocumentDetail } from "@/lib/review";

export type SaveState = "saved" | "dirty" | "saving" | "conflict" | "error";

export const AUTOSAVE_MS = 800;

/** กฎที่ต้องใช้ข้อมูลฝั่ง server (Tax ID บริษัท, เอกสารอื่น) — ใช้ผลจาก server ส่วนกฎอื่นคำนวณสดในเครื่อง */
const SERVER_ONLY = new Set(["BUYER_MISMATCH", "DUPLICATE_INVOICE", "COMPANY_TAX_ID_NOT_SET", "TAX_ID_INVALID"]);

export function mergeIssues(live: ValidationIssue[], server: ValidationIssue[]): ValidationIssue[] {
  const serverOnly = server.filter((i) => SERVER_ONLY.has(i.code) && !(i.code === "TAX_ID_INVALID" && i.fields[0] === "header.vendorTaxId"));
  const localOnly = live.filter((i) => !SERVER_ONLY.has(i.code) || (i.code === "TAX_ID_INVALID" && i.fields[0] === "header.vendorTaxId"));
  return [...localOnly, ...serverOnly];
}

type PatchResponse = { version: number; data: DocumentData; validationIssues: ValidationIssue[] };

export function useReview(client: ApiClient, id: string) {
  const [doc, setDoc] = useState<DocumentDetail>();
  const [data, setData] = useState<DocumentData>();
  const [serverIssues, setServerIssues] = useState<ValidationIssue[]>([]);
  const [save, setSave] = useState<SaveState>("saved");
  const [error, setError] = useState<string>();
  const version = useRef(0);
  const pending = useRef<Partial<DocumentData>>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inflight = useRef<Promise<void> | null>(null);

  const load = useCallback(async () => {
    setError(undefined);
    try {
      const d = await client.request<DocumentDetail>(`/documents/${id}`);
      version.current = d.version;
      pending.current = {};
      setDoc(d);
      setData(d.data);
      setServerIssues(d.validationIssues);
      setSave("saved");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "โหลดเอกสารไม่สำเร็จ");
    }
  }, [client, id]);

  useEffect(() => {
    void load();
    return () => clearTimeout(timer.current);
  }, [load]);

  const flush = useCallback(async (): Promise<void> => {
    clearTimeout(timer.current);
    if (inflight.current) await inflight.current;
    const changes = pending.current;
    if (!Object.keys(changes).length) return;
    pending.current = {};
    setSave("saving");
    const run = (async () => {
      try {
        const r = await client.request<PatchResponse>(`/documents/${id}/data`, {
          method: "PATCH",
          json: { version: version.current, changes },
        });
        version.current = r.version;
        setServerIssues(r.validationIssues);
        setDoc((d) => (d ? { ...d, version: r.version, validationIssues: r.validationIssues } : d));
        setSave(Object.keys(pending.current).length ? "dirty" : "saved");
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          // มีคนแก้ไปก่อน: แสดงค่าล่าสุด แล้วให้ผู้ใช้แก้ต่อจากค่านั้น
          const latest = (e.body as { latest?: PatchResponse } | undefined)?.latest;
          pending.current = {};
          if (latest) {
            version.current = latest.version;
            setData(latest.data);
            setServerIssues(latest.validationIssues);
          }
          setSave("conflict");
          return;
        }
        // บันทึกไม่สำเร็จ: คืนการแก้กลับเข้าคิวเพื่อลองใหม่
        pending.current = { ...changes, ...pending.current };
        setSave("error");
      }
    })();
    inflight.current = run;
    await run;
    inflight.current = null;
    if (Object.keys(pending.current).length) timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
  }, [client, id]);

  const update = useCallback(
    (changes: Partial<DocumentData>) => {
      setData((d) => (d ? { ...d, ...changes } : d));
      pending.current = { ...pending.current, ...changes };
      setSave("dirty");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
    },
    [flush],
  );

  // ผลตรวจสดระหว่างพิมพ์ (กฎเดียวกับ server) รวมกับผลที่ต้องใช้ข้อมูลฝั่ง server
  const issues = useMemo(() => {
    if (!data || !doc) return serverIssues;
    const live = validateDocument(data, { companyTaxId: null, uploadedAt: doc.history[0]?.at ?? new Date().toISOString() });
    return mergeIssues(live, serverIssues);
  }, [data, doc, serverIssues]);

  return { doc, data, issues, save, error, update, flush, reload: load, version };
}
