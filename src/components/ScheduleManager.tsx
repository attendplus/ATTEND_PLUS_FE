import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { CalendarClock, CalendarPlus, ChevronLeft, ChevronRight, Pencil, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/api/client";
import type { ScheduleItem } from "@/api/types";
import { useConfirm } from "@/components/ConfirmDialog";
import { Badge, Button, Card, Checkbox, EmptyState, ErrorState, IconButton, Input, Modal, PageHeader, Segmented, Select, Skeleton, Textarea } from "@/components/ui";
import { formatDate, formatTime, toISODate } from "@/lib/format";

const STATUS_LABEL = { UPCOMING: "예정", ONGOING: "진행 중", ENDED: "종료" } as const;
const STATUS_TONE = { UPCOMING: "bg-sky-50 text-sky-500 ring-sky-500/20", ONGOING: "bg-mint-50 text-mint-600 ring-mint-500/20", ENDED: "bg-ink-100 text-ink-500 ring-ink-400/20" } as const;
import { useAction, useAsync } from "@/lib/hooks";

type Mode = "teacher" | "admin";
const SCOPE_TONE: Record<ScheduleItem["scope"], string> = {
  SCHOOL: "bg-brand-50 text-brand-700 ring-brand-200", GRADE: "bg-sky-50 text-sky-500 ring-sky-500/20",
  CLASS: "bg-mint-50 text-mint-600 ring-mint-500/20", STUDENT: "bg-amber-50 text-amber-600 ring-amber-500/20",
};

interface Student { usId: number; name: string; number: number }

function ScheduleForm({ mode, open, onClose, editing, periods, students, onDone }: {
  mode: Mode; open: boolean; onClose: () => void; editing: ScheduleItem | null; periods: number[]; students: Student[]; onDone: () => void;
}) {
  const defaultScope = mode === "teacher" ? "STUDENT" : "SCHOOL";
  const [scope, setScope] = useState<string>(defaultScope);
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(toISODate(new Date()));
  const [allDay, setAllDay] = useState(false);
  const [pers, setPers] = useState<number[]>([]);
  const [studentIds, setStudentIds] = useState<number[]>([]);
  const [grade, setGrade] = useState("1");
  const [consent, setConsent] = useState(false);
  const { run, pending } = useAction();

  useEffect(() => {
    if (!open) return;
    setScope(editing?.scope ?? defaultScope); setTitle(editing?.title ?? ""); setReason(editing?.reason ?? ""); setNote(editing?.note ?? "");
    setDate(editing?.date ?? toISODate(new Date())); setAllDay(editing?.allDay ?? false); setPers(editing?.perNos ?? []);
    setStudentIds(editing?.students.map((s) => s.usId) ?? []); setGrade(String(editing?.grade ?? 1)); setConsent(!!editing);
  }, [open, editing, defaultScope]);

  const classWide = scope === "CLASS";
  const submit = async () => {
    const body = { scope, title, reason, note: note || null, date, allDay: classWide || allDay, perNos: pers, studentIds, grade: scope === "GRADE" ? Number(grade) : null, consent };
    const base = mode === "teacher" ? "/teacher/schedules" : "/admin/schedules";
    const r = await run(() => (editing ? api.put(`${base}/${editing.schId}`, body) : api.post(base, body)), editing ? "일정을 수정했습니다." : "특별 일정을 등록했습니다.");
    if (r !== undefined) { onDone(); onClose(); }
  };
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <Modal open={open} onClose={onClose} size="lg" title={editing ? "특별 일정 수정" : "특별 일정 등록"} description="일정이 등록된 교시에는 GPS · QR 출결 체크를 하지 않습니다."
      footer={<><Button variant="secondary" onClick={onClose}>취소</Button><Button onClick={submit} loading={pending}>{editing ? "수정" : "등록"}</Button></>}>
      <div className="space-y-4">
        <Segmented value={scope} onChange={setScope} options={mode === "teacher"
          ? [{ value: "STUDENT", label: "학생과 일정" }, { value: "CLASS", label: "학급 전체 일정" }]
          : [{ value: "SCHOOL", label: "학교 전체" }, { value: "GRADE", label: "학년별" }]} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="일정 제목" required placeholder={mode === "teacher" ? "예) 2교시 진로 면담" : "예) 체육대회"} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
          <Input label="날짜" required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <Textarea label="일정 사유" required placeholder="예) 진로 상담" value={reason} onChange={(e) => setReason(e.target.value)} />
        {scope === "GRADE" && (
          <Select label="학년" required value={grade} onChange={(e) => setGrade(e.target.value)}>{[1, 2, 3].map((g) => <option key={g} value={g}>{g}학년</option>)}</Select>
        )}
        <div>
          <div className="label">시간 <span className="text-brand-500">*</span></div>
          {classWide ? <div className="rounded-xl bg-ink-50 px-4 py-3 text-[13.5px] text-ink-500">학급 전체 일정은 종일로 등록됩니다.</div> : (
            <div className="flex flex-wrap gap-2">
              {periods.map((p) => (
                <button key={p} type="button" disabled={allDay} onClick={() => setPers(toggle(pers, p))}
                  className={clsx("h-10 rounded-xl px-3.5 text-[13.5px] font-bold ring-1 transition disabled:opacity-40", pers.includes(p) && !allDay ? "bg-brand-500 text-white ring-brand-500" : "bg-white text-ink-500 ring-ink-200")}>{p}교시</button>
              ))}
              <button type="button" onClick={() => setAllDay(!allDay)} className={clsx("h-10 rounded-xl px-3.5 text-[13.5px] font-bold ring-1 transition", allDay ? "bg-brand-500 text-white ring-brand-500" : "bg-white text-ink-500 ring-ink-200")}>종일</button>
            </div>
          )}
        </div>
        {scope === "STUDENT" && (
          <div>
            <div className="label">학생 선택 <span className="text-brand-500">*</span> <span className="font-medium text-ink-400">{studentIds.length}명</span></div>
            <div className="scrollbar-thin grid max-h-44 grid-cols-2 gap-1.5 overflow-y-auto rounded-xl bg-ink-50 p-2 sm:grid-cols-3">
              {students.map((s) => (
                <button key={s.usId} type="button" onClick={() => setStudentIds(toggle(studentIds, s.usId))}
                  className={clsx("rounded-lg px-3 py-2 text-left text-[13px] font-semibold ring-1 transition", studentIds.includes(s.usId) ? "bg-white text-brand-700 ring-brand-300" : "bg-white/60 text-ink-600 ring-transparent hover:bg-white")}>
                  <span className="mr-1 text-ink-400">{s.number}</span>{s.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {mode === "teacher" && <Input label="참고 사항 (선택)" value={note} onChange={(e) => setNote(e.target.value)} />}
        {mode === "teacher" && <Checkbox checked={consent} onChange={setConsent}>해당 교시의 출결을 확인하지 않는 것에 동의합니다. <span className="text-brand-500">*</span></Checkbox>}
      </div>
    </Modal>
  );
}

export default function ScheduleManager({ mode }: { mode: Mode }) {
  const base = mode === "teacher" ? "/teacher/schedules" : "/admin/schedules";
  const { data, loading, error, reload } = useAsync(() => api.get<{ schedules: ScheduleItem[] }>(base), [base]);
  const periods = useAsync(async () => (mode === "teacher"
    ? (await api.get<{ periods: { perNo: number }[] }>("/timetable/week", { view: "teacher" })).periods
    : (await api.get<{ periods: { perNo: number }[] }>("/admin/school/periods")).periods).map((p) => p.perNo), [mode]);
  const students = useAsync(async () => (mode === "teacher" ? (await api.get<{ members: Student[] }>("/teacher/members")).members : []), [mode]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleItem | null>(null);
  const [filter, setFilter] = useState<ScheduleItem["status"]>("UPCOMING");
  // 월 필터: "YYYY-MM" 또는 "" (전체 기간). 처음에는 이번 달(KST)
  const [month, setMonth] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date()).slice(0, 7));
  const shiftMonth = (d: number) => setMonth((m) => {
    const [y, mo] = (m || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date()).slice(0, 7)).split("-").map(Number);
    const n = new Date(y, mo - 1 + d, 1);
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });
  const { run } = useAction();
  const { confirm, dialog } = useConfirm();

  const remove = async (s: ScheduleItem) => {
    if (!(await confirm({ title: `'${s.title}' 일정을 삭제할까요?`, description: "삭제하면 이 일정으로 제외했던 교시도 다시 출결 확인 대상이 되고, 되돌릴 수 없어요.", confirmLabel: "삭제", tone: "danger" }))) return;
    const r = await run(() => api.del(`${base}/${s.schId}`), "일정을 삭제했습니다.");
    if (r !== undefined) reload(true);
  };
  // 상태는 서버가 일정의 시작·종료 일시(KST)로 판별해 내려줍니다. (예정 → 진행 중 → 종료)
  const all = (data?.schedules ?? []).filter((s) => !month || (s.date ?? "").startsWith(month));
  const count = (st: ScheduleItem["status"]) => all.filter((s) => s.status === st).length;
  const items = all.filter((s) => s.status === filter);

  return (
    <>
      <PageHeader title="특별 일정" description={mode === "teacher" ? "학생 면담, 학급 행사 등 출결을 체크하지 않을 교시를 등록하세요." : "체육대회, 현장체험학습, 재량휴업일 등 학교·학년 일정을 등록하세요."}
        actions={<>
          <Segmented value={filter} onChange={setFilter} options={(["UPCOMING", "ONGOING", "ENDED"] as const).map((st) => ({ value: st, label: `${STATUS_LABEL[st]} ${count(st)}` }))} />
          <Button icon={<CalendarPlus className="h-4 w-4" />} onClick={() => { setEditing(null); setFormOpen(true); }}>일정 등록</Button>
        </>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl bg-white p-1 ring-1 ring-ink-200">
          <button type="button" onClick={() => shiftMonth(-1)} className="focus-ring rounded-lg p-2 hover:bg-ink-100" aria-label="이전 달"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-[96px] px-1 text-center text-[13.5px] font-bold">{month ? `${Number(month.slice(0, 4))}년 ${Number(month.slice(5))}월` : "전체 기간"}</span>
          <button type="button" onClick={() => shiftMonth(1)} className="focus-ring rounded-lg p-2 hover:bg-ink-100" aria-label="다음 달"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <Button size="sm" variant={month ? "ghost" : "secondary"} onClick={() => setMonth(month ? "" : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date()).slice(0, 7))}>
          {month ? "전체 기간 보기" : "이번 달로"}
        </Button>
      </div>
      {error ? <Card><ErrorState error={error} onRetry={() => reload()} /></Card> : loading ? (
        <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36" />)}</div>
      ) : items.length === 0 ? (
        <Card><EmptyState icon={<CalendarClock className="h-6 w-6" />} title={{ UPCOMING: "예정된 특별 일정이 없어요", ONGOING: "진행 중인 일정이 없어요", ENDED: "종료된 일정이 없어요" }[filter]} /></Card>
      ) : (
        <motion.div layout className="grid gap-3 md:grid-cols-2">
          <AnimatePresence>
            {items.map((s, i) => (
              <Card key={s.schId} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ delay: i * 0.03 }} className={clsx("relative overflow-hidden p-5", s.isEnded && "opacity-70")}>
                <div className={clsx("absolute inset-y-0 left-0 w-1.5", { SCHOOL: "bg-brand-500", GRADE: "bg-sky-500", CLASS: "bg-mint-500", STUDENT: "bg-amber-500" }[s.scope])} />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge className={SCOPE_TONE[s.scope]}>{s.scopeLabel}{s.grade && s.scope === "GRADE" ? ` · ${s.grade}학년` : ""}</Badge>
                      <Badge className={STATUS_TONE[s.status]}>{s.statusLabel}</Badge>
                    </div>
                    <div className="mt-2 text-[16.5px] font-bold">{s.title}</div>
                    <div className="mt-0.5 text-[13px] text-ink-500">{s.reason}</div>
                  </div>
                  {s.editable && (
                    <div className="flex shrink-0 gap-1">
                      {mode === "teacher" && <IconButton label={`'${s.title}' 일정 수정`} onClick={() => { setEditing(s); setFormOpen(true); }}><Pencil className="h-4 w-4" /></IconButton>}
                      <IconButton label={`'${s.title}' 일정 삭제`} tone="danger" onClick={() => remove(s)}><Trash2 className="h-4 w-4" /></IconButton>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-[12.5px]">
                  <span className="rounded-lg bg-ink-100 px-2 py-1 font-semibold text-ink-700">{s.date ? formatDate(s.date) : "-"}</span>
                  <span className="rounded-lg bg-ink-100 px-2 py-1 font-semibold text-ink-700">{s.allDay ? "종일" : s.perNos.map((p) => `${p}교시`).join(", ")}</span>
                  {s.startAt && s.endAt && <span className="rounded-lg bg-ink-100 px-2 py-1 font-semibold tabular-nums text-ink-700">{formatTime(s.startAt)} ~ {formatTime(s.endAt)}</span>}
                  {s.students.length > 0 && <span className="flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 font-semibold text-amber-600"><Users className="h-3 w-3" />{s.students.map((x) => x.name).join(", ")}</span>}
                </div>
                {(s.note || s.createdBy) && <div className="mt-3 text-[12px] text-ink-400">{s.note && `메모: ${s.note} · `}{s.createdBy && `등록: ${s.createdBy}`}</div>}
              </Card>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
      {dialog}
      <ScheduleForm mode={mode} open={formOpen} onClose={() => setFormOpen(false)} editing={editing} periods={periods.data ?? [1, 2, 3, 4, 5, 6, 7]} students={students.data ?? []} onDone={() => reload(true)} />
    </>
  );
}
