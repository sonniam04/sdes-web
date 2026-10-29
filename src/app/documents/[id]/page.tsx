"use client";

// หน้าตรวจเอกสารแบบสองฝั่ง (spec document-review, design D9)
// โหมดแก้ไข = EXTRACTED + Clerk/Lead, โหมดอนุมัติ = PENDING_APPROVAL + AP Lead, นอกนั้นอ่านอย่างเดียว
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { CheckBar } from "@/components/review/CheckBar";
import { DocumentPane } from "@/components/review/DocumentPane";
import { ApprovalPanel, EditHistory, RiskReasons } from "@/components/review/ApprovalPanel";
import { ReviewForm } from "@/components/review/ReviewForm";
import { Button } from "@/components/ui/Button";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { SplitView, type Pane } from "@/components/ui/SplitView";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { DEFAULT_RISK_THRESHOLDS, type RiskFlag } from "@/lib/core";
import { afterConfirmText, buildCheckList, editedPaths, fieldLabel, nextCheck, valueAt } from "@/lib/review";
import { useReview, type SaveState } from "@/lib/useReview";

const SAVE_TEXT: Record<SaveState, string> = {
  saved: "บันทึกแล้ว",
  dirty: "ยังไม่บันทึก",
  saving: "กำลังบันทึก…",
  conflict: "มีคนแก้เอกสารนี้ไปก่อน — แสดงค่าล่าสุดแล้ว แก้ต่อจากค่านี้ได้",
  error: "บันทึกไม่สำเร็จ จะลองใหม่อัตโนมัติ",
};

export default function ReviewPage() {
  return (
    <AppFrame roles={["AP_CLERK", "AP_LEAD", "FINANCE_EXEC"]}>
      <Review />
    </AppFrame>
  );
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

function Review() {
  const { id } = useParams<{ id: string }>();
  const { state, client } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const r = useReview(client, id);
  const [active, setActive] = useState<string>();
  const [current, setCurrent] = useState(-1);
  const [pane, setPane] = useState<Pane>("form");
  const [next, setNext] = useState<{ id: string; docNo: string } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const me = state.status === "authenticated" ? state.user : null;
  const roles = me?.roles ?? [];
  const canEdit = roles.includes("AP_CLERK") || roles.includes("AP_LEAD");
  const canApprove = roles.includes("AP_LEAD");
  const doc = r.doc;
  const mode = !doc ? "read" : doc.status === "EXTRACTED" && canEdit ? "edit" : doc.status === "PENDING_APPROVAL" && canApprove ? "approve" : "read";

  const edited = useMemo(() => (r.data && doc ? editedPaths(r.data, doc.fieldMeta) : new Set<string>()), [r.data, doc]);
  const checks = useMemo(
    () => (r.data && doc ? buildCheckList(r.data, r.issues, doc.fieldMeta, DEFAULT_RISK_THRESHOLDS.confidence) : []),
    [r.data, r.issues, doc],
  );

  // เอกสารรอตรวจฉบับถัดไป (เก่าสุดก่อน) สำหรับบรรทัด "หลังยืนยัน" และการเปิดต่อ
  useEffect(() => {
    if (mode !== "edit") return;
    client
      .request<{ items: { id: string; docNo: string }[] }>("/documents?status=EXTRACTED&limit=200")
      .then((q) => setNext([...q.items].reverse().find((d) => d.id !== id) ?? null))
      .catch(() => setNext(null));
  }, [client, id, mode]);

  const focusPath = useCallback((path: string) => {
    setActive(path);
    const el = document.querySelector<HTMLElement>(`[data-field="${CSS.escape(path)}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    (el?.matches("input") ? el : el?.querySelector<HTMLElement>("input,button"))?.focus({ preventScroll: true });
  }, []);

  const pick = useCallback(
    (i: number) => {
      const c = checks[i];
      if (!c) return;
      setCurrent(i);
      focusPath(c.path);
      // จอแคบ: สลับไปแท็บเอกสารให้เห็นตำแหน่ง (รายการส่งต่อข้อ 7)
      if (window.matchMedia("(max-width: 1279px)").matches) setPane("doc");
    },
    [checks, focusPath],
  );

  const confirm = useCallback(async () => {
    if (!doc || mode !== "edit" || verifying) return;
    const firstError = checks.findIndex((c) => c.kind === "ERROR");
    if (firstError >= 0) {
      pick(firstError);
      toast("ยังมีรายการที่ต้องแก้ก่อนยืนยัน", "error");
      return;
    }
    setVerifying(true);
    try {
      await r.flush();
      const res = await client.request<{ docNo: string; status: string; riskFlags: RiskFlag[]; next: { id: string; docNo: string } | null }>(
        `/documents/${id}/verify`,
        { method: "POST", json: { version: r.version.current } },
      );
      const where = res.status === "PENDING_APPROVAL" ? " ส่งให้หัวหน้าอนุมัติแล้ว" : "";
      toast(`ยืนยัน ${res.docNo} แล้ว${where}`, "success", { label: "กลับไปดู", onClick: () => router.push(`/documents/${id}`) });
      router.push(res.next ? `/documents/${res.next.id}` : "/documents");
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        toast(e.message, "error");
        await r.reload();
      } else if (e instanceof ApiError && e.status === 409) {
        toast(e.message, "error");
        await r.reload();
      } else toast(e instanceof ApiError ? e.message : "ยืนยันไม่สำเร็จ", "error");
    } finally {
      setVerifying(false);
    }
  }, [doc, mode, verifying, checks, pick, toast, r, client, id, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        void confirm();
        return;
      }
      const key = e.key.toLowerCase();
      if ((key === "j" || key === "k") && !e.ctrlKey && !e.metaKey && (e.altKey || !isTyping(e.target))) {
        e.preventDefault();
        const i = nextCheck(checks, current, key === "j" ? 1 : -1);
        if (i >= 0) pick(i);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [checks, current, pick, confirm]);

  if (r.error) return <div className="mx-auto mt-16 max-w-md"><ErrorState title="เปิดเอกสารไม่ได้" message={r.error} onRetry={() => void r.reload()} /></div>;
  if (!doc || !r.data) return <div className="p-6"><Skeleton lines={10} label="กำลังโหลดเอกสาร…" /></div>;

  const activeMeta = active ? doc.fieldMeta[active] : undefined;
  const activeValue = active ? valueAt(r.data, active) : undefined;

  const form = (
    <>
      <div
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4"
        onFocus={(e) => {
          const f = (e.target as HTMLElement).closest<HTMLElement>("[data-field]")?.dataset.field;
          if (f) setActive(f);
        }}
      >
        {mode === "edit" && <CheckBar items={checks} current={current} onPick={pick} />}
        {mode !== "edit" && doc.riskFlags.length > 0 && <RiskReasons flags={doc.riskFlags} />}
        <ReviewForm data={r.data} meta={doc.fieldMeta} issues={r.issues} edited={edited} readOnly={mode !== "edit"} onChange={r.update} />
        {mode !== "edit" && <EditHistory edits={doc.edits} />}
      </div>
      {mode === "edit" && (
        <div className="flex flex-wrap items-center gap-2 border-t-[1.5px] border-rule-strong bg-surface-sunken px-4 py-2">
          <span data-testid="save-state" role="status" className={`text-label ${r.save === "conflict" || r.save === "error" ? "text-risk" : "text-text-muted"}`}>
            {SAVE_TEXT[r.save]}
          </span>
          <span className="ml-auto text-label text-text-muted" data-testid="after-confirm">
            {afterConfirmText(next?.docNo ?? null)}
          </span>
          <Button variant="primary" shortcut="Ctrl+Enter" disabled={verifying} onClick={() => void confirm()}>
            ยืนยันและไปใบถัดไป
          </Button>
        </div>
      )}
      {mode === "approve" && me && (
        <ApprovalPanel
          client={client}
          doc={doc}
          meId={me.id}
          onDone={(message) => {
            toast(message, "success");
            router.push("/approvals");
          }}
          onError={(message) => toast(message, "error")}
        />
      )}
    </>
  );

  return (
    <div className="flex h-[calc(100vh-82px)] flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2.5 border-b border-rule bg-surface px-4 text-small">
        <Link href={mode === "approve" ? "/approvals" : "/documents"} className="text-text-muted hover:text-text">
          {mode === "approve" ? "รออนุมัติ" : "คิวเอกสาร"}
        </Link>
        <span aria-hidden>/</span>
        <b className="num">{doc.docNo}</b>
        <span className="truncate text-text-muted">{doc.fileName}</span>
        <StatusBadge status={doc.status} />
        {active && <span className="ml-auto truncate text-label text-text-muted">กำลังดู: {fieldLabel(active)}</span>}
      </div>
      <SplitView
        pane={pane}
        onPaneChange={setPane}
        doc={
          <DocumentPane
            client={client}
            documentId={doc.id}
            mimeType={doc.mimeType}
            activeBox={activeMeta?.bbox ?? null}
            activeLabel={active ? fieldLabel(active) : undefined}
            activeValue={typeof activeValue === "string" ? activeValue : null}
          />
        }
        form={form}
      />
    </div>
  );
}

