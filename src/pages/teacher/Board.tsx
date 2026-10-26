import { motion } from "framer-motion";
import clsx from "clsx";
import { BellRing, CalendarDays, CheckCheck, ChevronLeft, ChevronRight, CircleDashed, Clock, History, LogOut, Sparkles, UserCheck, UserX, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/api/client";
import type { Attendance, AttStatus, Summary } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import InactiveClassNotice from "./InactiveClassNotice";
import { AttendanceRecordList, METHOD_ICON, SummaryDonut } from "@/components/attendance";
import { Avatar, Badge, Button, ButtonLink, Card, EmptyState, ErrorState, Modal, PageHeader, Segmented, Select, Skeleton, StatCard, Textarea } from "@/components/ui";
import { formatDate, formatTime, STATUS_META, toISODate } from "@/lib/format";
import { useAction, useAsync } from "@/lib/hooks";

interface BoardCell { perNo: number; attendance: Attendance | null; special: string | null }
interface BoardStudent { usId: number; name: string; number: number; studentId: number; profileImageUrl: string | null; cells: BoardCell[] }
interface Board { date: string; classLabel: string; currentPerNo: number | null; periods: { perNo: number; start: string; end: string; phase: string }[]; students: BoardStudent[]; summary: Summary }

const MANUAL_STATUSES: { value: AttStatus; label: string }[] = [
  { value: "PRESENT", label: "출석 인정" }, { value: "LATE", label: "지각" }, { value: "ABSENT", label: "결석" }, { value: "EARLY_LEAVE", label: "조퇴" },
];

export function ManualModal({ open, onClose, student, date, periods, initialPer, onDone }: {
  open: boolean; onClose: () => void; student: { usId: number; name: string } | null; date: string; periods: number[]; initialPer?: number; onDone: () => void;
}) {
  const [status, setStatus] = useState<AttStatus | "">("");
  const [reasonType, setReasonType] = useState("ILLNESS");
  const [reason, setReason] = useState("");
  const [pers, setPers] = useState<number[]>([]);
  const { run, pending } = useAction();
  const [lastKey, setLastKey] = useState("");
  const key = `${student?.usId}-${initialPer}-${open}`;
  if (key !== lastKey) { setLastKey(key); setPers(initialPer ? [initialPer] : []); setStatus(""); setReason(""); setReasonType("ILLNESS"); }

  const submit = async () => {
    const r = await run(() => api.post("/teacher/attendance/manual", { usId: student!.usId, date, perNos: pers, status: status || null, reasonType, reason }), "출결이 수동 처리되었습니다.");
    if (r !== undefined) { onDone(); onClose(); }
  };
  const toggle = (p: number) => setPers((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));
  const fromHere = (p: number) => setPers(periods.filter((x) => x >= p));

  return (
    <Modal open={open} onClose={onClose} title={`${student?.name ?? ""} 출결 수동 처리`} description={`${formatDate(date)} · 출석/지각 외 조퇴·결석 등은 사유와 함께 기록돼요.`}
      footer={<><Button variant="secondary" onClick={onClose}>취소</Button><Button onClick={submit} loading={pending}>처리하기</Button></>}>
      <div className="space-y-5">
        <div>
          <div className="label">출결 상태 <span className="text-brand-500">*</span></div>
          <div className="grid grid-cols-4 gap-2">
            {MANUAL_STATUSES.map((s) => (
              <motion.button key={s.value} whileTap={{ scale: 0.96 }} type="button" aria-pressed={status === s.value} onClick={() => setStatus(s.value)}
                className={clsx("rounded-xl py-3 text-[13.5px] font-bold ring-1 transition", status === s.value ? `${STATUS_META[s.value].soft} ring-2` : "bg-white text-ink-500 ring-ink-200 hover:ring-ink-300")}>
                {s.label}
              </motion.button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="label !mb-0">교시 <span className="text-brand-500">*</span></span>
            {status === "EARLY_LEAVE" && pers.length > 0 && <button onClick={() => fromHere(Math.min(...pers))} className="text-[12px] font-semibold text-brand-600">{Math.min(...pers)}교시부터 끝까지</button>}
          </div>
          <div className="flex flex-wrap gap-2">
            {periods.map((p) => (
              <button key={p} type="button" aria-pressed={pers.includes(p)} aria-label={`${p}교시`} onClick={() => toggle(p)} className={clsx("focus-ring h-10 w-12 rounded-xl text-[14px] font-bold ring-1 transition", pers.includes(p) ? "bg-brand-500 text-white ring-brand-500" : "bg-white text-ink-500 ring-ink-200")}>{p}</button>
            ))}
          </div>
        </div>
        <Select label="사유 구분" value={reasonType} onChange={(e) => setReasonType(e.target.value)}>
          <option value="ILLNESS">질병</option><option value="UNEXCUSED">무단(미인정)</option><option value="OTHER">기타</option>
        </Select>
        <Textarea label="수동 처리 사유" required placeholder="예) 감기에 걸려 병원 진료" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      </div>
    </Modal>
  );
}

export function StudentDetailModal({ usId, onClose }: { usId: number | null; onClose: () => void }) {
  const [tab, setTab] = useState<"records" | "history">("records");
  const end = toISODate(new Date());
  const startD = new Date(); startD.setDate(startD.getDate() - 60);
  const detail = useAsync(() => (usId ? api.get<{ name: string; number: number; studentId: number; summary: Summary; records: Attendance[] }>(`/teacher/attendance/students/${usId}`, { start: toISODate(startD), end }) : Promise.resolve(null)), [usId]);
  const history = useAsync(() => (usId ? api.get<{ histories: { ahId: number; date: string; perNo: number; oldStatus: AttStatus | null; newStatus: AttStatus; reason: string; changedBy: string; changedAt: string }[] }>("/teacher/attendance/history", { usId }) : Promise.resolve(null)), [usId]);
  return (
    <Modal open={!!usId} onClose={onClose} size="lg" title={detail.data ? `${detail.data.number}번 ${detail.data.name}` : "학생 출결"} description={detail.data ? `학번 ${detail.data.studentId} · 최근 60일` : undefined}>
      {detail.error ? <ErrorState error={detail.error} onRetry={() => detail.reload()} /> : detail.loading || !detail.data ? <Skeleton className="h-60" /> : (
        <div className="space-y-5">
          <SummaryDonut summary={detail.data.summary} />
          <Segmented value={tab} onChange={setTab} options={[{ value: "records", label: "출결 기록" }, { value: "history", label: "수동 처리 이력" }]} />
          {tab === "records" ? <AttendanceRecordList records={detail.data.records} /> : history.error ? <ErrorState error={history.error} onRetry={() => history.reload()} /> : (
            <div className="space-y-2">
              {history.data?.histories.map((h) => (
                <div key={h.ahId} className="flex items-start gap-3 rounded-xl bg-ink-50 p-3.5">
                  <History className="mt-0.5 h-4 w-4 text-ink-400" />
                  <div className="flex-1 text-[13.5px]">
                    <div className="font-semibold">{formatDate(h.date)} {h.perNo}교시 · {h.oldStatus ? STATUS_META[h.oldStatus].label : "미기록"} → <span className={STATUS_META[h.newStatus].tone}>{STATUS_META[h.newStatus].label}</span></div>
                    <div className="text-ink-500">{h.reason}</div>
                    <div className="mt-0.5 text-[11.5px] text-ink-400">{h.changedBy} · {formatDate(h.changedAt, false)} {formatTime(h.changedAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function TeacherBoard() {
  const { profile } = useAuth();
  // 기본 날짜는 서버 기준 오늘 (시연 시각 DEMO_NOW 포함)
  const [picked, setPicked] = useState<string | null>(null);
  const { data, loading, error, reload } = useAsync(() => api.get<Board>("/teacher/attendance/board", { date: picked ?? undefined }), [picked]);
  const date = picked ?? data?.date ?? toISODate(new Date());
  const setDate = (d: string | ((cur: string) => string)) => setPicked(typeof d === "function" ? d(date) : d);
  const [manual, setManual] = useState<{ student: BoardStudent; per?: number } | null>(null);
  const [detail, setDetail] = useState<number | null>(null);
  const { run, pending } = useAction();
  const move = (d: number) => setDate((cur) => { const n = new Date(`${cur}T00:00:00`); n.setDate(n.getDate() + d); return toISODate(n); });

  if (error?.code === "CLASS406") {
    return (
      <>
        <PageHeader title="출결 현황" />
        <InactiveClassNotice label={profile?.schoolClass?.label ?? "담임 학급"} onActivated={() => reload()} />
        <div className="mt-4 text-center"><Link to="/teacher/stats" className="text-[13px] font-bold text-brand-600 hover:underline">비활성 동안에도 출결 통계는 볼 수 있어요 →</Link></div>
      </>
    );
  }
  if (error?.code === "CLASS408") {
    return (
      <>
        <PageHeader title="출결 현황" />
        <Card><EmptyState icon={<Users className="h-6 w-6" />} title={error.message} description="학교 관리자가 만든 학급에 담임으로 들어가면 출결 현황을 볼 수 있어요."
          action={<ButtonLink to="/teacher/join">학급 들어가기</ButtonLink>} /></Card>
      </>
    );
  }

  const s = data?.summary;
  const studentCount = data?.students.length ?? 0;
  const slots = studentCount * (data?.periods.length ?? 0);
  const unchecked = Math.max(slots - (s?.total ?? 0), 0);

  return (
    <>
      <PageHeader eyebrow={data?.classLabel ?? profile?.schoolClass?.label} title="출결 현황"
        description="셀을 눌러 조퇴·결석 등 출결을 수동 처리하고, 학생 이름을 눌러 상세 기록을 확인하세요."
        actions={<>
          <div className="flex items-center gap-1 rounded-xl bg-white p-1 ring-1 ring-ink-200">
            <button type="button" onClick={() => move(-1)} className="focus-ring rounded-lg p-2 hover:bg-ink-100" aria-label="이전 날"><ChevronLeft className="h-4 w-4" /></button>
            {/* 날짜는 한국어로 보여주고, 누르면 달력이 열립니다. (브라우저 기본 표시는 10/25/2026처럼 지역 설정을 따름) */}
            <label className="relative flex min-w-[124px] cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-[13.5px] font-bold focus-within:outline focus-within:outline-2 focus-within:outline-brand-500 hover:bg-ink-100">
              <CalendarDays className="h-4 w-4 text-ink-400" />{formatDate(date)}
              <input type="date" value={date} aria-label="날짜 선택" onChange={(e) => e.target.value && setDate(e.target.value)}
                onClick={(e) => (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()} className="absolute inset-0 cursor-pointer opacity-0" />
            </label>
            <button type="button" onClick={() => move(1)} className="focus-ring rounded-lg p-2 hover:bg-ink-100" aria-label="다음 날"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <Button variant="secondary" icon={<BellRing className="h-4 w-4" />} loading={pending} onClick={() => run(() => api.post("/teacher/attendance/summary-notification", { kind: "MORNING" }), "출석 현황 알림을 보냈습니다.")}>현황 알림</Button>
          <Button icon={<CheckCheck className="h-4 w-4" />} onClick={async () => { const r = await run(() => api.post<{ confirmed: number }>("/teacher/attendance/confirm", { date })); if (r) { toast.success(`${r.confirmed}건의 출결을 확인 완료했습니다.`); reload(true); } }}>확인 완료</Button>
        </>} />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="출석" value={s?.present ?? 0} icon={<UserCheck className="h-4 w-4" />} tone="mint" />
        <StatCard label="지각" value={s?.late ?? 0} icon={<Clock className="h-4 w-4" />} tone="amber" delay={0.04} />
        <StatCard label="결석" value={s?.absent ?? 0} icon={<UserX className="h-4 w-4" />} tone="rose" delay={0.08} />
        <StatCard label="조퇴" value={s?.earlyLeave ?? 0} icon={<LogOut className="h-4 w-4" />} tone="sky" delay={0.12} />
        <StatCard label="미확인" value={unchecked} icon={<CircleDashed className="h-4 w-4" />} tone="brand" delay={0.16} sub={`전체 ${studentCount}명 · ${data?.periods.length ?? 0}교시`} />
      </div>

      <Card className="overflow-hidden">
        {loading && !data ? <div className="space-y-2 p-5">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          : error && !data ? <ErrorState error={error} title="출결 현황을 불러오지 못했어요" onRetry={() => reload()} />
          : !data || data.periods.length === 0 ? <EmptyState title="수업이 없는 날입니다" description="주말이거나 교시표가 등록되지 않았습니다." />
          : data.students.length === 0 ? <EmptyState icon={<Users className="h-6 w-6" />} title="학급에 학생이 없습니다" action={<ButtonLink to="/teacher/members">학생 등록하기</ButtonLink>} />
          : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-[760px] border-separate border-spacing-0 text-[13.5px]">
                <thead>
                  <tr className="bg-ink-50/80">
                    <th className="sticky left-0 z-10 bg-ink-50 px-5 py-3 text-left font-semibold text-ink-500">학생</th>
                    {data.periods.map((p) => (
                      <th key={p.perNo} className={clsx("px-2 py-3 text-center font-semibold", p.perNo === data.currentPerNo ? "text-brand-600" : "text-ink-500")}>
                        <div className="flex flex-col items-center">
                          <span>{p.perNo}교시</span>
                          <span className="text-[10.5px] font-medium text-ink-400">{p.start}</span>
                          {p.perNo === data.currentPerNo && <motion.span layoutId="cur-per" className="mt-1 h-1 w-6 rounded-full bg-brand-500" />}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* 학생 × 교시 칸이 수백 개라 칸마다 애니메이션 컴포넌트를 두지 않고 CSS 전환만 씁니다. (렌더링 비용 감소) */}
                  {data.students.map((st) => (
                      <tr key={st.usId} className="group">
                        <td className="sticky left-0 z-10 border-t border-ink-100 bg-white px-5 py-2.5 group-hover:bg-ink-50/60">
                          <button type="button" onClick={() => setDetail(st.usId)} className="focus-ring flex items-center gap-2.5 rounded-lg text-left" aria-label={`${st.number}번 ${st.name} 출결 상세 보기`}>
                            <span className="w-6 text-right text-[12px] font-bold tabular-nums text-ink-400">{st.number}</span>
                            <Avatar src={st.profileImageUrl} name={st.name} size={30} />
                            <span className="font-semibold hover:text-brand-600">{st.name}</span>
                          </button>
                        </td>
                        {st.cells.map((c) => {
                          const a = c.attendance;
                          const meta = a ? STATUS_META[a.status] : null;
                          return (
                            <td key={c.perNo} className="border-t border-ink-100 px-1.5 py-2 text-center group-hover:bg-ink-50/60">
                              {c.special ? (
                                <span title={c.special} className="inline-flex h-9 w-full max-w-[96px] items-center justify-center gap-1 rounded-lg bg-amber-50 text-[11.5px] font-semibold text-amber-600 ring-1 ring-amber-500/20"><Sparkles className="h-3 w-3" />일정</span>
                              ) : (
                                <button type="button" onClick={() => setManual({ student: st, per: c.perNo })}
                                  disabled={!profile?.active}
                                  aria-label={`${st.name} ${c.perNo}교시 ${meta ? meta.label : "기록 없음"}${a && !a.isConfirmed ? " (미확인)" : ""}${profile?.active ? ", 눌러서 수동 처리" : ""}`}
                                  className={clsx("focus-ring relative inline-flex h-9 w-full max-w-[96px] items-center justify-center gap-1 rounded-lg text-[12px] font-bold ring-1 ring-inset transition enabled:hover:brightness-95 enabled:active:scale-95 disabled:cursor-default",
                                    meta ? meta.soft : "bg-white text-ink-300 ring-ink-200 hover:text-ink-500")}>
                                  {a ? <>{METHOD_ICON[a.method]}{meta!.label}</> : "–"}
                                  {a && !a.isConfirmed && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-brand-500" title="미확인" />}
                                  {a?.lessonType === "MOVING" && (
                                    <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded bg-white px-1 text-[9.5px] font-bold text-teal-600 ring-1 ring-teal-200"
                                      title={`이동수업 · ${a.lessonSubject ?? ""} · ${a.lessonRoom ?? ""} · 담당 ${a.lessonTeacherName ?? "담임"}`}>이동 {a.lessonRoom}</span>
                                  )}
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        <div className="flex flex-wrap items-center gap-3 border-t border-ink-100 px-5 py-3 text-[12px] text-ink-500">
          {(["PRESENT", "LATE", "ABSENT", "EARLY_LEAVE", "PENDING"] as AttStatus[]).map((k) => <span key={k} className="flex items-center gap-1"><span className={clsx("h-2 w-2 rounded-full", STATUS_META[k].dot)} />{STATUS_META[k].label}</span>)}
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-brand-500" />미확인 출결</span>
          {s && <Badge className="ml-auto bg-mint-50 text-mint-600 ring-mint-500/20">출석률 {s.rate}%</Badge>}
        </div>
      </Card>

      <ManualModal open={!!manual} onClose={() => setManual(null)} student={manual?.student ?? null} date={date} periods={data?.periods.map((p) => p.perNo) ?? []} initialPer={manual?.per} onDone={() => reload(true)} />
      <StudentDetailModal usId={detail} onClose={() => setDetail(null)} />
    </>
  );
}
