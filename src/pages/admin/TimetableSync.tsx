import { motion } from "framer-motion";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/api/client";
import type { Homeroom, WeekTimetable } from "@/api/types";
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Select, Skeleton } from "@/components/ui";
import { formatDate, formatTime } from "@/lib/format";
import { useAction, useAsync } from "@/lib/hooks";
import { WeekGrid } from "../common/Timetable";

interface SyncStatus { source: string; schoolCode: number | null; syncedAt: string | null; error: string | null; periodCount: number }

export default function AdminTimetableSync() {
  const status = useAsync(() => api.get<SyncStatus>("/admin/timetable"), []);
  const classes = useAsync(() => api.get<{ classes: Homeroom[] }>("/admin/classes"), []);
  // 활성 학급 목록은 학급 데이터가 바뀔 때만 다시 계산합니다. (렌더링마다 새 배열 → effect 반복 실행 방지)
  const active = useMemo(() => (classes.data?.classes ?? []).filter((c) => c.isActive), [classes.data]);
  const [clsId, setClsId] = useState<number | null>(null);
  useEffect(() => { if (!clsId && active.length) setClsId(active[0].clsId); }, [active, clsId]);
  const week = useAsync(() => (clsId ? api.get<WeekTimetable>("/timetable/week", { clsId }) : Promise.resolve(null)), [clsId, status.data?.syncedAt]);
  const { run, pending } = useAction();
  const s = status.data;

  return (
    <>
      <PageHeader title="시간표 연동" description="컴시간 알리미에서 학급별 시간표와 교시 시간을 자동으로 가져옵니다. 12시간마다 자동으로 갱신돼요."
        actions={<Button icon={<RefreshCw className={pending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />} loading={pending}
          onClick={async () => { const r = await run(() => api.post<SyncStatus>("/admin/timetable/sync"), "시간표를 동기화했습니다."); if (r) status.setData(r); }}>지금 동기화</Button>} />
      {status.loading ? <Skeleton className="h-28" /> : s && (
        <Card initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-5 flex flex-wrap items-center gap-5 p-5">
          <motion.div animate={pending ? { rotate: 360 } : {}} transition={{ repeat: pending ? Infinity : 0, duration: 1.2, ease: "linear" }}
            className={`grid h-12 w-12 place-items-center rounded-2xl ${s.error ? "bg-rose-50 text-rose-600" : s.syncedAt ? "bg-mint-50 text-mint-600" : "bg-ink-100 text-ink-500"}`}>
            {s.error ? <AlertTriangle className="h-6 w-6" /> : s.syncedAt ? <CheckCircle2 className="h-6 w-6" /> : <CalendarClock className="h-6 w-6" />}
          </motion.div>
          <div className="min-w-[200px] flex-1">
            <div className="flex items-center gap-2 font-bold">{s.source} {s.schoolCode && <Badge>학교 코드 {s.schoolCode}</Badge>}</div>
            <div className="mt-0.5 text-[13px] text-ink-500">
              {s.error ? <span className="text-rose-600">{s.error}</span> : s.syncedAt ? `마지막 동기화 ${formatDate(s.syncedAt, false)} ${formatTime(s.syncedAt)}` : "아직 동기화하지 않았습니다. 학급을 만든 뒤 동기화해주세요."}
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl bg-ink-50 px-3 py-2 text-[13px] font-semibold text-ink-600"><Clock className="h-4 w-4" />교시 {s.periodCount}개</div>
        </Card>
      )}
      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="font-bold">학급 시간표</div>
          <Select className="w-44" value={clsId ?? ""} onChange={(e) => setClsId(Number(e.target.value))}>
            {active.map((c) => <option key={c.clsId} value={c.clsId}>{c.label}</option>)}
          </Select>
        </div>
        {classes.loading || week.loading ? <Skeleton className="h-80" /> : !active.length ? <EmptyState title="활성 학급이 없습니다" description="학급 관리에서 학급을 먼저 생성하세요." />
          : week.error ? <ErrorState error={week.error} onRetry={() => week.reload()} /> : week.data ? <WeekGrid data={week.data} /> : null}
      </Card>
    </>
  );
}
