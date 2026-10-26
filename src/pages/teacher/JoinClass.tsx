import { motion } from "framer-motion";
import clsx from "clsx";
import { DoorOpen, Info, School, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { Button, ButtonLink, Card, EmptyState, ErrorState, Modal, PageHeader, Segmented, Skeleton } from "@/components/ui";
import { useAction, useAsync } from "@/lib/hooks";
import InactiveClassNotice from "./InactiveClassNotice";

interface Joinable { clsId: number; schoolYear: number; grade: number; number: number; label: string; description: string | null; classroomName: string | null; studentCount: number }
interface Data { hasHomeroom: boolean; homeroomLabel: string | null; classes: Joinable[]; inactiveHomeroom: { clsId: number; label: string; deactivatedAt: string | null; studentCount: number } | null }

// *
// 학급 들어가기 (교사)
// GET  /teacher/class/joinable        — 관리자가 학급 관리에서 만든 학급 중 담임이 정해지지 않은 학급
// POST /teacher/class/{clsId}/join     — 고른 학급의 담임이 됩니다. (교사당 활성 담임 학급 하나, 먼저 들어간 교사가 담임)
// 담임이 되면 학급 가입 코드·학생 관리·출결 현황을 바로 쓸 수 있습니다.
// *
export default function JoinClass() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(() => api.get<Data>("/teacher/class/joinable"), []);
  const { run, pending } = useAction();
  const [grade, setGrade] = useState("all");
  const [picked, setPicked] = useState<Joinable | null>(null);

  const grades = useMemo(() => [...new Set((data?.classes ?? []).map((c) => c.grade))].sort(), [data]);
  const list = (data?.classes ?? []).filter((c) => grade === "all" || String(c.grade) === grade);

  const join = async () => {
    if (!picked) return;
    const r = await run(() => api.post(`/teacher/class/${picked.clsId}/join`), `${picked.label} 담임으로 들어왔어요.`);
    if (r !== undefined) { setPicked(null); await refresh(); navigate("/teacher/members"); }
    else reload(true);   // 다른 선생님이 먼저 들어간 경우 목록을 새로 고칩니다.
  };

  return (
    <>
      <PageHeader title="학급 들어가기" description="학교 관리자가 만든 학급 중 내가 담임을 맡을 학급을 골라 들어가세요. 들어가면 학급 가입 코드로 학생을 받을 수 있어요." />

      {data?.inactiveHomeroom && (
        <div className="mb-5"><InactiveClassNotice label={data.inactiveHomeroom.label} deactivatedAt={data.inactiveHomeroom.deactivatedAt}
          studentCount={data.inactiveHomeroom.studentCount} onActivated={() => navigate("/teacher")} /></div>
      )}
      {loading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
        : error ? <Card><ErrorState error={error} onRetry={() => reload()} /></Card>
        : data?.hasHomeroom ? (
          <Card><EmptyState icon={<School className="h-6 w-6" />} title={`이미 ${data.homeroomLabel} 담임이에요`} description="담임 학급은 한 개만 맡을 수 있어요. 학급 정보는 학급 설정에서 확인하세요."
            action={<ButtonLink to="/teacher/class">학급 설정으로</ButtonLink>} /></Card>
        ) : !data?.classes.length ? (
          <Card><EmptyState icon={<DoorOpen className="h-6 w-6" />} title={data?.inactiveHomeroom ? "새로 들어갈 수 있는 다른 학급은 없어요" : "들어갈 수 있는 학급이 없어요"}
            description={data?.inactiveHomeroom ? "위에서 내 학급을 재활성화하거나, 학교 관리자가 '학급 관리'에서 만든 새 학급이 생기면 여기에 표시돼요." : "학교 관리자가 '학급 관리'에서 학급을 만들면 여기에 표시돼요. 담임이 이미 지정된 학급은 보이지 않습니다."}
            action={<Button variant="secondary" onClick={() => reload()}>새로 고침</Button>} /></Card>
        ) : (
          <>
            {grades.length > 1 && (
              <div className="mb-4">
                <Segmented value={grade} onChange={setGrade} options={[{ value: "all", label: `전체 ${data.classes.length}` },
                  ...grades.map((g) => ({ value: String(g), label: `${g}학년 ${data.classes.filter((c) => c.grade === g).length}` }))]} />
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((c, i) => (
                <motion.button key={c.clsId} type="button" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  onClick={() => setPicked(c)}
                  className={clsx("card flex flex-col p-5 text-left transition hover:-translate-y-0.5 hover:ring-brand-300")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[12px] font-semibold text-ink-500">{c.schoolYear}학년도</div>
                      <div className="mt-0.5 text-[20px] font-extrabold tracking-tight text-ink-950">{c.label}</div>
                    </div>
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-500"><DoorOpen className="h-5 w-5" /></span>
                  </div>
                  <div className="mt-3 space-y-1 text-[12.5px] text-ink-500">
                    <div className="flex items-center gap-1.5"><School className="h-3.5 w-3.5" />담임 교실 {c.classroomName ?? "미지정"}</div>
                    <div className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />학생 {c.studentCount}명</div>
                  </div>
                  {c.description && <div className="mt-2 line-clamp-2 text-[12.5px] text-ink-600">{c.description}</div>}
                  <div className="mt-4 rounded-xl bg-brand-50 py-2 text-center text-[13px] font-bold text-brand-600">이 학급 담임으로 들어가기</div>
                </motion.button>
              ))}
            </div>
          </>
        )}

      <Modal open={!!picked} onClose={() => setPicked(null)} title={picked ? `${picked.label} 담임으로 들어갈까요?` : ""} size="sm"
        footer={<><Button variant="secondary" onClick={() => setPicked(null)}>취소</Button><Button onClick={join} loading={pending}>들어가기</Button></>}>
        <div className="flex items-start gap-2 rounded-xl bg-ink-50 p-3 text-[13px] leading-6 text-ink-600 ring-1 ring-ink-200/70">
          <Info className="mt-1 h-4 w-4 shrink-0 text-brand-500" />
          <div>들어가면 이 학급의 담임이 되어 학생 가입 승인, 출결 확인, QR 출석을 맡게 돼요. 담임 변경은 학교 관리자가 학급 관리에서 할 수 있어요.</div>
        </div>
      </Modal>
    </>
  );
}
