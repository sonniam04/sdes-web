"use client";

// หน้าภาพรวม: หน้าแรกของทุก role แสดงเฉพาะส่วนที่ API ส่งมาตามสิทธิ์ (spec overview-dashboard, design D5)
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, ChevronRight, Minus, WifiOff, X } from "lucide-react";
import { AppFrame } from "@/components/AppFrame";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { backlogLink, type BacklogGroup, type Dashboard } from "@/lib/dashboard";
import { formatAgo, formatChange, formatDateTime, formatMoney, formatSeconds, formatThaiDate, formatThaiMonth } from "@/lib/format";
import { ROLES, type Role } from "@/lib/roles";

const REFRESH_MS = 30_000;
const timeOf = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

export default function HomePage() {
  return (
    <AppFrame roles={ROLES}>
      <Overview />
    </AppFrame>
  );
}

function Overview() {
  const { state, client } = useAuth();
  const roles = state.status === "authenticated" ? state.user.roles : [];
  const [data, setData] = useState<Dashboard>();
  const [error, setError] = useState<string>();
  const [stale, setStale] = useState(false);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    try {
      const d = await client.request<Dashboard>("/dashboard");
      loaded.current = true;
      setData(d);
      setStale(false);
      setError(undefined);
    } catch (e) {
      // รอบที่ล้มเหลวคงข้อมูลเดิมไว้ ถ้ายังไม่เคยโหลดได้เลยจึงแสดงหน้าข้อผิดพลาด
      if (loaded.current) setStale(true);
      else setError(e instanceof ApiError ? e.message : "โหลดภาพรวมไม่สำเร็จ");
    }
  }, [client]);

  // ดึงทุก 30 วินาทีขณะแท็บเปิดอยู่ หยุดเมื่อแท็บถูกซ่อน และดึงทันทีเมื่อกลับมา
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      clearInterval(timer);
      timer = setInterval(() => void load(), REFRESH_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") return clearInterval(timer);
      void load();
      start();
    };
    void load();
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  let no = 0;
  const next = () => ++no;

  return (
    <main className="mx-auto flex max-w-[1180px] flex-col gap-3 px-5 py-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-heading font-bold">ภาพรวม</h1>
          <p className="text-small text-text-muted">
            {data ? <>ข้อมูล ณ {timeOf.format(new Date(data.generatedAt))} น. · </> : null}อัปเดตเองทุก 30 วินาที
          </p>
        </div>
        {stale && (
          <p role="status" className="flex items-center gap-1.5 border border-status-waiting bg-status-waiting-bg px-3 py-1 text-small text-status-waiting">
            <WifiOff aria-hidden className="size-4" /> ข้อมูลอาจไม่เป็นปัจจุบัน — จะลองใหม่อัตโนมัติ
          </p>
        )}
      </div>

      {error ? (
        <ErrorState title={error} onRetry={() => void load()} />
      ) : !data ? (
        <Skeleton lines={10} />
      ) : (
        <>
          {data.backlog && <BacklogSection no={next()} data={data} roles={roles} />}
          {(data.throughput || data.indicators) && (
            <div className="grid grid-cols-1 gap-3 min-[1280px]:grid-cols-[3fr_2fr]">
              {data.throughput && <ThroughputSection no={next()} days={data.throughput.days} />}
              {data.indicators && <IndicatorSection no={next()} ind={data.indicators} />}
            </div>
          )}
          {(data.finance || data.health) && (
            <div className={`grid grid-cols-1 gap-3 ${data.finance && data.health ? "min-[1280px]:grid-cols-2" : ""}`}>
              {data.finance && <FinanceSection no={next()} finance={data.finance} />}
              {data.health && <HealthSection no={next()} health={data.health} />}
            </div>
          )}
        </>
      )}
    </main>
  );
}

/** หมวดแบบแบบฟอร์ม: เลขหมวดบนพื้นน้ำเงินหมึก + ชื่อ + หมายเหตุชิดขวา */
function Section({ no, title, note, children }: { no: number; title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col border-[1.5px] border-rule-strong bg-surface">
      <h2 className="flex items-stretch gap-2 border-b border-rule-strong bg-surface-sunken text-small font-bold">
        <span className="num flex items-center bg-action px-2.5 text-action-text">{no}</span>
        <span className="py-1">{title}</span>
        {note && <span className="ml-auto py-1 pr-2.5 font-normal text-text-muted">{note}</span>}
      </h2>
      <div className="flex flex-1 flex-col p-3">{children}</div>
    </section>
  );
}

const BACKLOG: { group: BacklogGroup; label: string; risk?: boolean }[] = [
  { group: "waiting", label: "รอตรวจ" },
  { group: "approval", label: "รออนุมัติ" },
  { group: "reading", label: "กำลังอ่าน" },
  { group: "failed", label: "อ่านไม่สำเร็จ", risk: true },
  { group: "syncFailed", label: "ส่งไม่สำเร็จ", risk: true },
];

function BacklogSection({ no, data, roles }: { no: number; data: Dashboard; roles: readonly Role[] }) {
  const backlog = data.backlog!;
  return (
    <Section no={no} title="งานค้าง" note="กดเพื่อเปิดรายการ">
      <ul className="grid grid-cols-5 gap-px border border-rule bg-rule">
        {BACKLOG.map(({ group, label, risk }) => {
          const { count, oldestAt } = backlog[group];
          const alarm = risk && count > 0;
          return (
            <li key={group} className="bg-surface">
              <Link
                href={backlogLink(group, roles)}
                data-group={group}
                className={`group flex h-full flex-col gap-0.5 px-3 py-2 hover:bg-surface-sunken ${alarm ? "bg-risk-bg" : ""}`}
              >
                <span className={`flex items-center justify-between text-label font-semibold ${alarm ? "text-risk" : "text-text-muted"}`}>
                  {label}
                  <ChevronRight aria-hidden className="size-3.5 opacity-60 group-hover:opacity-100" />
                </span>
                <span className={`num text-heading font-bold ${alarm ? "text-risk" : ""}`}>{count.toLocaleString("th-TH")}</span>
                <span className="text-label text-text-muted">เก่าสุด {oldestAt ? formatAgo(oldestAt, data.generatedAt) : "—"}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

const SERIES = [
  { key: "uploaded", label: "อัปโหลด", fill: "fill-rule", swatch: "bg-rule" },
  { key: "verified", label: "ตรวจแล้ว", fill: "fill-focus", swatch: "bg-focus" },
  { key: "synced", label: "ส่ง ERP สำเร็จ", fill: "fill-status-success", swatch: "bg-status-success" },
] as const;

type Day = NonNullable<Dashboard["throughput"]>["days"][number];

function ThroughputSection({ no, days }: { no: number; days: Day[] }) {
  const today = days.at(-1);
  const max = Math.max(1, ...days.flatMap((d) => [d.uploaded, d.verified, d.synced]));
  // กราฟแท่งกลุ่มละ 3 แท่งต่อวัน — ตัวเลขจริงอยู่ในตารางที่ซ่อนไว้สำหรับ screen reader
  const W = 560;
  const H = 120;
  const slot = W / days.length;
  const bar = Math.min(10, (slot - 6) / 3);
  return (
    <Section no={no} title="ปริมาณงาน 14 วัน" note="ตามเวลาไทย">
      <dl className="mb-2 grid grid-cols-3 gap-px border border-rule bg-rule">
        {SERIES.map((s) => (
          <div key={s.key} className="flex items-baseline justify-between bg-surface px-3 py-1.5">
            <dt className="flex items-center gap-1.5 text-small">
              <span aria-hidden className={`inline-block size-2.5 rounded-sm ${s.swatch}`} />
              {s.label}วันนี้
            </dt>
            <dd className="num text-title font-bold" data-testid={`today-${s.key}`}>
              {today ? today[s.key] : 0}
            </dd>
          </div>
        ))}
      </dl>
      {/* ความสูงคงที่ ยืดตามความกว้าง (แท่งไม่มีข้อความ จึงยืดได้) — วันที่เป็น HTML ใต้กราฟให้ขนาดตัวอักษรคงที่ */}
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-28 w-full" aria-hidden>
        <line x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} className="stroke-rule-strong" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {days.map((d, i) => (
          <g key={d.date} transform={`translate(${i * slot + (slot - bar * 3 - 2) / 2},0)`}>
            {SERIES.map((s, j) => {
              const h = (d[s.key] / max) * (H - 4);
              return <rect key={s.key} x={j * (bar + 1)} y={H - h} width={bar} height={h} className={s.fill} />;
            })}
          </g>
        ))}
      </svg>
      <div aria-hidden className="grid text-center text-label text-text-muted" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
        {days.map((d, i) => (
          <span key={d.date}>{i % 2 === 1 || i === days.length - 1 ? d.date.slice(8) : ""}</span>
        ))}
      </div>
      <table className="sr-only">
        <caption>จำนวนเอกสารรายวัน 14 วันล่าสุด</caption>
        <thead>
          <tr>
            <th scope="col">วันที่</th>
            {SERIES.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <th scope="row">{formatThaiDate(d.date)}</th>
              <td>{d.uploaded}</td>
              <td>{d.verified}</td>
              <td>{d.synced}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

function Verdict({ pass }: { pass: boolean | null }) {
  if (pass === null) return null;
  return pass ? (
    <span className="inline-flex items-center gap-1 rounded-sm border border-current bg-status-success-bg px-1.5 text-label font-semibold text-status-success">
      <Check aria-hidden className="size-3" strokeWidth={2.5} /> ผ่าน
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-sm border border-current bg-risk-bg px-1.5 text-label font-semibold text-risk">
      <X aria-hidden className="size-3" strokeWidth={2.5} /> ไม่ผ่าน
    </span>
  );
}

const pct = (r: number) => `${Math.round(r * 100)}%`;

function IndicatorSection({ no, ind }: { no: number; ind: NonNullable<Dashboard["indicators"]> }) {
  const none = <span className="font-normal text-text-muted">ยังไม่มีข้อมูล</span>;
  const rows: { id: string; label: string; value: ReactNode; target?: string; pass: boolean | null }[] = [
    {
      id: "indicator-seconds",
      label: "เวลาเฉลี่ย อัปโหลด → อ่านเสร็จ",
      value: ind.avgSecondsToExtracted === null ? none : formatSeconds(ind.avgSecondsToExtracted),
      target: `เป้า < ${ind.targets.seconds} วินาที`,
      pass: ind.avgSecondsToExtracted === null ? null : ind.avgSecondsToExtracted < ind.targets.seconds,
    },
    {
      id: "indicator-no-edit",
      label: "ยืนยันโดยไม่ต้องแก้ค่าที่ AI อ่าน",
      value: ind.noEditRate === null ? none : pct(ind.noEditRate),
      target: `เป้า > ${pct(ind.targets.noEditRate)}`,
      pass: ind.noEditRate === null ? null : ind.noEditRate > ind.targets.noEditRate,
    },
    {
      id: "indicator-approval",
      label: "ต้องส่งให้หัวหน้าอนุมัติ",
      value: ind.approvalRate === null ? none : pct(ind.approvalRate),
      pass: null,
    },
  ];
  return (
    <Section no={no} title="ตัวชี้วัดตาม BRD" note={`เอกสารที่อัปโหลด ${ind.windowDays} วันล่าสุด`}>
      <dl className="flex flex-col">
        {rows.map((r) => (
          <div key={r.id} data-testid={r.id} className="flex flex-col gap-0.5 border-b border-rule-soft py-2 last:border-b-0">
            <dt className="text-small">{r.label}</dt>
            <dd className="flex items-baseline gap-2">
              <span className="num text-title font-bold">{r.value}</span>
              <Verdict pass={r.pass} />
              {r.target && <span className="ml-auto text-label text-text-muted">{r.target}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-auto pt-2 text-label text-text-muted">สัดส่วนที่ไม่ต้องแก้ค่าเป็นตัวแทนความแม่นยำ ไม่ใช่ค่าความแม่นยำระดับบรรทัดที่วัดตอนทดสอบตาม BRD</p>
    </Section>
  );
}

function MoneyRow({ label, value, base, testId, total }: { label: string; value: string; base: string; testId: string; total?: boolean }) {
  const change = formatChange(value, base);
  return (
    <div className={`flex items-baseline gap-2 py-1.5 text-small ${total ? "border-t border-rule-strong font-bold" : ""}`} data-testid={testId}>
      <span>{label}</span>
      <span aria-hidden className="mb-1 flex-1 border-b border-dotted border-rule" />
      {change && <span className="num text-label font-normal text-text-muted">{change} จากเดือนก่อน</span>}
      <span className={`num text-right ${total ? "border-b-[3px] border-double border-rule-strong" : "font-semibold"}`}>{formatMoney(value)}</span>
    </div>
  );
}

function FinanceSection({ no, finance }: { no: number; finance: NonNullable<Dashboard["finance"]> }) {
  const { current: c, previous: p } = finance;
  return (
    <Section no={no} title="การเงินเดือนนี้" note={`${formatThaiMonth(finance.month)} · ${c.documentCount.toLocaleString("th-TH")} ฉบับ`}>
      <MoneyRow label="ยอดก่อนภาษี" value={c.subtotal} base={p.subtotal} testId="finance-subtotal" />
      <MoneyRow label="ภาษีซื้อ" value={c.vat} base={p.vat} testId="finance-vat" />
      <MoneyRow label="ภาษีหัก ณ ที่จ่าย" value={c.wht} base={p.wht} testId="finance-wht" />
      <MoneyRow label="ยอดรวม (บาท)" value={c.grandTotal} base={p.grandTotal} testId="finance-grand" total />
      <div className="mt-auto flex items-center justify-between pt-2 text-label text-text-muted">
        <span>ตามวันที่ในใบกำกับ ชุดเดียวกับหน้ารายงาน</span>
        <Link href="/reports" className="inline-flex items-center gap-0.5 font-semibold text-text underline-offset-2 hover:underline">
          ดูรายงาน
          <ChevronRight aria-hidden className="size-3.5" />
        </Link>
      </div>
    </Section>
  );
}

function HealthRow({ label, children, testId, href }: { label: string; children: ReactNode; testId?: string; href?: string }) {
  const body = (
    <>
      <span>{label}</span>
      <span aria-hidden className="mb-1 flex-1 border-b border-dotted border-rule" />
      <span className="num text-right font-semibold">{children}</span>
      {href && <ChevronRight aria-hidden className="size-3.5 self-center text-text-muted" />}
    </>
  );
  const cls = "flex items-baseline gap-2 py-1.5 text-small";
  return href ? (
    <Link href={href} data-testid={testId} className={`${cls} hover:bg-surface-sunken`}>
      {body}
    </Link>
  ) : (
    <div data-testid={testId} className={cls}>
      {body}
    </div>
  );
}

function HealthSection({ no, health }: { no: number; health: NonNullable<Dashboard["health"]> }) {
  const failed = health.syncFailed > 0;
  return (
    <Section no={no} title="สุขภาพระบบ">
      <HealthRow label="งานในคิวอ่าน">{health.queues.extract}</HealthRow>
      <HealthRow label="งานในคิวส่ง ERP">{health.queues.sync}</HealthRow>
      <HealthRow label="ส่งไม่สำเร็จ" href="/admin/sync">
        <span className={failed ? "text-risk" : ""}>{health.syncFailed}</span>
      </HealthRow>
      <HealthRow label="การเชื่อมต่อ ERP">
        {health.connected ? "เชื่อมต่อแล้ว" : <span className="text-risk">ยังไม่ได้เชื่อมต่อ</span>} · ส่งอัตโนมัติ {health.autoSync ? "เปิด" : "ปิด"}
      </HealthRow>
      <HealthRow label="ส่งสำเร็จล่าสุด">{health.lastSyncedAt ? formatDateTime(health.lastSyncedAt) : <Minus aria-label="ยังไม่มี" className="inline size-3.5" />}</HealthRow>
      {health.errors24h !== undefined && (
        <HealthRow label="error ใน 24 ชั่วโมง" href="/admin/logs?level=error" testId="health-errors">
          <span className={health.errors24h > 0 ? "text-risk" : ""}>{health.errors24h}</span>
        </HealthRow>
      )}
      {health.expiringKeys && (
        <div data-testid="health-keys" className="mt-1 border-t border-rule-soft pt-1.5 text-small">
          <Link href="/admin/api-keys" className="font-semibold hover:underline">
            API key ที่จะหมดอายุใน 14 วัน
          </Link>
          {health.expiringKeys.length === 0 ? (
            <p className="text-label text-text-muted">ไม่มี</p>
          ) : (
            <ul className="mt-0.5 flex flex-col">
              {health.expiringKeys.map((k) => (
                <li key={k.id} className="flex justify-between text-small">
                  <span>{k.name}</span>
                  <span className="num text-status-waiting">หมดอายุ {formatThaiDate(k.expiresAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Section>
  );
}
