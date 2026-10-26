import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@/api/client";
import { useConfirm } from "@/components/ConfirmDialog";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Input, Modal, PageHeader, Segmented, Skeleton, Textarea } from "@/components/ui";
import { useAction, useAsync } from "@/lib/hooks";

interface Teacher {
  usId: number; name: string; email: string; profileImageUrl: string | null; active: boolean; deactivateReason: string | null; employmentStatus: string | null;
  homeroomLabel: string | null; homeroomGrade: number | null; teachingGrades: number[];   // 담임 학년 / 컴시간 시간표상 수업 학년
}
const EMPLOYMENT: Record<string, string> = { EMPLOYEE: "재직", ON_LEAVE: "휴직", JOB_CHANGED: "이직", RETIRED: "퇴직" };

export default function AdminTeachers() {
  const { data, loading, error, reload } = useAsync(() => api.get<{ teachers: Teacher[] }>("/admin/teachers"), []);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [grade, setGrade] = useState("all");
  const [target, setTarget] = useState<Teacher | null>(null);
  const [reason, setReason] = useState("");
  const { run, pending } = useAction();
  const { confirm, dialog } = useConfirm();
  // 재직 상태를 '퇴직'으로 바꾸면 서버가 계정을 자동 비활성화하므로 한 번 더 확인합니다.
  const changeEmployment = async (t: Teacher, next: string) => {
    if (next === "RETIRED" && t.active && !(await confirm({ title: `${t.name} 선생님을 퇴직 처리할까요?`, description: "퇴직으로 바꾸면 계정이 자동으로 비활성화되어 출결 보관(조회) 외 기능을 쓸 수 없어요. 필요하면 다시 재활성화할 수 있어요.", confirmLabel: "퇴직 처리", tone: "danger" }))) return;
    const r = await run(() => api.patch(`/admin/teachers/${t.usId}/employment`, { employmentStatus: next }), "재직 상태를 변경했습니다.");
    if (r !== undefined) reload(true);
  };
  // 학년 필터: 그 학년 담임이거나 그 학년 수업을 맡은 교사 / '담임 없음'은 담임 학급이 없는 교사
  const inGrade = (t: Teacher, g: string) => g === "all" || (g === "none" ? !t.homeroomGrade : t.homeroomGrade === Number(g) || t.teachingGrades.includes(Number(g)));
  const teachers = data?.teachers ?? [];
  const grades = [...new Set([1, 2, 3, ...teachers.flatMap((t) => [...t.teachingGrades, ...(t.homeroomGrade ? [t.homeroomGrade] : [])])])].sort((a, b) => a - b);
  const list = useMemo(() => teachers.filter((t) => (!q || t.name.includes(q) || t.email.includes(q)) && (filter === "all" || (filter === "active") === t.active) && inGrade(t, grade)), [teachers, q, filter, grade]);

  const deactivate = async () => {
    const r = await run(() => api.patch(`/admin/teachers/${target!.usId}/deactivate`, { reason }), "교사 계정을 비활성화했습니다.");
    if (r !== undefined) { setTarget(null); setReason(""); reload(true); }
  };

  return (
    <>
      <PageHeader title="교사 관리" description="퇴직 · 이직 시 계정을 비활성화하면 출결 보관 기능만 사용할 수 있습니다. 재직 상태가 '퇴직'이면 자동 비활성화돼요." />
      {/* 필터 한 줄: 왼쪽 학년, 오른쪽 계정 상태 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented value={grade} onChange={setGrade} options={[
          { value: "all", label: `전체 ${teachers.length}` },
          ...grades.map((g) => ({ value: String(g), label: `${g}학년 ${teachers.filter((t) => inGrade(t, String(g))).length}` })),
          { value: "none", label: `담임 없음 ${teachers.filter((t) => !t.homeroomGrade).length}` },
        ]} />
        <Segmented value={filter} onChange={setFilter} options={[{ value: "all", label: "전체 상태" }, { value: "active", label: "활성" }, { value: "inactive", label: "비활성" }]} />
      </div>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-4 py-3.5 sm:px-5">
          <h2 className="font-bold">교사 <span className="text-ink-500">{list.length}</span></h2>
          <Input className="w-full sm:w-60" type="search" aria-label="교사 이름 또는 이메일 검색" placeholder="이름 · 이메일 검색" value={q} onChange={(e) => setQ(e.target.value)} right={<Search className="mr-1.5 h-4 w-4 text-ink-400" />} />
        </div>
        {error ? <ErrorState error={error} onRetry={() => reload()} /> : loading ? <div className="space-y-2 p-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          : list.length === 0 ? <EmptyState title={teachers.length === 0 ? "교사가 없습니다" : "조건에 맞는 교사가 없습니다"}
              description={teachers.length === 0 ? "학교 고유 인증 코드를 공유하면 교사가 직접 가입합니다." : "학년·상태 필터나 검색어를 바꿔 보세요."} /> : (
            <div className="divide-y divide-ink-100">
              {list.map((t, i) => (
                <motion.div key={t.usId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.2) }} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 sm:px-5">
                  <Avatar src={t.profileImageUrl} name={t.name} size={40} className={!t.active ? "grayscale" : ""} />
                  <div className="min-w-0 flex-1 basis-[180px]">
                    <div className="flex flex-wrap items-center gap-1.5 font-semibold">{t.name}
                      {t.homeroomLabel && <Badge className="bg-brand-50 text-brand-700 ring-brand-200">{t.homeroomLabel} 담임</Badge>}
                      {t.teachingGrades.length > 0 && <Badge className="bg-ink-100 text-ink-600 ring-ink-200" >수업 {t.teachingGrades.map((g) => `${g}학년`).join("·")}</Badge>}
                    </div>
                    <div className="break-all text-[12.5px] text-ink-500">{t.email}{!t.active && t.deactivateReason ? ` · 사유: ${t.deactivateReason}` : ""}</div>
                  </div>
                  <div className="flex w-full items-center gap-2 sm:w-auto">
                  <select value={t.employmentStatus ?? "EMPLOYEE"} aria-label={`${t.name} 재직 상태`} onChange={(e) => changeEmployment(t, e.target.value)}
                    className="field !w-auto !py-1.5 text-[13px]">
                    {Object.entries(EMPLOYMENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <Badge className={t.active ? "bg-mint-50 text-mint-600 ring-mint-500/20" : "bg-rose-50 text-rose-600 ring-rose-500/20"}>{t.active ? "활성" : "비활성"}</Badge>
                  {t.active ? <Button size="sm" variant="secondary" onClick={() => setTarget(t)}>비활성화</Button>
                    : <Button size="sm" variant="soft" onClick={async () => { const r = await run(() => api.patch(`/admin/teachers/${t.usId}/activate`), "교사 계정을 다시 활성화했습니다."); if (r !== undefined) reload(true); }}>재활성화</Button>}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
      </Card>
      <Modal open={!!target} onClose={() => setTarget(null)} title={`${target?.name ?? ""} 선생님 계정 비활성화`} size="sm" description="비활성화된 교사는 학생 출결 사항 조회(보관) 외 기능을 사용할 수 없습니다."
        footer={<><Button variant="secondary" onClick={() => setTarget(null)}>취소</Button><Button variant="danger" onClick={deactivate} loading={pending} disabled={!reason.trim()}>비활성화</Button></>}>
        <Textarea label="비활성화 사유" required placeholder="예) 2026년 2월 이직" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
      {dialog}
    </>
  );
}
