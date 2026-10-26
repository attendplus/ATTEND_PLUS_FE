import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { FileSpreadsheet, Trash2, UploadCloud, UserX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/api/client";
import { useConfirm } from "@/components/ConfirmDialog";
import { Badge, Button, Card, ErrorState, PageHeader, Segmented, Skeleton } from "@/components/ui";
import { formatDate, formatTime } from "@/lib/format";
import { useAction, useAsync } from "@/lib/hooks";

interface ClassStatus { clsId: number; label: string; memberCount: number; assigned: number; waiting: string[] }
interface Grade { schoolYear: number; grade: number; hasClass: boolean; originalName: string | null; uploadedAt: string | null; studentCount: number; sectionCount: number; classes: ClassStatus[] }
interface UploadResult { grade: number; studentCount: number; assigned: number; waitingCount: number; noClassNumbers: number[]; warnings?: string[] }
// 이동수업 반 구성: 수업 교실 + 과목별 배정 학생(가입·승인)과 수업 교사(컴시간 시간표)
interface SectionGroup {
  room: string; subject: string; blocks: string[]; groupCodes: string[]; teacherUsId: number | null; teacherName: string | null;
  students: { usId: number; name: string; classLabel: string; number: number; groupCode: string | null }[];
}

// *
// 학년별 이동수업 배정 (관리자)
// GET    /admin/electives          — 학년별 업로드 파일과 반별 배정 현황
// POST   /admin/electives/{grade}  — 학년 엑셀 업로드: 그 학년의 분반·배정을 새 파일로 교체하고 학년 전체 학급 학생에게 적용
// DELETE /admin/electives/{grade}  — 학년 배정 삭제
// GET    /admin/electives/{grade}/sections — 이동수업 반 구성 (교실·과목별 학생 명단 + 수업 교사)
// 엑셀에 다른 학년 학생(학번 기준)이 섞여 있으면 서버가 거부하므로 학년끼리 섞이지 않습니다.
// *
export default function AdminElectives() {
  const { data, loading, error, reload } = useAsync(() => api.get<{ grades: Grade[] }>("/admin/electives"), []);
  // 학년 탭 (3학년 → 2학년 → 1학년). 처음에는 가장 높은 학년을 엽니다.
  const [picked, setPicked] = useState<string>("");
  useEffect(() => { if (data?.grades.length && !data.grades.some((g) => String(g.grade) === picked)) setPicked(String(data.grades[0].grade)); }, [data, picked]);
  const current = data?.grades.find((g) => String(g.grade) === picked);

  return (
    <>
      <PageHeader title="이동수업 배정" description="학년을 먼저 고른 뒤 그 학년의 이동수업 배정 엑셀을 올리세요. 그 학년 모든 반 학생에게 바로 적용되고, 아직 가입하지 않은 학생은 학급에 등록되는 순간 자동으로 배정됩니다."
 />
      {data && data.grades.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Segmented value={picked} onChange={setPicked} options={data.grades.map((g) => ({ value: String(g.grade), label: `${g.grade}학년${g.originalName ? " ✓" : ""}` }))} />
          <span className="text-[12.5px] text-ink-500">✓ 표시는 엑셀이 적용된 학년이에요.</span>
        </div>
      )}
      {error ? <Card><ErrorState error={error} onRetry={() => reload()} /></Card> : loading ? (
        <Skeleton className="h-48" />
      ) : current ? (
        <GradeCard key={`${current.schoolYear}-${current.grade}`} grade={current} onChange={() => reload(true)} />
      ) : null}
    </>
  );
}

function GradeCard({ grade: g, onChange }: { grade: Grade; onChange: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { run, pending } = useAction();
  const { confirm, dialog } = useConfirm();

  const upload = async (file?: File) => {
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) return toast.error("엑셀(.xlsx) 파일만 업로드할 수 있습니다.");
    if (g.originalName && !(await confirm({ title: `${g.grade}학년 배정을 새 파일로 교체할까요?`, description: "기존 배정은 모두 새 파일 기준으로 바뀌어요.", confirmLabel: "교체하기" }))) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const r = await api.upload<UploadResult>(`/admin/electives/${g.grade}`, form);
      toast.success(`${g.grade}학년 이동수업 배정을 적용했어요. (엑셀 ${r.studentCount}명 · 배정 ${r.assigned}명)`, {
        description: [r.waitingCount ? `가입 대기 ${r.waitingCount}명은 학급에 등록되면 자동 배정돼요.` : "", r.noClassNumbers.length ? `앱에 없는 반: ${r.noClassNumbers.map((n) => `${g.grade}-${n}`).join(", ")}` : ""].filter(Boolean).join(" ") || undefined,
      });
      for (const w of r.warnings ?? []) toast.warning(w, { duration: 10000 });
      onChange();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "이동수업 표를 업로드하지 못했습니다.");
    } finally { setUploading(false); }
  };
  const remove = async () => {
    if (!(await confirm({ title: `${g.grade}학년 이동수업 배정을 모두 삭제할까요?`, description: "그 학년 학생들의 이동수업 교실 배정이 모두 지워지고 되돌릴 수 없어요. 엑셀을 다시 올리면 새로 배정돼요.", confirmLabel: "삭제", tone: "danger" }))) return;
    const r = await run(() => api.del(`/admin/electives/${g.grade}`), `${g.grade}학년 이동수업 배정을 삭제했습니다.`);
    if (r !== undefined) onChange();
  };
  const waiting = g.classes.reduce((n, c) => n + c.waiting.length, 0);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 px-5 py-4">
        <div className="text-[17px] font-extrabold">{g.grade}학년</div>
        <span className="text-[12.5px] text-ink-500">{g.schoolYear}학년도</span>
        {g.originalName ? (
          <Badge className="bg-mint-50 text-mint-600 ring-1 ring-mint-500/20">적용 중 · 분반 {g.sectionCount}개 · 엑셀 {g.studentCount}명</Badge>
        ) : <Badge className="bg-ink-100 text-ink-500">미업로드</Badge>}
        {g.originalName && <Button size="sm" variant="ghost" icon={<Trash2 className="h-4 w-4" />} loading={pending} onClick={remove} className="ml-auto text-rose-600 hover:bg-rose-50">삭제</Button>}
      </div>
      <div className="p-4">
        <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
        <motion.div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files[0]); }}
          onClick={() => !uploading && inputRef.current?.click()} animate={{ scale: drag ? 1.01 : 1 }}
          role="button" tabIndex={0} aria-disabled={uploading} aria-label={`${g.grade}학년 이동수업 배정 엑셀 파일 선택`}
          onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !uploading) { e.preventDefault(); inputRef.current?.click(); } }}
          className={clsx("focus-ring flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed px-5 py-5 transition", drag ? "border-brand-400 bg-brand-50" : "border-ink-300 hover:border-brand-300 hover:bg-ink-50")}>
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint-50 text-mint-600">{uploading ? <FileSpreadsheet className="h-5 w-5 animate-pulse" /> : <UploadCloud className="h-5 w-5" />}</div>
          <div className="min-w-0 flex-1">
            <div className="font-bold">{uploading ? "엑셀을 분석하고 학년 전체에 적용하는 중…" : `${g.grade}학년 이동수업 배정 엑셀(.xlsx)을 끌어다 놓거나 클릭하세요`}</div>
            <div className="truncate text-[12.5px] text-ink-500">
              {g.originalName ? `현재: ${g.originalName} · ${g.uploadedAt ? `${formatDate(g.uploadedAt.slice(0, 10), false)} ${formatTime(g.uploadedAt)}` : ""}` : `${g.grade}학년 학생만 들어 있는 파일이어야 해요. 다른 학년 학번이 섞여 있으면 거부됩니다.`}
            </div>
          </div>
        </motion.div>

        {!g.hasClass && (
          <div className="mt-4 rounded-xl bg-ink-50 p-3 text-[12.5px] text-ink-500 ring-1 ring-ink-200/70">
            아직 {g.grade}학년 학급이 없어요. 미리 올려 두면 학급이 만들어지고 학생이 가입·승인될 때 자동으로 배정됩니다.
          </div>
        )}
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {g.classes.map((c) => (
            <div key={c.clsId} className="rounded-xl bg-ink-50 p-3 ring-1 ring-ink-200/70">
              <div className="flex items-center justify-between"><span className="font-bold">{c.label}</span><span className="text-[12px] text-ink-500">배정 {c.assigned}/{c.memberCount}명</span></div>
              {c.waiting.length > 0 && <div className="mt-1 truncate text-[12px] text-amber-600" title={c.waiting.join(", ")}>가입 대기 {c.waiting.length}명</div>}
            </div>
          ))}
        </div>
        <AnimatePresence>
          {waiting > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 flex items-start gap-2 text-[12.5px] text-amber-600">
              <UserX className="mt-0.5 h-3.5 w-3.5 shrink-0" />엑셀에는 있지만 아직 학급에 등록되지 않은 학생 {waiting}명 — 가입 승인·계정 생성 시 자동으로 배정됩니다.
            </motion.div>
          )}
        </AnimatePresence>
        {g.originalName && <SectionList grade={g.grade} />}
      </div>
      {dialog}
    </Card>
  );
}

// 이동수업 반 구성 (펼치면 불러옴): 학적(담임 학급)은 그대로 두고, 교실·과목별 수업 배정과 수업 교사를 보여줍니다.
function SectionList({ grade }: { grade: number }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data, loading, error, reload } = useAsync(() => (open ? api.get<{ groups: SectionGroup[] }>(`/admin/electives/${grade}/sections`) : Promise.resolve(null)), [open, grade]);
  const groups = (data?.groups ?? []).filter((x) => !query || `${x.room} ${x.subject} ${x.teacherName ?? ""}`.includes(query.trim()));
  return (
    <div className="mt-5 border-t border-ink-100 pt-4">
      <Button size="sm" variant="secondary" onClick={() => setOpen(!open)}>{open ? "이동수업 반 구성 접기" : "이동수업 반 구성 보기 (교실·과목별 학생 · 수업 교사)"}</Button>
      {open && (error ? <ErrorState error={error} onRetry={() => reload()} /> : loading || !data ? <Skeleton className="mt-3 h-40" /> : (
        <div className="mt-3">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="교실·과목·교사 검색" className="field mb-3 max-w-xs" aria-label="이동수업 반 검색" />
          <div className="scrollbar-thin max-h-[420px] overflow-auto rounded-xl ring-1 ring-ink-200/70">
            <table className="w-full text-[12.5px]">
              <thead className="sticky top-0 bg-ink-50 text-left text-ink-500">
                <tr><th className="px-3 py-2">교실 · 과목</th><th className="px-3 py-2">블록 · 분반</th><th className="px-3 py-2">수업 교사</th><th className="px-3 py-2">학생 (담임 학급)</th></tr>
              </thead>
              <tbody>
                {groups.map((x) => (
                  <tr key={`${x.room}|${x.subject}`} className="border-t border-ink-100 align-top">
                    <td className="px-3 py-2 font-semibold">{x.room} · {x.subject}</td>
                    <td className="px-3 py-2 text-ink-500">{x.blocks.join(", ")}{x.groupCodes.length ? ` · ${x.groupCodes.join(", ")}` : ""}</td>
                    <td className="px-3 py-2">{x.teacherName ?? <span className="text-ink-400">시간표에서 찾지 못함</span>}{x.teacherName && !x.teacherUsId && <span className="ml-1 text-[11px] text-amber-600" title="컴시간 이름과 일치하는 교사 계정이 없거나 여러 명이에요.">계정 미연결</span>}</td>
                    <td className="px-3 py-2 text-ink-600">{x.students.length ? x.students.map((st) => `${st.name}(${st.classLabel}·${st.number})`).join(", ") : <span className="text-ink-400">가입한 학생 없음</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
