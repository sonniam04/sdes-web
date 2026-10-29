export type BBox = { x: number; y: number; w: number; h: number };

/**
 * กรอบบนหน้าเอกสาร พิกัดเป็นสัดส่วนของหน้า (0–1) จึงไม่ขึ้นกับระดับซูม
 * ต้องวางในกล่อง position:relative ที่มีขนาดเท่าหน้าเอกสารที่ render
 */
export function BBoxOverlay({ box, label }: { box?: BBox; label?: string }) {
  if (!box) return null;
  const pad = 0.004;
  return (
    <div
      data-testid="bbox"
      aria-hidden
      title={label}
      className="pointer-events-none absolute border-2 border-risk bg-[rgb(180_35_24/0.08)] transition-all duration-[180ms] ease-out motion-reduce:transition-none"
      style={{
        left: `${(box.x - pad) * 100}%`,
        top: `${(box.y - pad) * 100}%`,
        width: `${(box.w + pad * 2) * 100}%`,
        height: `${(box.h + pad * 2) * 100}%`,
      }}
    />
  );
}
