import { motion } from "framer-motion";
import clsx from "clsx";
import { ArrowRight, Building2, CalendarClock, Check, ClipboardList, Eye, EyeOff, GraduationCap, MapPinned } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/api/client";
import type { Homeroom, ScheduleItem } from "@/api/types";
import { Button, Card, ErrorState, PageHeader, Skeleton, StatCard, describeError } from "@/components/ui";
import { useAsync } from "@/lib/hooks";

interface School { name: string; type: string | null; address: string | null; officeName: string | null; phoneNumber: string | null; accessCodeMasked: string }

export default function AdminDashboard() {
  const school = useAsync(() => api.get<School>("/admin/school"), []);
  const counts = useAsync(async () => {
    const [t, c, l, tt, s] = await Promise.all([
      api.get<{ teachers: { active: boolean }[] }>("/admin/teachers"),
      api.get<{ classes: Homeroom[] }>("/admin/classes"),
      api.get<{ current: { floorCount: number | null } | null; classrooms: { hasArea: boolean }[] }>("/admin/layout"),
      api.get<{ syncedAt: string | null }>("/admin/timetable"),
      api.get<{ schedules: ScheduleItem[] }>("/admin/schedules"),
    ]);
    const active = c.classes.filter((x) => x.isActive);
    return {
      layoutReady: !!l.current, floors: l.current?.floorCount ?? 0, timetableSynced: !!tt.syncedAt,
      teachers: t.teachers.filter((x) => x.active).length, classes: active.length, students: active.reduce((a, x) => a + x.studentCount, 0),
      rooms: l.classrooms.filter((x) => x.hasArea).length, upcoming: s.schedules.filter((x) => !x.isEnded).length,
      assigned: active.filter((x) => x.teacherUsId).length, withRoom: active.filter((x) => x.clrId).length,
    };
  }, []);
  const [code, setCode] = useState<string | null>(null);
  const reveal = async () => {
    if (code) return setCode(null);
    try { setCode((await api.get<{ accessCode: string }>("/admin/school/access-code")).accessCode); }
    catch (e) { toast.error(describeError(e).title, { description: describeError(e).fix }); }
  };
  const c = counts.data;

  const checklist = c ? [
    { label: "교실 배치도 업로드", done: c.layoutReady, to: "/admin/layout" },
    { label: "학급 생성", done: c.classes > 0, to: "/admin/classes" },
    { label: "담임 교사 지정", done: c.classes > 0 && c.assigned === c.classes, to: "/admin/classes" },
    { label: "담임 교실 연결 (자동)", done: c.classes > 0 && c.withRoom === c.classes, to: "/admin/layout" },
    { label: "컴시간 시간표 연동", done: c.timetableSynced, to: "/admin/timetable" },
  ] : [];
  const progress = checklist.length ? checklist.filter((x) => x.done).length / checklist.length : 0;

  return (
    <>
      <PageHeader eyebrow="학교 관리자" title="대시보드" description="학교 조직과 출결 환경을 한눈에 관리하세요." />
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative mb-5 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-800 to-brand-600 p-5 text-white sm:p-7">
        {school.loading ? <Skeleton className="h-24 bg-white/10" /> : school.error ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3">
            <div><div className="font-bold">학교 정보를 불러오지 못했어요</div><div className="mt-0.5 text-[13px] text-white/75">{describeError(school.error).fix}</div></div>
            <Button variant="secondary" size="sm" onClick={() => school.reload()}>다시 시도</Button>
          </div>
        ) : school.data && (
          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="text-[13px] font-semibold text-white/60">{school.data.officeName} · {school.data.type}</div>
              <div className="mt-1 text-[24px] font-extrabold tracking-tight sm:text-[30px]">{school.data.name}</div>
              <div className="mt-1 text-[14px] text-white/70">{school.data.address}</div>
            </div>
            <div className="rounded-2xl bg-white/10 px-5 py-4 ring-1 ring-white/15">
              <div className="text-[12px] font-semibold text-white/60">학교 고유 인증 코드</div>
              <div className="mt-1 flex items-center gap-3">
                <span className="break-all font-mono text-[20px] font-bold tracking-[0.2em] sm:text-[22px]">{code ?? school.data.accessCodeMasked}</span>
                <button onClick={reveal} aria-label={code ? "인증 코드 숨기기" : "인증 코드 보기"} aria-pressed={!!code} className="focus-ring rounded-lg p-1.5 hover:bg-white/10">
                  {code ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* 현황 숫자를 못 불러왔을 때 0으로 보이면 '실제로 없음'으로 오해할 수 있어 오류를 따로 안내합니다. */}
      {counts.error && <Card className="mb-5"><ErrorState error={counts.error} title="학교 현황을 불러오지 못했어요" onRetry={() => counts.reload()} /></Card>}
      <div className={clsx("mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4", counts.error && "hidden")}>
        <StatCard label="재직 교사" value={c?.teachers ?? 0} icon={<GraduationCap className="h-4 w-4" />} />
        <StatCard label="활성 학급" value={c?.classes ?? 0} icon={<Building2 className="h-4 w-4" />} tone="mint" delay={0.05} sub={`학생 ${c?.students ?? 0}명`} />
        <StatCard label="교실 영역" value={c?.rooms ?? 0} icon={<MapPinned className="h-4 w-4" />} tone="sky" delay={0.1} sub={c?.layoutReady ? `배치도 ${c.floors}개 층` : "배치도 미등록"} />
        <StatCard label="예정 특별 일정" value={c?.upcoming ?? 0} icon={<CalendarClock className="h-4 w-4" />} tone="amber" delay={0.15} />
      </div>

      <Card className={clsx("p-5 sm:p-6", counts.error && "hidden")}>
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="text-[16px] font-bold">출결 환경 설정 가이드</h2><div className="text-[13px] text-ink-500">배치도 PDF만 올리면 교실 영역이 자동으로 만들어지고, 시간표는 컴시간 알리미에서 가져옵니다.</div></div>
          <div className="text-[22px] font-extrabold text-brand-600">{Math.round(progress * 100)}%</div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink-100" role="progressbar" aria-label="설정 진행도" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}><motion.div className="h-full rounded-full bg-brand-500" initial={{ width: 0 }} animate={{ width: `${progress * 100}%` }} transition={{ type: "spring", stiffness: 60, damping: 18 }} /></div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {checklist.map((item, i) => (
            <motion.div key={item.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.06 }}>
              <Link to={item.to} className={clsx("focus-ring group flex h-full flex-col justify-between gap-3 rounded-2xl p-4 ring-1 transition-colors", item.done ? "bg-mint-50 ring-mint-500/20" : "bg-white ring-ink-200 hover:ring-brand-300")}>
                <span className={clsx("grid h-7 w-7 place-items-center rounded-full text-[12px] font-bold", item.done ? "bg-mint-500 text-white" : "bg-ink-100 text-ink-500")}>{item.done ? <Check className="h-4 w-4" /> : i + 1}</span>
                <span className="flex items-center justify-between text-[13.5px] font-semibold">{item.label}<ArrowRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" /></span>
              </Link>
            </motion.div>
          ))}
        </div>
      </Card>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[{ to: "/admin/timetable", label: "시간표 연동", icon: <ClipboardList className="h-5 w-5" /> }, { to: "/admin/schedules", label: "특별 일정 등록", icon: <CalendarClock className="h-5 w-5" /> }, { to: "/admin/teachers", label: "교사 계정 관리", icon: <GraduationCap className="h-5 w-5" /> }].map((l) => (
          <Link key={l.to} to={l.to} className="focus-ring rounded-2xl"><Card className="flex items-center gap-3 p-5 transition-colors hover:bg-ink-50/60"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600">{l.icon}</span><span className="font-bold">{l.label}</span><ArrowRight className="ml-auto h-4 w-4 text-ink-400" /></Card></Link>
        ))}
      </div>
    </>
  );
}
