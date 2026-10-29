"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { BBoxOverlay } from "@/components/ui/BBoxOverlay";
import { Button } from "@/components/ui/Button";
import { PdfViewer } from "@/components/ui/PdfViewer";
import { ErrorState, Skeleton } from "@/components/ui/States";
import type { ApiClient } from "@/lib/api/client";
import type { BBox } from "@/lib/core";

type Props = {
  client: ApiClient;
  documentId: string;
  mimeType: string;
  activeBox?: BBox | null;
  activeLabel?: string;
  activeValue?: string | null;
};

/** ฝั่งเอกสารของหน้าตรวจ: PDF ใช้ PDF.js, ภาพ/TIFF แสดงทีละหน้า — ไฟล์โหลดผ่าน API พร้อม token */
export function DocumentPane({ client, documentId, mimeType, activeBox, activeLabel, activeValue }: Props) {
  const [pdf, setPdf] = useState<ArrayBuffer>();
  const [pages, setPages] = useState<string[]>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    setFailed(false);
    (async () => {
      try {
        const first = await client.requestBinary(`/documents/${documentId}/file/content${mimeType === "image/tiff" ? "?page=1" : ""}`);
        if (cancelled) return;
        if (mimeType === "application/pdf") return setPdf(first.data);
        const count = Number(first.headers.get("X-Page-Count") ?? "1");
        const blobs = [first];
        for (let p = 2; p <= count; p++) blobs.push(await client.requestBinary(`/documents/${documentId}/file/content?page=${p}`));
        if (cancelled) return;
        for (const b of blobs) urls.push(URL.createObjectURL(new Blob([b.data], { type: b.contentType })));
        setPages(urls);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [client, documentId, mimeType, attempt]);

  if (failed)
    return (
      <div className="mx-auto mt-24 max-w-md p-4">
        <ErrorState title="เปิดไฟล์เอกสารไม่ได้" message="การเชื่อมต่อขัดข้อง ข้อมูลทางขวายังแก้ไขได้" onRetry={() => setAttempt((a) => a + 1)} />
      </div>
    );
  if (pdf) return <PdfViewer data={pdf} activeBox={activeBox ?? undefined} activeLabel={activeLabel} activeValue={activeValue} />;
  if (pages) return <ImagePages pages={pages} activeBox={activeBox} activeLabel={activeLabel} />;
  return (
    <div className="p-6">
      <Skeleton lines={8} label="กำลังเปิดเอกสาร…" />
    </div>
  );
}

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const BASE_WIDTH = 600;

/** ภาพสแกน (JPG/PNG/TIFF รายหน้า) พร้อมกรอบตำแหน่ง — ไม่มีชั้นข้อความ จึงใช้กรอบของ AI ตรง ๆ */
function ImagePages({ pages, activeBox, activeLabel }: { pages: string[]; activeBox?: BBox | null; activeLabel?: string }) {
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeBox && activeBox.page !== page && activeBox.page <= pages.length) setPage(activeBox.page);
    scroller.current?.querySelector("[data-testid=bbox]")?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [activeBox, page, pages.length]);

  const zi = ZOOMS.indexOf(zoom);
  const showBox = activeBox && activeBox.page === page ? activeBox : undefined;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1.5 border-b border-rule bg-rule-soft px-3 py-1.5 text-small">
        <Button aria-label="หน้าก่อน" className="min-h-7 !px-2 !py-0.5" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          <ChevronLeft aria-hidden className="size-4" />
        </Button>
        <span className="num">
          หน้า {page} / {pages.length}
        </span>
        <Button aria-label="หน้าถัดไป" className="min-h-7 !px-2 !py-0.5" disabled={page >= pages.length} onClick={() => setPage(page + 1)}>
          <ChevronRight aria-hidden className="size-4" />
        </Button>
        <span className="ml-auto" />
        <Button aria-label="ย่อ" className="min-h-7 !px-2 !py-0.5" disabled={zi <= 0} onClick={() => setZoom(ZOOMS[zi - 1]!)}>
          <ZoomOut aria-hidden className="size-4" />
        </Button>
        <span className="num w-12 text-center">{Math.round(zoom * 100)}%</span>
        <Button aria-label="ขยาย" className="min-h-7 !px-2 !py-0.5" disabled={zi >= ZOOMS.length - 1} onClick={() => setZoom(ZOOMS[zi + 1]!)}>
          <ZoomIn aria-hidden className="size-4" />
        </Button>
      </div>
      <div ref={scroller} className="min-h-0 flex-1 overflow-auto bg-document-canvas p-5">
        <div data-testid="pdf-page" className="relative mx-auto bg-surface shadow-[0_2px_8px_rgb(27_43_75/0.18)]" style={{ width: BASE_WIDTH * zoom }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- blob URL ของไฟล์ต้นฉบับ ไม่ผ่าน next/image */}
          <img src={pages[page - 1]} alt={`ภาพเอกสาร หน้า ${page}`} className="block w-full" />
          <BBoxOverlay box={showBox} label={activeLabel} />
        </div>
      </div>
    </div>
  );
}
