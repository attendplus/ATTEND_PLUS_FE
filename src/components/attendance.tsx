import { motion } from "framer-motion";
import clsx from "clsx";
import { CheckCircle2, Circle, MapPin, PenLine, QrCode } from "lucide-react";
import { lazy, Suspense } from "react";
import type { Attendance, Summary } from "@/api/types";
import { Badge, EmptyState, Skeleton } from "@/components/ui";
import { formatDate, formatTime, STATUS_META } from "@/lib/format";

export const METHOD_ICON = { GPS: <MapPin className="h-3 w-3" />, QR: <QrCode className="h-3 w-3" />, MANUAL: <PenLine className="h-3 w-3" /> };

// 출결 요약 도넛은 차트 라이브러리(recharts, gzip 약 100KB)를 씁니다. 출결 현황·이동수업 출결 첫 화면은 차트를 쓰지 않으므로
// 도넛이 실제로 보일 때(학생 상세 창·출결 기록·통계)만 내려받도록 지연 로딩합니다.
const LazyDonut = lazy(() => import("./SummaryDonut"));
export function SummaryDonut({ summary }: { summary: Summary }) {
  return <Suspense fallback={<Skeleton className="h-40" />}><LazyDonut summary={summary} /></Suspense>;
}

export function AttendanceRecordList({ records }: { records: Attendance[] }) {
  if (records.length === 0) return <EmptyState title="출결 기록이 없습니다" description="해당 기간의 출결 기록이 없습니다." />;
  const groups = records.reduce<Record<string, Attendance[]>>((acc, r) => { (acc[r.date] ??= []).push(r); return acc; }, {});
  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([date, items], gi) => (
        <motion.div key={date} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(gi * 0.04, 0.4) }}>
          <div className="mb-2 text-[13px] font-bold text-ink-500">{formatDate(date)}</div>
          <div className="divide-y divide-ink-100 rounded-2xl ring-1 ring-ink-200/70">
            {[...items].sort((a, b) => a.perNo - b.perNo).map((r) => (
              <div key={r.attId} className="flex items-center gap-3 px-4 py-3">
                <div className={clsx("grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[13px] font-extrabold", STATUS_META[r.status].soft)}>{r.perNo}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[14px] font-semibold">
                    {r.perNo}교시 {r.statusLabel}{r.reasonTypeLabel ? ` (${r.reasonTypeLabel})` : ""}
                  </div>
                  <div className="truncate text-[12px] text-ink-500">{formatTime(r.checkedAt)} · {r.reason ?? "자동 판정"}</div>
                </div>
                <Badge className="bg-ink-50 text-ink-600 ring-ink-200">{METHOD_ICON[r.method]}{r.methodLabel}</Badge>
                <span title={r.isConfirmed ? "확인 완료" : "미확인"}>{r.isConfirmed ? <CheckCircle2 className="h-4 w-4 text-mint-500" aria-label="확인 완료" /> : <Circle className="h-4 w-4 text-ink-300" aria-label="미확인" />}</span>
              </div>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
