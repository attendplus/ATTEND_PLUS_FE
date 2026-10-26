import { AnimatePresence, motion } from "framer-motion";
import { DoorOpen, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@/api/client";
import { Badge, Button, Card, EmptyState, ErrorState, Input, PageHeader, Select, Skeleton } from "@/components/ui";
import { useAction, useAsync } from "@/lib/hooks";

interface Space { ssId: number; clrId: number; name: string; floorNo: number | null; hasArea: boolean }
interface Room { clrId: number; name: string; floorNo: number | null; hasArea: boolean }
// subject: 대표 이름(이동수업 과목명), aliases: 같은 과목의 컴시간 약어 (예: 영미문학읽기 ← 영미)
interface Data { subjects: { subject: string; aliases: string[]; spaces: Space[] }[]; classrooms: Room[] }

const roomLabel = (r: { name: string; floorNo: number | null }) => `${r.floorNo ? `${r.floorNo}층 ` : ""}${r.name}`;

// *
// 과목별 출석 인정 공간 (관리자)
// GET /admin/subject-spaces 로 과목 목록(컴시간 과목 + 이동수업 과목 + 등록된 과목)과 교실 목록을 받고,
// POST /admin/subject-spaces {subject, clrId} 로 공간을 추가, DELETE /admin/subject-spaces/{ssId} 로 뺍니다.
// 학생 GPS 출석은 '시간표 수업 교실' 또는 '그 과목에 등록된 공간' 중 하나 안이면 인정됩니다.
// *
export default function AdminSubjectSpaces() {
  const { data, loading, error, reload } = useAsync(() => api.get<Data>("/admin/subject-spaces"), []);
  const { run, pending } = useAction();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [newSubject, setNewSubject] = useState("");

  const subjects = useMemo(() => {
    const q = query.replace(/\s/g, "");
    const list = data?.subjects ?? [];
    return (q ? list.filter((s) => s.subject.includes(q) || s.aliases.some((a) => a.includes(q))) : list).sort((a, b) => b.spaces.length - a.spaces.length || a.subject.localeCompare(b.subject));
  }, [data, query]);

  const add = async (subject: string, clrId: string) => {
    if (!clrId) return;
    const r = await run(() => api.post("/admin/subject-spaces", { subject, clrId: Number(clrId) }), `${subject}에 출석 인정 공간을 추가했어요.`);
    if (r !== undefined) { setPicked((p) => ({ ...p, [subject]: "" })); reload(true); }
  };
  const remove = async (s: Space, subject: string) => {
    const r = await run(() => api.del(`/admin/subject-spaces/${s.ssId}`), `${subject}에서 ${s.name}을(를) 뺐어요.`);
    if (r !== undefined) reload(true);
  };

  return (
    <>
      <PageHeader title="과목별 출석 공간" description="과목마다 출석을 인정할 공간을 여러 개 등록할 수 있어요. 예) 미술 → 미술실, 3-1. 학생은 시간표 수업 교실이나 등록된 공간 중 하나 안에 있으면 출석으로 인정됩니다." />

      <Card className="mb-5 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[220px] flex-1">
          <Input label="과목 검색" placeholder="예: 미술" value={query} onChange={(e) => setQuery(e.target.value)} right={<Search className="h-4 w-4 text-ink-400" />} />
        </div>
        <div className="min-w-[220px] flex-1">
          <Input label="목록에 없는 과목 추가" placeholder="과목명 입력 후 아래에서 공간 선택" value={newSubject} maxLength={50} onChange={(e) => setNewSubject(e.target.value)} />
        </div>
      </Card>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="l" exit={{ opacity: 0 }} className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</motion.div>
        ) : error ? (
          <ErrorState key="e" error={error} onRetry={() => reload()} />
        ) : (
          // 과목 목록은 한 카드 안의 행으로: 과목명 | 등록된 공간 | 공간 추가 열이 모든 행에서 같은 위치에 정렬됩니다.
          <motion.div key="d" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card divide-y divide-ink-100 overflow-hidden">
            {newSubject.trim() && !subjects.some((s) => s.subject === newSubject.replace(/\s/g, "")) && (
              <SubjectRow subject={newSubject.replace(/\s/g, "")} spaces={[]} rooms={data!.classrooms} value={picked[newSubject] ?? ""}
                onPick={(v) => setPicked((p) => ({ ...p, [newSubject]: v }))} onAdd={(v) => add(newSubject.replace(/\s/g, ""), v).then(() => setNewSubject(""))} onRemove={() => undefined} pending={pending} />
            )}
            {subjects.length === 0 && !newSubject.trim() && <EmptyState icon={<DoorOpen className="h-6 w-6" />} title="과목이 없어요." description="시간표 연동이나 이동수업 엑셀 업로드 후 과목이 표시됩니다." />}
            {subjects.map((s) => (
              <SubjectRow key={s.subject} subject={s.subject} aliases={s.aliases} spaces={s.spaces} rooms={data!.classrooms} value={picked[s.subject] ?? ""}
                onPick={(v) => setPicked((p) => ({ ...p, [s.subject]: v }))} onAdd={(v) => add(s.subject, v)} onRemove={(sp) => remove(sp, s.subject)} pending={pending} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function SubjectRow({ subject, aliases = [], spaces, rooms, value, onPick, onAdd, onRemove, pending }: {
  subject: string; aliases?: string[]; spaces: Space[]; rooms: Room[]; value: string; pending: boolean;
  onPick: (v: string) => void; onAdd: (v: string) => void; onRemove: (s: Space) => void;
}) {
  const used = new Set(spaces.map((s) => s.clrId));
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 transition hover:bg-ink-50/60">
      <div className="w-44 shrink-0">
        <div className="font-bold">{subject}</div>
        {aliases.length > 0 && <div className="text-[11.5px] text-ink-400" title="컴시간 시간표에 표시되는 약어">시간표: {aliases.join(", ")}</div>}
      </div>
      <div className="flex min-w-[200px] flex-1 flex-wrap gap-1.5">
        {spaces.length === 0 && <span className="text-[13px] text-ink-400">시간표 수업 교실만 인정</span>}
        {spaces.map((sp) => (
          <Badge key={sp.ssId} className="gap-1 bg-brand-50 text-brand-700 ring-1 ring-brand-200">
            {roomLabel(sp)}{!sp.hasArea && <span className="text-amber-600" title="배치도 영역이 없어 GPS 판정에 쓰이지 않아요">(영역 없음)</span>}
            <button onClick={() => onRemove(sp)} className="ml-0.5 rounded hover:bg-brand-100" aria-label={`${sp.name} 빼기`}><X className="h-3 w-3" /></button>
          </Badge>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Select value={value} onChange={(e) => onPick(e.target.value)} className="!w-44">
          <option value="">공간 선택</option>
          {rooms.filter((r) => !used.has(r.clrId)).map((r) => <option key={r.clrId} value={r.clrId}>{roomLabel(r)}{r.hasArea ? "" : " (영역 없음)"}</option>)}
        </Select>
        <Button size="sm" icon={<Plus className="h-4 w-4" />} disabled={!value} loading={pending} onClick={() => onAdd(value)}>추가</Button>
      </div>
    </div>
  );
}
