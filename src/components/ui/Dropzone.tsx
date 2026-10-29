"use client";

import { useRef, useState } from "react";
import { Check, Upload, X } from "lucide-react";
import { th } from "@/i18n/th";

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ACCEPT = ["application/pdf", "image/tiff", "image/jpeg", "image/png"];

export type UploadResult = { name: string; ok: boolean; message: string; docNo?: string };

/** ตรวจเบื้องต้นฝั่ง client เพื่อให้ผู้ใช้รู้เร็ว — server ตรวจซ้ำเสมอ */
export function precheck(file: File): string | null {
  if (file.size > MAX_FILE_BYTES) return th.upload.tooLarge;
  if (file.type && !ACCEPT.includes(file.type)) return th.upload.unsupported;
  return null;
}

export function Dropzone({
  onFiles,
  results,
  disabled,
}: {
  /** ไฟล์ที่ผ่าน precheck */
  onFiles: (files: File[], rejected: UploadResult[]) => void;
  results?: UploadResult[];
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const take = (list: FileList | null) => {
    if (!list || disabled) return;
    const ok: File[] = [];
    const rejected: UploadResult[] = [];
    for (const f of Array.from(list)) {
      const why = precheck(f);
      if (why) rejected.push({ name: f.name, ok: false, message: why });
      else ok.push(f);
    }
    onFiles(ok, rejected);
  };

  const accepted = results?.filter((r) => r.ok).length ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <div
        data-over={over || undefined}
        onDragEnter={(e) => (e.preventDefault(), setOver(true))}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(e.dataTransfer.files);
        }}
        className={`flex items-center gap-4 border-[1.5px] bg-surface px-4 py-3 ${over ? "border-solid border-focus" : "border-dashed border-text-muted"}`}
      >
        <Upload aria-hidden className="size-5.5" />
        <span>
          <b className="font-semibold">{th.upload.dropTitle}</b> {th.upload.or}{" "}
          <button
            type="button"
            disabled={disabled}
            onClick={() => input.current?.click()}
            className="font-semibold underline underline-offset-3"
          >
            {th.upload.choose}
          </button>
        </span>
        <span className="mr-auto text-label text-text-muted">{th.upload.rules}</span>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept=".pdf,.tif,.tiff,.jpg,.jpeg,.png"
          data-testid="file-input"
          onChange={(e) => {
            take(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {results && results.length > 0 && (
        <section aria-label="ผลการอัปโหลด" className="border border-rule bg-surface">
          <h2 className="border-b border-rule-soft px-4 py-2 font-semibold">
            {th.upload.resultsTitle(accepted, results.length)}
          </h2>
          <ul>
            {results.map((r) => (
              <li
                key={r.name}
                className="grid grid-cols-[16px_minmax(0,280px)_120px_1fr] items-center gap-2.5 border-t border-rule-soft px-4 py-1 text-small first:border-t-0"
              >
                {r.ok ? (
                  <Check aria-label="รับแล้ว" className="size-4 text-status-success" />
                ) : (
                  <X aria-label="ถูกปฏิเสธ" className="size-4 text-risk" />
                )}
                <span className="truncate">{r.name}</span>
                <span className="num text-left">{r.docNo ?? ""}</span>
                <span className={r.ok ? "text-text-muted" : "text-risk"}>{r.message}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
