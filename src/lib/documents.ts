"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { ApiClient } from "@/lib/api/client";
import type { DocumentStatus } from "@/lib/status";

export type DocumentRow = {
  id: string;
  docNo: string;
  status: DocumentStatus;
  fileName: string;
  vendorName: string | null;
  invoiceNo: string | null;
  invoiceDate: string | null;
  grandTotal: string | null;
  /** จำนวนรายการที่ต้องแก้ก่อนยืนยัน (ไม่มีในแถวที่มาจาก event real-time จนกว่าจะโหลดใหม่) */
  issueCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type UploadApiResult =
  | { fileName: string; ok: true; id: string; docNo: string; status: DocumentStatus }
  | { fileName: string; ok: false; code: string; message: string; duplicateOf?: string };

type StatusEvent = { id: string; docNo: string; status: DocumentStatus; at: string };

/** กลุ่มสถานะบนแท็บของหน้าคิว */
export const QUEUE_TABS: { key: string; label: string; statuses: DocumentStatus[] }[] = [
  { key: "waiting", label: "รอตรวจ", statuses: ["EXTRACTED"] },
  { key: "approval", label: "รออนุมัติ", statuses: ["PENDING_APPROVAL"] },
  { key: "progress", label: "กำลังดำเนินการ", statuses: ["UPLOADED", "PROCESSING", "VERIFIED", "APPROVED", "SYNCING"] },
  { key: "failed", label: "ล้มเหลว", statuses: ["FAILED", "SYNC_FAILED"] },
  { key: "done", label: "เสร็จแล้ว", statuses: ["SYNCED", "REJECTED"] },
];

const WS_URL = process.env.NEXT_PUBLIC_SDES_WS_URL ?? "http://127.0.0.1:3000";

export type MergeOptions = {
  /** เพิ่มเฉพาะแถวที่ยังไม่มี — ใช้กับผลอัปโหลด ซึ่งอาจมาถึงหลัง event real-time ของเอกสารเดียวกัน */
  insertOnly?: boolean;
  /** แทนที่เฉพาะเมื่อแถวยังมี updatedAt เท่ากับค่านี้ — ใช้กับการอัปเดตล่วงหน้าหลังสั่งงาน */
  ifUpdatedAt?: string;
};

/**
 * รวมแถวใหม่เข้ากับคิวเดิม โดยไม่ย้อนสถานะกลับไปเป็นค่าที่เก่ากว่า
 * (ผลโหลดหลายรอบอาจกลับมาไม่ตรงลำดับ — updatedAt และ event.at เป็นเวลาของ server ทั้งคู่)
 */
export function mergeRows(prev: DocumentRow[], incoming: DocumentRow[], opts: MergeOptions = {}): DocumentRow[] {
  const map = new Map(prev.map((r) => [r.id, r]));
  for (const r of incoming) {
    const cur = map.get(r.id);
    if (cur && opts.insertOnly) continue;
    if (cur && opts.ifUpdatedAt !== undefined && cur.updatedAt !== opts.ifUpdatedAt) continue;
    if (cur && cur.updatedAt > r.updatedAt) continue;
    map.set(r.id, { ...cur, ...r });
  }
  return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** ใช้ event สถานะกับคิว — คืน null เมื่อยังไม่มีเอกสารนี้ (ต้องโหลดรายละเอียดจาก server) */
export function applyStatusEvent(prev: DocumentRow[], e: StatusEvent): DocumentRow[] | null {
  const cur = prev.find((r) => r.id === e.id);
  if (!cur) return null;
  if (cur.updatedAt > e.at) return prev;
  return prev.map((r) => (r.id === e.id ? { ...r, status: e.status, updatedAt: e.at } : r));
}

/**
 * โหลดคิวเอกสาร + ฟังการเปลี่ยนสถานะแบบ real-time
 * เมื่อการเชื่อมต่อหลุดแล้วกลับมา จะดึงเอกสารที่เปลี่ยนตั้งแต่ครั้งล่าสุดมา resync
 */
export function useDocumentQueue(client: ApiClient) {
  const [rows, setRows] = useState<DocumentRow[] | null>(null);
  const [error, setError] = useState<string>();
  const [live, setLive] = useState<"connecting" | "live" | "offline">("connecting");
  const lastSync = useRef<string | null>(null);

  const merge = useCallback((incoming: DocumentRow[], opts?: MergeOptions) => {
    setRows((prev) => mergeRows(prev ?? [], incoming, opts));
  }, []);

  const load = useCallback(
    async (since?: string | null) => {
      try {
        const q = since ? `?updatedSince=${encodeURIComponent(since)}` : "";
        const r = await client.request<{ items: DocumentRow[]; serverTime: string }>(`/documents${q}`);
        // ผลที่กลับมาไม่ตรงลำดับต้องไม่ทำให้จุด resync ถอยหลัง
        if (!lastSync.current || r.serverTime > lastSync.current) lastSync.current = r.serverTime;
        if (since) merge(r.items);
        else setRows(r.items);
        setError(undefined);
      } catch {
        setError("โหลดคิวเอกสารไม่สำเร็จ");
      }
    },
    [client, merge],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const token = client.accessToken;
    if (!token) return;
    const socket: Socket = io(WS_URL, { path: "/ws", auth: { token }, transports: ["websocket"], reconnectionDelayMax: 5000 });
    let everConnected = false;
    socket.on("ready", () => {
      if (everConnected) void load(lastSync.current); // กลับมาเชื่อมต่อ → resync
      everConnected = true;
      setLive("live");
    });
    socket.on("disconnect", () => setLive("offline"));
    socket.on("connect_error", () => setLive("offline"));
    socket.on("document.status", (e: StatusEvent) => {
      setRows((prev) => {
        if (!prev) return prev;
        const next = applyStatusEvent(prev, e);
        if (next) return next;
        void load(lastSync.current); // เอกสารที่ยังไม่อยู่ในคิว (อัปโหลดจากที่อื่น หรือ response อัปโหลดยังมาไม่ถึง)
        return prev;
      });
    });
    return () => {
      socket.disconnect();
    };
  }, [client, client.accessToken, load]);

  return { rows, error, live, reload: () => load(), merge };
}
