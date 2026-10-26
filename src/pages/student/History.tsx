import { CalendarRange } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@/api/client";
import type { Attendance, Summary } from "@/api/types";
import { AttendanceRecordList, SummaryDonut } from "@/components/attendance";
import { Card, ErrorState, Input, PageHeader, Segmented, Skeleton } from "@/components/ui";
import { toISODate } from "@/lib/format";
import { useAsync } from "@/lib/hooks";

type Preset = "month" | "30" | "semester" | "custom";

function rangeOf(preset: Preset): [string, string] {
  const end = new Date();
  const start = new Date();
  if (preset === "month") start.setDate(1);
  else if (preset === "30") start.setDate(start.getDate() - 30);
  else if (preset === "semester") { start.setMonth(end.getMonth() >= 7 ? 7 : 2, 1); }
  return [toISODate(start), toISODate(end)];
}

export default function StudentHistory() {
  const [preset, setPreset] = useState<Preset>("month");
  const [custom, setCustom] = useState<[string, string]>(rangeOf("30"));
  const [start, end] = useMemo(() => (preset === "custom" ? custom : rangeOf(preset)), [preset, custom]);
  const { data, loading, error, reload } = useAsync(() => api.get<{ summary: Summary; records: Attendance[] }>("/student/attendance", { start, end }), [start, end]);

  return (
    <>
      <PageHeader title="출결 기록" description="GPS · QR 확인 상태와 함께 나의 출결 기록을 확인하세요."
        actions={<Segmented value={preset} onChange={setPreset} options={[{ value: "month", label: "이번 달" }, { value: "30", label: "30일" }, { value: "semester", label: "이번 학기" }, { value: "custom", label: "직접" }]} />} />
      {preset === "custom" && (
        <Card className="mb-5 flex flex-wrap items-end gap-3 p-4">
          <CalendarRange className="mb-3 h-5 w-5 text-ink-400" />
          <Input label="시작일" type="date" value={custom[0]} onChange={(e) => setCustom([e.target.value, custom[1]])} />
          <Input label="종료일" type="date" value={custom[1]} onChange={(e) => setCustom([custom[0], e.target.value])} />
        </Card>
      )}
      {error ? <Card><ErrorState error={error} onRetry={() => reload()} /></Card> : (
        <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <Card className="h-fit p-6">
            <div className="mb-4 text-[16px] font-bold">요약</div>
            {loading || !data ? <Skeleton className="h-40" /> : <SummaryDonut summary={data.summary} />}
          </Card>
          <Card className="p-6">
            <div className="mb-4 text-[16px] font-bold">상세 기록</div>
            {loading || !data ? <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div> : <AttendanceRecordList records={data.records} />}
          </Card>
        </div>
      )}
    </>
  );
}
