import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { CalendarX2, MapPin, Shuffle, Sparkles } from "lucide-react";
import { useState } from "react";
import { api } from "@/api/client";
import type { WeekTimetable } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { Card, EmptyState, ErrorState, PageHeader, Segmented, Skeleton } from "@/components/ui";
import { formatDate, toISODate, WEEKDAYS } from "@/lib/format";
import { useAsync } from "@/lib/hooks";

const PALETTE = ["from-brand-50 to-white ring-brand-200 text-brand-800", "from-mint-50 to-white ring-mint-500/25 text-mint-600", "from-amber-50 to-white ring-amber-500/25 text-amber-600", "from-sky-50 to-white ring-sky-500/25 text-sky-500", "from-rose-50 to-white ring-rose-500/25 text-rose-600"];
const colorOf = (s?: string | null) => PALETTE[[...(s ?? "")].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];

export function WeekGrid({ data }: { data: WeekTimetable }) {
  const todayIso = toISODate(new Date());
  const days = data.days;
  const weekdayOf = (iso: string) => WEEKDAYS[(new Date(`${iso}T00:00:00`).getDay() + 6) % 7];
  if (data.periods.length === 0) return <EmptyState icon={<CalendarX2 className="h-6 w-6" />} title="등록된 시간표가 없습니다." description="학교 관리자가 교시표와 시간표를 등록하면 표시됩니다." />;
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <div className="grid min-w-[720px] gap-2" style={{ gridTemplateColumns: `72px repeat(${Math.max(days.length, 1)}, minmax(0, 1fr))` }}>
        <div />
        {days.map((d) => (
          <div key={d} className={clsx("rounded-xl py-2 text-center", d === todayIso ? "bg-brand-500 text-white shadow-lift" : "text-ink-500")}>
            <div className="text-[12px] font-semibold opacity-80">{weekdayOf(d)}</div>
            <div className="text-[15px] font-bold">{formatDate(d, false)}</div>
          </div>
        ))}
        {data.periods.map((p, row) => (
          <div key={p.perNo} className="contents">
            <div className="flex flex-col items-center justify-center rounded-xl bg-ink-100/70 py-2">
              <div className="text-[14px] font-extrabold text-ink-700">{p.perNo}</div>
              <div className="text-[10.5px] tabular-nums text-ink-400">{p.start}</div>
            </div>
            {days.map((d, col) => {
              const cell = data.cells.find((c) => c.date === d && c.perNo === p.perNo);
              return (
                <motion.div key={d} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: (row * 5 + col) * 0.012 }}
                  className={clsx("relative min-h-[76px] rounded-xl p-2.5 ring-1", cell?.subject ? `bg-gradient-to-br ${colorOf(cell.subject)}` : "bg-white ring-ink-200/70", d === todayIso && "ring-2")}>
                  {cell?.special && (
                    <div className="absolute inset-0 flex flex-col justify-center rounded-xl bg-[repeating-linear-gradient(135deg,#FFF7E6,#FFF7E6_8px,#FFF0D6_8px,#FFF0D6_16px)] p-2.5 ring-1 ring-amber-500/30">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600"><Sparkles className="h-3 w-3" /> 특별 일정</div>
                      <div className="truncate text-[13px] font-bold text-ink-900">{cell.special}</div>
                    </div>
                  )}
                  {cell?.subject && (
                    <>
                      <div className="flex items-center gap-1 truncate text-[13.5px] font-bold">
                        {cell.subject}
                        {cell.isMoving && <span className="rounded bg-white/80 px-1 text-[10px] font-bold text-ink-700">{cell.groupLabel}</span>}
                      </div>
                      <div className="mt-1 space-y-0.5 text-[11.5px] text-ink-500">
                        {cell.classLabel ? (
                          // 교사 시간표: 수업하는 교실(반) — 교실이 반 이름과 같으면 '3-2반 교실', 다르면 '미술실 (3-2반)'
                          <div className="flex items-center gap-1 truncate font-semibold text-ink-700"><MapPin className="h-3 w-3 shrink-0" />
                            {!cell.classroom || cell.classroom === cell.classLabel ? `${cell.classLabel}반 교실` : `${cell.classroom} (${cell.classLabel}반)`}
                          </div>
                        ) : (
                          <>
                            {cell.classroom && <div className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3" />{cell.classroom}</div>}
                            {cell.teacher && <div className="truncate">{cell.teacher}</div>}
                          </>
                        )}
                      </div>
                      <div className="absolute right-2 top-2 flex gap-1">
                        {cell.isMoving && <Shuffle className="h-3 w-3 text-ink-400" />}
                        {cell.isChanged && <span className="h-1.5 w-1.5 rounded-full bg-rose-500" title="변경됨" />}
                      </div>
                    </>
                  )}
                </motion.div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Timetable() {
  const { profile } = useAuth();
  // 이번 주 = 오늘부터 7일, 다음 주 = 7일 뒤부터 7일 (컴시간은 이번 주·다음 주 시간표를 동기화합니다)
  const [week, setWeek] = useState<"this" | "next">("this");
  const [view, setView] = useState<"class" | "teacher">(profile?.role === "TEACHER" ? "teacher" : "class");
  const iso = week === "next" ? (() => { const n = new Date(); n.setDate(n.getDate() + 7); return toISODate(n); })() : undefined;
  const { data, loading, error, reload } = useAsync(() => api.get<WeekTimetable>("/timetable/week", { date: iso, view }), [iso, view]);

  return (
    <>
      <PageHeader title="시간표" description={data ? `${formatDate(data.weekStart, false)} ~ ${formatDate(data.weekEnd, false)} · ${week === "this" ? "오늘부터 일주일" : "다음 일주일"} 시간표예요. 이동수업과 특별 일정이 함께 반영돼요.` : "이동수업과 특별 일정이 함께 반영돼요."}
        actions={<>
          {profile?.role === "TEACHER" && <Segmented value={view} onChange={setView} options={[{ value: "teacher", label: "내 수업" }, { value: "class", label: "담임 학급" }]} />}
          <Segmented value={week} onChange={setWeek} options={[{ value: "this", label: "이번 주" }, { value: "next", label: "다음 주" }]} />
        </>} />
      <Card className="p-4 sm:p-5">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="l" exit={{ opacity: 0 }} className="grid grid-cols-6 gap-2">{Array.from({ length: 30 }).map((_, i) => <Skeleton key={i} className="h-[76px]" />)}</motion.div>
          ) : error ? (
            <ErrorState key="e" error={error} onRetry={() => reload()} />
          ) : data ? (
            <motion.div key={`${data.weekStart}-${view}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}><WeekGrid data={data} /></motion.div>
          ) : null}
        </AnimatePresence>
      </Card>
    </>
  );
}
