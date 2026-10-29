import type { ReactNode } from "react";

export type CellState = "default" | "low" | "resolved";

export type Column<T> = {
  key: string;
  header: string;
  align?: "left" | "right";
  width?: string;
  render: (row: T, index: number) => ReactNode;
  /** เน้นช่องที่ AI ไม่มั่นใจ */
  cellState?: (row: T, index: number) => CellState;
};

const cellTone: Record<CellState, string> = {
  default: "",
  low: "bg-risk-bg shadow-[inset_0_-2px_0_var(--color-risk)]",
  resolved: "bg-status-success-bg shadow-[inset_0_-2px_0_var(--color-status-success)]",
};

/**
 * ตารางข้อมูลแบบแน่น: แถวสูง 38 px, หัวตารางติดด้านบน, ตัวเลขชิดขวา
 * ส่วนที่เลื่อนได้สูงอย่างน้อย 8 แถว และขยายถึงครึ่งจอบนจอใหญ่
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  rowFlagged,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  caption: string;
  rowFlagged?: (row: T, index: number) => boolean;
}) {
  return (
    <div
      data-testid="datatable-scroll"
      tabIndex={0}
      aria-label={caption}
      className="max-h-[max(calc(8*var(--row-height)+30px),50vh)] overflow-auto focus-visible:outline-2"
    >
      <table className="w-full border-collapse text-small">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                style={{ width: c.width }}
                className={`sticky top-0 z-10 h-[30px] border-b border-rule-strong bg-surface px-1.5 text-label font-semibold text-text-muted ${c.align === "right" ? "text-right" : "text-left"}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const flagged = rowFlagged?.(row, i) ?? false;
            return (
              <tr
                key={rowKey(row, i)}
                data-flagged={flagged || undefined}
                className={`h-[var(--row-height)] border-b border-rule-soft ${flagged ? "shadow-[inset_1px_0_0_var(--color-risk)]" : ""}`}
              >
                {columns.map((c) => {
                  const state = c.cellState?.(row, i) ?? "default";
                  return (
                    <td
                      key={c.key}
                      data-state={state === "default" ? undefined : state}
                      className={`px-1.5 ${c.align === "right" ? "num" : ""} ${cellTone[state]}`}
                    >
                      {c.render(row, i)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
