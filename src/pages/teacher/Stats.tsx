import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { AlertCircle, ChevronDown, Filter } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/api/client";
import type { AttStatus, Summary } from "@/api/types";
import { SummaryDonut } from "@/components/attendance";
import { Badge, Card, EmptyState, ErrorState, Input, PageHeader, Skeleton } from "@/components/ui";
import { STATUS_META, toISODate } from "@/lib/format";
import { useAsync } from "@/lib/hooks";

interface Stats {
  start: string; end: string; classLabel: string; isClassActive: boolean; hasUnconfirmed: boolean; summary: Summary;
  students: { usId: number; name: string; number: number; summary: Summary; months: { month: string; summary: Summary }[] }[];
  daily: { date: string; present: number; late: number; absent: number; earlyLeave: number }[];
}

const FILTERS: AttStatus[] = ["PRESENT", "LATE", "ABSENT", "EARLY_LEAVE", "PENDING"];

export default function TeacherStats() {
  const today = new Date();
  const [start, setStart] = useState(toISODate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [end, setEnd] = useState(toISODate(today));
  const [statuses, setStatuses] = useState<AttStatus[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const { data, loading, error, reload } = useAsync(() => api.get<Stats>("/teacher/attendance/stats", { start, end, status: statuses }), [start, end, statuses.join()]);
  const toggle = (s: AttStatus) => setStatuses((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  return (
    <>
      <PageHeader eyebrow={data?.classLabel} title="출결 통계 리포트" description="학생별 · 월별 출결 통계를 기간과 출결 상태로 필터링해 확인하세요." />
      <Card className="mb-5 flex flex-wrap items-end gap-3 p-4">
        <Input label="시작일" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        <Input label="종료일" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        <div className="flex-1">
          <div className="label flex items-center gap-1"><Filter className="h-3.5 w-3.5" />출결 상태</div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((s) => (
              <button key={s} onClick={() => toggle(s)} className={clsx("chip px-3 py-1.5 ring-1 transition", statuses.includes(s) ? `${STATUS_META[s].soft}` : "bg-white text-ink-500 ring-ink-200")}>
                <span className={clsx("h-2 w-2 rounded-full", STATUS_META[s].dot)} />{STATUS_META[s].label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {error ? <Card><ErrorState error={error} onRetry={() => reload()} /></Card> : (
        <>
          <AnimatePresence>
            {data && (data.hasUnconfirmed || !data.isClassActive) && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mb-5 flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-[13.5px] font-medium text-amber-600 ring-1 ring-amber-500/20">
                <AlertCircle className="h-4 w-4" />
                {!data.isClassActive ? "비활성화된 학급입니다. 출결 통계만 조회할 수 있습니다." : `일부 출결의 확인 상태가 확인되지 않습니다. (미확인 ${data.summary.unconfirmed}건)`}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
            <Card className="p-6">
              <div className="mb-4 text-[16px] font-bold">학급 전체</div>
              {loading || !data ? <Skeleton className="h-40" /> : <SummaryDonut summary={data.summary} />}
            </Card>
            <Card className="p-6">
              <div className="mb-4 text-[16px] font-bold">일자별 추이</div>
              {loading || !data ? <Skeleton className="h-56" /> : data.summary.total === 0 ? <EmptyState title="해당 기간의 출결 기록이 없습니다." /> : (
                <div className="h-56">
                  <ResponsiveContainer>
                    <BarChart data={data.daily.map((d) => ({ ...d, label: d.date.slice(5).replace("-", "/") }))} barCategoryGap="25%">
                      <CartesianGrid vertical={false} stroke="#EEF0F4" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="#9CA3AF" />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} stroke="#9CA3AF" width={28} />
                      <Tooltip cursor={{ fill: "rgba(43,87,147,.06)" }} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(0,0,0,.12)" }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="present" name="출석" stackId="a" fill="#12B886" />
                      <Bar dataKey="late" name="지각" stackId="a" fill="#F59F00" />
                      <Bar dataKey="earlyLeave" name="조퇴" stackId="a" fill="#228BE6" />
                      <Bar dataKey="absent" name="결석" stackId="a" fill="#F03E3E" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>

          <Card className="mt-5 overflow-hidden">
            <div className="border-b border-ink-100 px-6 py-4 text-[16px] font-bold">학생별 월별 리포트</div>
            {loading || !data ? <div className="space-y-2 p-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
              : data.students.length === 0 ? <EmptyState title="학생 정보가 없습니다." /> : (
                <div className="divide-y divide-ink-100">
                  {data.students.map((st, i) => (
                    <motion.div key={st.usId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.4) }}>
                      <button onClick={() => setOpen(open === st.usId ? null : st.usId)} className="flex w-full items-center gap-4 px-6 py-3.5 text-left hover:bg-ink-50/60">
                        <span className="w-6 text-right text-[12px] font-bold tabular-nums text-ink-400">{st.number}</span>
                        <span className="w-20 font-semibold">{st.name}</span>
                        <div className="relative hidden h-2 flex-1 overflow-hidden rounded-full bg-ink-100 sm:block">
                          <motion.div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-mint-500 to-brand-500" initial={{ width: 0 }} animate={{ width: `${st.summary.rate}%` }} transition={{ type: "spring", stiffness: 80, damping: 20, delay: i * 0.02 }} />
                        </div>
                        <span className="w-14 text-right text-[13.5px] font-bold tabular-nums">{st.summary.rate}%</span>
                        <div className="hidden gap-1 md:flex">
                          {(["late", "absent", "earlyLeave"] as const).map((k) => st.summary[k] > 0 && (
                            <Badge key={k} className={STATUS_META[k === "late" ? "LATE" : k === "absent" ? "ABSENT" : "EARLY_LEAVE"].soft}>{STATUS_META[k === "late" ? "LATE" : k === "absent" ? "ABSENT" : "EARLY_LEAVE"].label} {st.summary[k]}</Badge>
                          ))}
                        </div>
                        <ChevronDown className={clsx("h-4 w-4 text-ink-400 transition", open === st.usId && "rotate-180")} />
                      </button>
                      <AnimatePresence initial={false}>
                        {open === st.usId && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-ink-50/60">
                            <div className="overflow-x-auto px-6 py-4">
                              {st.months.length === 0 ? <div className="text-[13px] text-ink-500">해당 기간의 출결 기록이 없습니다.</div> : (
                                <table className="w-full min-w-[560px] text-[13px]">
                                  <thead><tr className="text-ink-500">{["월", "출석", "지각", "결석", "조퇴", "보류", "GPS/QR/수동", "확인", "출석률"].map((h) => <th key={h} className="py-1.5 text-left font-semibold">{h}</th>)}</tr></thead>
                                  <tbody>
                                    {st.months.map((m) => (
                                      <tr key={m.month} className="border-t border-ink-200/60">
                                        <td className="py-2 font-semibold">{m.month}</td>
                                        <td>{m.summary.present}</td><td>{m.summary.late}</td><td>{m.summary.absent}</td><td>{m.summary.earlyLeave}</td><td>{m.summary.pending}</td>
                                        <td>{m.summary.gps}/{m.summary.qr}/{m.summary.manual}</td>
                                        <td>{m.summary.confirmed}/{m.summary.total}</td>
                                        <td className="font-bold">{m.summary.rate}%</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </div>
              )}
          </Card>
        </>
      )}
    </>
  );
}
