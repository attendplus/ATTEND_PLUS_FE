import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { Archive, Building2, MapPin, Pencil, Plus, Power, RotateCcw, UserRound, Users } from "lucide-react";
import { useState } from "react";
import { api } from "@/api/client";
import type { Homeroom } from "@/api/types";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Badge, Button, Card, EmptyState, ErrorState, Modal, PageHeader, Segmented, Skeleton } from "@/components/ui";
import { useAction, useAsync } from "@/lib/hooks";
import { ClassForm, toPayload } from "../teacher/ClassSettings";

const empty = (grade = "") => ({ schoolYear: String(new Date().getFullYear()), grade, number: "", description: "", teacherUsId: "", clrId: "" });

export default function AdminClasses() {
  const { data, loading, error, reload } = useAsync(() => api.get<{ classes: Homeroom[] }>("/admin/classes"), []);
  const options = useAsync(() => api.get<{ teachers: { usId: number; name: string; email: string }[]; classrooms: { clrId: number; name: string; floor: string; gpsReady: boolean }[] }>("/admin/classes/options"), []);
  const [editing, setEditing] = useState<Homeroom | "new" | null>(null);
  const [form, setForm] = useState(empty());
  const [grade, setGrade] = useState("all");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [asking, setAsking] = useState<{ cls: Homeroom; action: "deactivate" | "activate" } | null>(null);
  const { run, pending } = useAction();

  const open = (c: Homeroom | "new") => {
    setEditing(c);
    setForm(c === "new" ? empty(grade === "all" ? "" : grade) : { schoolYear: String(c.schoolYear), grade: String(c.grade), number: String(c.number), description: c.description ?? "", teacherUsId: String(c.teacherUsId ?? ""), clrId: String(c.clrId ?? "") });
  };
  const save = async () => {
    const r = await run(() => (editing === "new" ? api.post("/admin/classes", toPayload(form)) : api.put(`/admin/classes/${(editing as Homeroom).clsId}`, toPayload(form))), editing === "new" ? "학급을 생성했습니다." : "학급 정보를 수정했습니다.");
    if (r !== undefined) { setEditing(null); reload(true); }
  };
  // 비활성화·재활성화 — 상태만 바뀌고 학생 소속·담임·출결 기록은 그대로 (서버가 권한·중복을 다시 확인)
  const changeStatus = async () => {
    if (!asking) return;
    const { cls, action } = asking;
    const r = await run(() => api.patch(`/admin/classes/${cls.clsId}/${action}`), action === "activate" ? `${cls.label}을(를) 재활성화했어요.` : `${cls.label}을(를) 비활성화했어요.`);
    setAsking(null);
    if (r !== undefined) { await reload(true); if (action === "activate") setStatus("active"); }
  };
  // 학년 탭: 1~3학년 + 실제 학급이 있는 학년 (GET /admin/classes 결과로만 계산)
  const all = data?.classes ?? [];
  const inStatus = all.filter((c) => (status === "active") === c.isActive);
  const grades = [...new Set([1, 2, 3, ...all.map((c) => c.grade)])].sort((a, b) => a - b);
  const count = (g: number) => inStatus.filter((c) => c.grade === g).length;
  const list = inStatus.filter((c) => grade === "all" || String(c.grade) === grade);
  const inactiveCount = all.filter((c) => !c.isActive).length;

  return (
    <>
      <PageHeader title="학급 관리" description="학년별 반을 생성하고 담임 교사와 교실을 지정하세요."
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => open("new")}>{grade === "all" ? "학급 생성" : `${grade}학년 학급 생성`}</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented value={status} onChange={(v) => setStatus(v as "active" | "inactive")}
          options={[{ value: "active", label: `활성 ${all.length - inactiveCount}` }, { value: "inactive", label: `비활성 ${inactiveCount}` }]} />
        <Segmented value={grade} onChange={setGrade} options={[{ value: "all", label: `전체 ${inStatus.length}` }, ...grades.map((g) => ({ value: String(g), label: `${g}학년 ${count(g)}` }))]} />
      </div>
      {status === "inactive" && list.length > 0 && (
        <p className="mb-4 flex items-start gap-2 rounded-2xl bg-ink-50 px-4 py-3 text-[13px] leading-5 text-ink-600 ring-1 ring-ink-200/70">
          <Archive className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />비활성 학급은 학생 소속·담임·출결 기록을 그대로 보관하고 있어요. 재활성화하면 바로 다시 쓸 수 있어요.
        </p>
      )}
      {error ? <Card><ErrorState error={error} onRetry={() => reload()} /></Card> : loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44" />)}</div>
      ) : list.length === 0 ? (status === "inactive"
          ? <Card><EmptyState icon={<Archive className="h-6 w-6" />} title="비활성화된 학급이 없어요" /></Card>
          : <Card><EmptyState icon={<Building2 className="h-6 w-6" />} title={grade === "all" ? "등록된 학급이 없습니다" : `${grade}학년 학급이 없습니다`}
              action={<Button onClick={() => open("new")}>{grade === "all" ? "첫 학급 만들기" : `${grade}학년 학급 만들기`}</Button>} /></Card>) : (
        <motion.div layout className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {list.map((c, i) => (
              <Card key={c.clsId} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }} className={clsx("p-5", !c.isActive && "bg-ink-50/60")}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[12px] font-semibold text-ink-400">{c.schoolYear}학년도</div>
                    <div className="text-[20px] font-extrabold">{c.label}</div>
                  </div>
                  <Badge className={c.isActive ? "bg-mint-50 text-mint-600 ring-mint-500/20" : "bg-rose-50 text-rose-600 ring-rose-500/20"}>{c.isActive ? "활성" : "비활성"}</Badge>
                </div>
                <div className="mt-4 space-y-1.5 text-[13px] text-ink-600">
                  <div className="flex items-center gap-2"><UserRound className="h-3.5 w-3.5 text-ink-400" />{c.teacherName ?? <span className="text-amber-600">담임 미지정</span>}</div>
                  <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-ink-400" />{c.classroomName ?? <span className="text-amber-600">교실 미지정</span>}</div>
                  <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-ink-400" />학생 {c.studentCount}명{c.pendingCount ? ` · 대기 ${c.pendingCount}` : ""}</div>
                </div>
                {c.isActive ? (
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" variant="secondary" className="flex-1" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => open(c)}>수정 · 담임 지정</Button>
                    <Button size="sm" variant="ghost" aria-label={`${c.label} 비활성화`} onClick={() => setAsking({ cls: c, action: "deactivate" })}><Power className="h-3.5 w-3.5 text-rose-500" /></Button>
                  </div>
                ) : (
                  <div className="mt-4">
                    {c.deactivatedAt && <div className="mb-2 text-[12px] text-ink-500">{new Date(c.deactivatedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" })} 비활성화</div>}
                    <Button size="sm" className="w-full" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => setAsking({ cls: c, action: "activate" })}>재활성화</Button>
                  </div>
                )}
              </Card>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} size="lg" title={editing === "new" ? "학급 생성" : "학급 정보 수정"}
        footer={<><Button variant="secondary" onClick={() => setEditing(null)}>취소</Button><Button onClick={save} loading={pending}>{editing === "new" ? "생성" : "저장"}</Button></>}>
        <ClassForm value={form} onChange={setForm} options={options.data} />
      </Modal>
      <ConfirmDialog open={!!asking} loading={pending} onCancel={() => setAsking(null)} onConfirm={changeStatus}
        tone={asking?.action === "deactivate" ? "danger" : "primary"}
        title={asking?.action === "activate" ? `${asking.cls.label}을(를) 재활성화할까요?` : `${asking?.cls.label ?? ""}을(를) 비활성화할까요?`}
        description={asking?.action === "activate"
          ? "비활성화 전의 학생 소속·담임·출결 기록 그대로 다시 열려요. 학생 출석과 담임 기능을 바로 다시 쓸 수 있어요."
          : "학생 소속·담임·출결 기록은 삭제되지 않고 그대로 보관돼요. 비활성 동안에는 출석·QR·학생 관리를 쓸 수 없고, 언제든 재활성화할 수 있어요."} />
    </>
  );
}
