import { motion } from "framer-motion";
import clsx from "clsx";
import { CheckCheck, ChevronLeft, ChevronRight, CircleDashed, Clock, Info, Shuffle, UserCheck, UserX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/api/client";
import type { Attendance, Summary } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import ClassTabs from "@/components/ClassTabs";
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, StatCard } from "@/components/ui";
import { formatTime, STATUS_META, toISODate, WEEKDAYS } from "@/lib/format";
import { useAction, useAsync } from "@/lib/hooks";
import { ManualModal } from "./Board";

interface Cell { date: string; perNo: number; attendance: Attendance; editable: boolean }
// 이동수업 반 학생: 담임 학급 대신 학번·배정 분반으로 구분 · inRoster=false: 배정 명단 밖이지만 나에게 전달된 기록
interface WeekStudent { usId: number; name: string; studentId: number | null; cells: Cell[]; groupCode?: string | null; inRoster?: boolean }
// teacherName: 수업(출결 담당) 교사 — 시간표상 이 이동수업 반의 수업 교사(나)
// studentCount: 반 구성원(가입·승인 학생) · excelCount: 학년 배정 엑셀에서 이 교실·과목으로 배정된 인원(미가입 포함)
interface Category {
  key: string; kind: "MOVING"; label: string; subject: string | null; room: string | null;
  sessions: { date: string; perNo: number }[]; students: WeekStudent[]; summary: Summary;
  teacherName?: string | null; studentCount?: number; excelCount?: number | null;
}
const memberText = (c: Category) => c.excelCount != null && c.excelCount !== c.students.length
  ? `학생 ${c.students.length}명 (배정 ${c.excelCount}명)` : `학생 ${c.students.length}명`;
interface WeekLessons { start: string; end: string; categories: Category[]; timetableProjected: boolean }

const mondayOf = (iso: string) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return toISODate(d); };
// 기준 주: 평일이면 이번 주, 토·일이면 다가오는 주 (시간표 화면의 '오늘부터 일주일'과 같은 기준)
const currentWeek = (iso: string) => { const day = new Date(`${iso}T00:00:00`).getDay(); return day === 0 || day === 6 ? shiftDays(mondayOf(iso), 7) : mondayOf(iso); };
const shiftDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return toISODate(d); };
const md = (iso: string) => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`;
// 수업 교시 요약: [{월,2},{화,4}] → "월2 · 화4" (없으면 "이번 주 수업 없음")
const slotText = (sessions: { date: string; perNo: number }[]) =>
  sessions.length ? sessions.map((s) => `${WEEKDAYS[(new Date(`${s.date}T00:00:00`).getDay() + 6) % 7]}${s.perNo}`).join(" · ") : "이번 주 수업 없음";
const weekday = (iso: string) => WEEKDAYS[(new Date(`${iso}T00:00:00`).getDay() + 6) % 7];

// *
// 이동수업 출결 (교사, 이동수업 전용 — 담임반·담임 학급 항목 없음. 담임 학급 출결은 '출결 현황'에서 봅니다)
// GET  /teacher/attendance/lessons/week?start=YYYY-MM-DD — 내가 수업하는 이동수업 반(교실·과목)별 월~금 출결, 학생은 이동수업 배정 엑셀 기준
// POST /teacher/attendance/lessons/week/confirm {start} — 그 주 내가 담당인 이동수업 출결 확인 완료
// 칸을 누르면 수동 처리 (내가 담당인 기록, 기록이 없으면 배정 학생의 내 수업 교시 — 최종 권한은 서버가 확인)
// *
export default function TeacherLessons() {
  const { profile } = useAuth();
  const today = toISODate(new Date());
  const [start, setStart] = useState(currentWeek(today));
  const { data, loading, error, reload } = useAsync(() => api.get<WeekLessons>("/teacher/attendance/lessons/week", { start }), [start]);
  const { run, pending } = useAction();
  const [picked, setPicked] = useState<string>("");
  const [manual, setManual] = useState<{ student: WeekStudent; date: string; per: number } | null>(null);

  // 고른 반이 그 주에 없으면 첫 번째 이동수업 반을 엽니다.
  useEffect(() => { if (data?.categories.length && !data.categories.some((c) => c.key === picked)) setPicked(data.categories[0].key); }, [data, picked]);
  const current = data?.categories.find((c) => c.key === picked);
  const unconfirmed = useMemo(() => (data?.categories ?? [])
    .flatMap((c) => c.students.flatMap((s) => s.cells)).filter((x) => x.editable && !x.attendance.isConfirmed && x.attendance.status !== "PENDING").length, [data]);
  const isThisWeek = start === currentWeek(today);

  return (
    <>
      <PageHeader title="이동수업 출결" description="내가 수업하는 이동수업 반을 골라 한 주 출결을 확인·처리하세요. 학생은 관리자가 올린 이동수업 배정 엑셀 기준이며(담임 학급과 무관), 그 수업 교시 출결은 수업 교사인 나에게 모입니다."
        actions={<>
          <div className="flex items-center gap-1 rounded-xl bg-white p-1 ring-1 ring-ink-200">
            <button type="button" onClick={() => setStart(shiftDays(start, -7))} className="focus-ring rounded-lg p-2 hover:bg-ink-100" aria-label="지난주"><ChevronLeft className="h-4 w-4" /></button>
            <span className="px-2 text-[13.5px] font-bold tabular-nums">{md(start)} ~ {md(shiftDays(start, 4))}</span>
            <button type="button" onClick={() => setStart(shiftDays(start, 7))} className="focus-ring rounded-lg p-2 hover:bg-ink-100" aria-label="다음 주"><ChevronRight className="h-4 w-4" /></button>
          </div>
          {!isThisWeek && <Button variant="secondary" onClick={() => setStart(currentWeek(today))}>이번 주</Button>}
          {profile?.active && (
            <Button variant="secondary" icon={<CheckCheck className="h-4 w-4" />} loading={pending} disabled={!unconfirmed}
              onClick={async () => { const r = await run(() => api.post("/teacher/attendance/lessons/week/confirm", { start }), "이번 주 이동수업 출결을 확인 완료 처리했습니다."); if (r !== undefined) reload(true); }}>
              확인 완료{unconfirmed ? ` (${unconfirmed})` : ""}
            </Button>
          )}
        </>} />

      {loading ? (
        <div className="space-y-3"><Skeleton className="h-14" /><Skeleton className="h-72" /></div>
      ) : error ? (
        <Card><ErrorState error={error} onRetry={() => reload()} /></Card>
      ) : !data?.categories.length ? (
        <Card><EmptyState icon={<Shuffle className="h-6 w-6" />} title="이 주에 내가 수업하는 이동수업 반이 없어요."
          description="동기화된 시간표에서 내 계정에 연결된 이동수업 과목 수업이 없습니다. 시간표는 관리자의 '시간표 연동'으로 이번 주·다음 주가 동기화되고, 이동수업 과목은 학년 이동수업 배정 엑셀 기준이에요. 담임 학급 출결은 '출결 현황'에서 확인하세요." /></Card>
      ) : (
        <>
          {/* 이동수업 반(교실 · 과목) */}
          <ClassTabs label="이동수업 반 선택" value={picked} onChange={setPicked} tabs={data.categories.map((c) => ({
            key: c.key, kind: c.kind, label: c.label,
            // 그 주 수업 요일·교시 (예: 월2 · 화4 · 목7) — 횟수를 '3교시'로 쓰면 교시 번호로 오해돼서 요일·교시를 직접 보여줍니다.
            sub: `${slotText(c.sessions)} · ${memberText(c)}`,
          }))} />

          {data.timetableProjected && (
            <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-[12.5px] text-amber-700 ring-1 ring-amber-500/20">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />이 주 시간표는 아직 동기화되지 않아, 가장 가까운 주 시간표의 요일·교시로 수업 칸을 표시했어요. 출결 기록은 실제 날짜 그대로예요.
            </div>
          )}
          {current && (
            <motion.div key={`${start}-${current.key}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="출석" value={current.summary.present} tone="mint" icon={<UserCheck className="h-4 w-4" />} />
                <StatCard label="지각" value={current.summary.late} tone="amber" delay={0.05} icon={<Clock className="h-4 w-4" />} />
                <StatCard label="보류" value={current.summary.pending} tone="sky" delay={0.1} icon={<CircleDashed className="h-4 w-4" />} />
                <StatCard label="결석·조퇴" value={current.summary.absent + current.summary.earlyLeave} tone="rose" delay={0.15} icon={<UserX className="h-4 w-4" />} />
              </div>
              <WeekGrid category={current} start={start} today={today} canEdit={!!profile?.active}
                onCell={(student, date, per) => setManual({ student, date, per })} />
            </motion.div>
          )}
        </>
      )}

      <ManualModal open={!!manual} onClose={() => setManual(null)} student={manual ? { usId: manual.student.usId, name: manual.student.name } : null}
        date={manual?.date ?? today} periods={manual ? [manual.per] : []} initialPer={manual?.per} onDone={() => reload(true)} />
    </>
  );
}

// 학생 × (요일 · 교시) 주간 표. 이 이동수업 반의 수업 교시만 열로 보여줍니다.
function WeekGrid({ category: c, start, today, canEdit, onCell }: {
  category: Category; start: string; today: string; canEdit: boolean; onCell: (s: WeekStudent, date: string, per: number) => void;
}) {
  const days = useMemo(() => Array.from({ length: 5 }, (_, i) => shiftDays(start, i)).map((d) => ({ date: d, pers: c.sessions.filter((s) => s.date === d).map((s) => s.perNo) })), [c, start]);
  const cols = days.filter((d) => d.pers.length);

  if (!c.students.length) {
    return (
      <Card>
        <EmptyState icon={<Shuffle className="h-6 w-6" />} title="이 반에 배정된 학생 중 앱에 등록된 학생이 아직 없어요."
          description={`${c.excelCount ? `이동수업 배정 엑셀에는 ${c.excelCount}명이 이 교실·과목으로 배정되어 있어요. 학생이 자기 학급에 가입·승인되면 자동으로 이 명단에 들어옵니다. ` : "관리자가 학년 이동수업 배정 엑셀을 올리면 배정된 학생이 이 명단에 들어옵니다. "}이 주 수업: ${cols.map((d) => `${weekday(d.date)} ${d.pers.join("·")}교시`).join(", ") || "없음"}`} />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 px-5 py-3">
        <span className="font-extrabold">{c.label}</span>
        <Badge className="bg-teal-50 text-teal-600 ring-1 ring-teal-200">이동수업</Badge>
        {c.teacherName && <span className="text-[12.5px] text-ink-500">수업 교사 <b className="font-semibold text-ink-700">{c.teacherName}</b></span>}
        <span className="text-[12.5px] text-ink-400">· {memberText(c)}</span>
        <span className="ml-auto flex flex-wrap items-center gap-2.5 text-[11.5px] text-ink-500">
          {Object.entries(STATUS_META).map(([k, m]) => <span key={k} className="flex items-center gap-1"><span className={clsx("h-2 w-2 rounded-full", m.dot)} />{m.label}</span>)}
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-brand-500" />미확인</span>
        </span>
      </div>
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[12.5px]">
          <thead>
            <tr>
              <th rowSpan={2} className="sticky left-0 z-10 min-w-[132px] border-b border-ink-100 bg-white px-4 py-2 text-left font-bold text-ink-500">학생</th>
              {cols.map((d) => (
                <th key={d.date} colSpan={d.pers.length} className={clsx("border-b border-l border-ink-100 px-2 py-2 text-center font-bold", d.date === today ? "bg-brand-50 text-brand-700" : "text-ink-600")}>
                  {weekday(d.date)} <span className="font-medium text-ink-400">{Number(d.date.slice(8, 10))}일</span>
                </th>
              ))}
            </tr>
            <tr>
              {cols.flatMap((d) => d.pers.map((p, i) => (
                <th key={`${d.date}-${p}`} className={clsx("border-b border-ink-100 px-1 py-1.5 text-center text-[11px] font-semibold text-ink-400", i === 0 && "border-l", d.date === today && "bg-brand-50/60")}>{p}</th>
              )))}
            </tr>
          </thead>
          <tbody>
            {c.students.map((s) => {
              const byKey = new Map(s.cells.map((x) => [`${x.date}|${x.perNo}`, x]));
              return (
                <tr key={s.usId} className="hover:bg-ink-50/60">
                  <td className="sticky left-0 z-10 border-b border-ink-100 bg-white px-4 py-2">
                    <div className="font-bold">{s.name}</div>
                    <div className="text-[11px] text-ink-400">{s.studentId ? `학번 ${s.studentId}` : "학번 없음"}{s.groupCode ? ` · ${s.groupCode}` : ""}
                      {s.inRoster === false && <span className="ml-1 rounded bg-amber-50 px-1 text-amber-700" title="이동수업 배정 명단에는 없지만 시간표상 나에게 전달된 출결이에요.">명단 외</span>}</div>
                  </td>
                  {cols.flatMap((d) => d.pers.map((p, i) => {
                    const x = byKey.get(`${d.date}|${p}`);
                    // 기록이 없는 칸: 이 반에 배정된 학생이면 내 수업 교시이므로 처리 가능 — 최종 권한은 서버가 확인
                    const editable = canEdit && (x ? x.editable : s.inRoster !== false);
                    const meta = x ? STATUS_META[x.attendance.status] : null;
                    const title = x ? `${weekday(d.date)} ${p}교시 · ${meta!.label}${x.attendance.checkedAt ? ` (확인 ${formatTime(x.attendance.checkedAt)}${x.attendance.receivedAt && formatTime(x.attendance.receivedAt) !== formatTime(x.attendance.checkedAt) ? ` · 수신 ${formatTime(x.attendance.receivedAt)}` : ""})` : ""}${x.attendance.lessonSubject ? ` · ${x.attendance.lessonSubject}` : ""}` : `${weekday(d.date)} ${p}교시 · 기록 없음`;
                    return (
                      <td key={`${d.date}-${p}`} className={clsx("border-b border-ink-100 p-1 text-center", i === 0 && "border-l", d.date === today && "bg-brand-50/40")}>
                        <button type="button" title={title} aria-label={`${s.name} ${title}`} disabled={!editable} onClick={() => onCell(s, d.date, p)}
                          className={clsx("focus-ring relative mx-auto grid h-8 w-9 place-items-center rounded-lg text-[11.5px] font-bold ring-1 ring-inset transition disabled:cursor-default",
                            meta ? meta.soft : "text-ink-300 ring-ink-200/70", editable && "hover:scale-105 hover:shadow")}>
                          {meta ? meta.label[0] : "·"}
                          {x && !x.attendance.isConfirmed && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-brand-500" />}
                        </button>
                      </td>
                    );
                  }))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t border-ink-100 px-5 py-2.5 text-[12px] text-ink-500">이 반에 배정된 학생의 이 수업 교시 출결만 보여요. 다른 선생님이 담당인 기록은 조회만 할 수 있어요.</div>
    </Card>
  );
}
