"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { BBoxOverlay, type BBox } from "./BBoxOverlay";
import { Button } from "./Button";
import { ErrorState, Skeleton } from "./States";

const BASE_WIDTH = 600; // ความกว้างหน้าที่ซูม 100% (px)
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];

type Status = "loading" | "ready" | "error";

/** แสดงหน้า PDF ด้วย PDF.js พร้อมกรอบ bbox ของ field ที่ focus อยู่ */
export function PdfViewer({ url, activeBox, activeLabel }: { url: string; activeBox?: BBox & { page?: number }; activeLabel?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [size, setSize] = useState({ w: BASE_WIDTH, h: BASE_WIDTH * 1.414 });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const d = await pdfjs.getDocument(url).promise;
        if (!cancelled) setDoc(d);
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, attempt]);

  useEffect(() => {
    if (!doc || !canvas.current) return;
    let cancelled = false;
    let task: { cancel: () => void } | undefined;
    (async () => {
      const p = await doc.getPage(page);
      const unscaled = p.getViewport({ scale: 1 });
      const cssScale = (BASE_WIDTH / unscaled.width) * zoom;
      const dpr = window.devicePixelRatio || 1;
      const viewport = p.getViewport({ scale: cssScale * dpr });
      const c = canvas.current!;
      c.width = viewport.width;
      c.height = viewport.height;
      const w = viewport.width / dpr;
      const h = viewport.height / dpr;
      const render = p.render({ canvasContext: c.getContext("2d")!, viewport });
      task = render;
      await render.promise;
      if (!cancelled) {
        setSize({ w, h });
        setStatus("ready");
      }
    })().catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, page, zoom]);

  // เลื่อนให้เห็นกรอบเมื่อ field ที่ focus เปลี่ยน
  useEffect(() => {
    if (!activeBox || !scroller.current) return;
    if (activeBox.page && activeBox.page !== page) setPage(activeBox.page);
    const el = scroller.current.querySelector("[data-testid=bbox]");
    el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [activeBox, page]);

  const zi = ZOOMS.indexOf(zoom);
  const pages = doc?.numPages ?? 1;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1.5 border-b border-rule bg-rule-soft px-3 py-1.5 text-small">
        <Button aria-label="หน้าก่อน" className="min-h-7 !px-2 !py-0.5" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          <ChevronLeft aria-hidden className="size-4" />
        </Button>
        <span className="num">
          หน้า {page} / {pages}
        </span>
        <Button aria-label="หน้าถัดไป" className="min-h-7 !px-2 !py-0.5" disabled={page >= pages} onClick={() => setPage(page + 1)}>
          <ChevronRight aria-hidden className="size-4" />
        </Button>
        <span className="ml-auto" />
        <Button aria-label="ย่อ" className="min-h-7 !px-2 !py-0.5" disabled={zi <= 0} onClick={() => setZoom(ZOOMS[zi - 1])}>
          <ZoomOut aria-hidden className="size-4" />
        </Button>
        <span className="num w-12 text-center" data-testid="zoom-level">
          {Math.round(zoom * 100)}%
        </span>
        <Button aria-label="ขยาย" className="min-h-7 !px-2 !py-0.5" disabled={zi >= ZOOMS.length - 1} onClick={() => setZoom(ZOOMS[zi + 1])}>
          <ZoomIn aria-hidden className="size-4" />
        </Button>
      </div>
      <div ref={scroller} className="min-h-0 flex-1 overflow-auto bg-document-canvas p-5">
        {status === "error" ? (
          <div className="mx-auto mt-24 max-w-md">
            <ErrorState
              title="เปิดไฟล์เอกสารไม่ได้"
              message="ไฟล์อาจเสียหายหรือการเชื่อมต่อขัดข้อง ข้อมูลทางขวายังแก้ไขได้"
              onRetry={() => setAttempt((a) => a + 1)}
            />
          </div>
        ) : (
          <div
            data-testid="pdf-page"
            className="relative mx-auto bg-surface shadow-[0_2px_8px_rgb(27_43_75/0.18)]"
            style={{ width: size.w, height: size.h }}
          >
            {status === "loading" && (
              <div className="absolute inset-0">
                <Skeleton lines={8} label="กำลังเปิดเอกสาร…" />
              </div>
            )}
            <canvas ref={canvas} aria-label={`ภาพเอกสาร หน้า ${page}`} role="img" style={{ width: size.w, height: size.h }} />
            {status === "ready" && (!activeBox?.page || activeBox.page === page) && <BBoxOverlay box={activeBox} label={activeLabel} />}
          </div>
        )}
      </div>
    </div>
  );
}
