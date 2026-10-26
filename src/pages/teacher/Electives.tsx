import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { FileSpreadsheet, Info, UserX } from "lucide-react";
import { api } from "@/api/client";
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { formatDate, formatTime } from "@/lib/format";
import { useAsync } from "@/lib/hooks";

interface Elective { subject: string; groupCode: string | null; block: string; roomName: string | null; raw: string; teacherName?: string | null }
interface Result {
  hasFile: boolean; uploadedAt: string | null; classLabel: string; blocks: string[];
  students: { usId: number; name: string; number: number; electives: Elective[] }[];
  unmatched: { name: string; number: number | null }[];
}

const BLOCK_TONES = ["bg-brand-50 text-brand-700 ring-brand-200", "bg-mint-50 text-mint-600 ring-mint-500/20", "bg-amber-50 text-amber-600 ring-amber-500/20", "bg-sky-50 text-sky-500 ring-sky-500/20", "bg-rose-50 text-rose-600 ring-rose-500/20"];

// *
// 담임 반 이동수업 배정 (조회 전용)
// GET /teacher/electives — 관리자가 학년 단위로 올린 엑셀(POST /admin/electives/{grade})에서 우리 반 학생 배정과
// 엑셀에는 있지만 아직 학급에 등록되지 않은 학생(가입 대기)을 보여 줍니다. 가입되면 자동으로 배정됩니다.
// *
export default function TeacherElectives() {
  const { data, loading, error, reload } = useAsync(() => api.get<Result>("/teacher/electives"), []);
  const blockTone = (block: string) => BLOCK_TONES[(data?.blocks.indexOf(block) ?? 0) % BLOCK_TONES.length];
  const hasAny = data?.students.some((s) => s.electives.length);

  return (
    <>
      <PageHeader eyebrow={data?.classLabel} title="이동수업 배정" description="이동수업 배정 엑셀은 학교 관리자가 학년 단위로 올립니다. 컴시간 시간표와 합쳐 교시마다 학생이 가야 할 교실을 자동으로 판단해요." />

      {data && !data.hasFile && (
        <Card className="mb-5 flex items-center gap-3 p-5 text-[13.5px] text-ink-500">
          <FileSpreadsheet className="h-5 w-5 text-ink-400" />아직 이 학년의 이동수업 배정 엑셀이 없어요. 학교 관리자에게 학년별 업로드를 요청하세요.
        </Card>
      )}
      {data?.uploadedAt && <div className="mb-3 text-[12.5px] text-ink-500">관리자 업로드: {formatDate(data.uploadedAt.slice(0, 10))} {formatTime(data.uploadedAt)}</div>}

      <AnimatePresence>
        {!!data?.unmatched.length && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0 }} className="mb-5 flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-[13px] text-amber-600 ring-1 ring-amber-500/20">
            <UserX className="mt-0.5 h-4 w-4 shrink-0" />
            <div><b>가입 대기 중인 학생 {data.unmatched.length}명</b> — 가입이 승인되거나 계정을 만들면 이 엑셀에서 자동으로 배정됩니다. 다시 올릴 필요 없어요.
              <div className="mt-1 text-amber-600/80">{data.unmatched.map((u) => `${u.number ?? "-"}번 ${u.name}`).join(", ")}</div></div>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-3.5">
          <div className="font-bold">학생별 배정</div>
          <div className="flex items-center gap-1.5 text-[12px] text-ink-500"><Info className="h-3.5 w-3.5" />같은 블록은 같은 시간에 듣는 과목이에요.</div>
        </div>
        {error ? <ErrorState error={error} onRetry={() => reload()} /> : loading ? <div className="space-y-2 p-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          : !hasAny ? <EmptyState icon={<FileSpreadsheet className="h-6 w-6" />} title="등록된 이동수업 배정이 없습니다" description="배정이 없으면 모든 수업을 담임 교실 기준으로 출석 판정합니다." />
          : (
            // 블록(A, B, …)마다 한 열 — 학생이 바뀌어도 같은 블록은 같은 위치에 정렬됩니다.
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 text-[12.5px]">
                <thead>
                  <tr className="text-left text-[12px] text-ink-500">
                    <th className="sticky left-0 z-10 min-w-[128px] whitespace-nowrap border-b border-ink-100 bg-white px-5 py-2.5 font-semibold">학생</th>
                    {data!.blocks.map((b) => (
                      <th key={b} className="min-w-[124px] border-b border-ink-100 px-2 py-2.5 font-semibold">
                        <span className={clsx("chip ring-1", blockTone(b))}>{b} 블록</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data!.students.map((s) => {
                    const byBlock = new Map(s.electives.map((e) => [e.block, e]));
                    return (
                      <tr key={s.usId} className="hover:bg-ink-50/60">
                        <td className="sticky left-0 z-10 whitespace-nowrap border-b border-ink-100 bg-white px-5 py-3 font-semibold">
                          <span className="mr-2 inline-block w-5 text-right text-[12px] text-ink-400">{s.number}</span>{s.name}
                        </td>
                        {data!.blocks.map((b) => {
                          const e = byBlock.get(b);
                          return (
                            <td key={b} className="border-b border-ink-100 px-2 py-2 align-middle">
                              {e ? (
                                <div title={e.raw} className={clsx("rounded-lg px-2.5 py-1.5 ring-1", blockTone(b))}>
                                  <div className="truncate font-semibold leading-4">{e.subject}</div>
                                  <div className="mt-0.5 truncate text-[11px] leading-4 opacity-80">{e.roomName ?? "본반"}{e.teacherName ? ` · ${e.teacherName}` : ""}</div>
                                </div>
                              ) : <span className="pl-2.5 text-ink-300">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </Card>
    </>
  );
}
