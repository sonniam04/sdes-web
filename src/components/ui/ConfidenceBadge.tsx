import { confidenceLevel, type ConfidenceLevel } from "@/lib/status";
import { th } from "@/i18n/th";

const tone: Record<ConfidenceLevel, string> = {
  high: "text-status-success",
  mid: "text-status-waiting",
  low: "text-risk",
};

/** ระดับความมั่นใจ 3 ระดับพร้อมเปอร์เซ็นต์ (ปัดลง เพื่อไม่ให้ตัวเลขขัดกับระดับ) */
export function ConfidenceBadge({ value, showLevel = false }: { value: number; showLevel?: boolean }) {
  const level = confidenceLevel(value);
  const pct = Math.floor(value * 100);
  return (
    <span
      data-level={level}
      className={`num text-label font-semibold ${tone[level]}`}
      title={`${th.confidence.prefix} ${pct}% (${th.confidence[level]})`}
    >
      {showLevel && <span className="mr-1">{th.confidence[level]}</span>}
      {pct}%
    </span>
  );
}
