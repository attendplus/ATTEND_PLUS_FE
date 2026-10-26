import { motion } from "framer-motion";
import { Copy, DoorOpen, Power, RefreshCw, School } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/api/client";
import type { Homeroom } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { Button, ButtonLink, Card, ErrorState, Modal, PageHeader, Select, Skeleton, Textarea } from "@/components/ui";
import { useAction, useAsync } from "@/lib/hooks";
import InactiveClassNotice from "./InactiveClassNotice";

interface Options { teachers: { usId: number; name: string; email: string }[]; classrooms: { clrId: number; name: string; floor: string; gpsReady: boolean }[] }

export function ClassForm({ value, onChange, options, showTeacher = true }: {
  value: { schoolYear: string; grade: string; number: string; description: string; teacherUsId: string; clrId: string };
  onChange: (v: typeof value) => void; options: Options | null; showTeacher?: boolean;
}) {
  const set = (k: keyof typeof value) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => onChange({ ...value, [k]: e.target.value });
  const year = new Date().getFullYear();
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Select label="학년도" required value={value.schoolYear} onChange={set("schoolYear")}><option value="">선택</option>{[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}학년도</option>)}</Select>
      <Select label="학년" required value={value.grade} onChange={set("grade")}><option value="">선택</option>{[1, 2, 3].map((g) => <option key={g} value={g}>{g}학년</option>)}</Select>
      <Select label="학급" required value={value.number} onChange={set("number")}><option value="">선택</option>{Array.from({ length: 15 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}반</option>)}</Select>
      {showTeacher && (
        <Select className="sm:col-span-3" label="담임 교사" value={value.teacherUsId} onChange={set("teacherUsId")}>
          <option value="">지정 안 함</option>{options?.teachers.map((t) => <option key={t.usId} value={t.usId}>{t.name} ({t.email})</option>)}
        </Select>
      )}
      <Select className="sm:col-span-3" label="담임 교실 (GPS 판정 기본 교실)" value={value.clrId} onChange={set("clrId")}>
        <option value="">지정 안 함</option>{options?.classrooms.map((c) => <option key={c.clrId} value={c.clrId}>{c.name} · {c.floor}{c.gpsReady ? "" : " (GPS 범위 미설정)"}</option>)}
      </Select>
      <Textarea className="sm:col-span-3" label="학급 설명 (선택)" value={value.description} onChange={set("description")} />
    </div>
  );
}

export const toPayload = (v: { schoolYear: string; grade: string; number: string; description: string; teacherUsId: string; clrId: string }) => ({
  schoolYear: v.schoolYear ? Number(v.schoolYear) : null, grade: v.grade ? Number(v.grade) : null, number: v.number ? Number(v.number) : null,
  description: v.description || null, teacherUsId: v.teacherUsId ? Number(v.teacherUsId) : null, clrId: v.clrId ? Number(v.clrId) : null,
});

export default function ClassSettings() {
  const { profile, refresh } = useAuth();
  const { data, loading, error, reload, setData } = useAsync(() => api.get<Homeroom>("/teacher/class"), []);
  const options = useAsync(() => api.get<Options>("/teacher/class/options"), []);
  const [form, setForm] = useState({ schoolYear: "", grade: "", number: "", description: "", teacherUsId: "", clrId: "" });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { run, pending } = useAction();

  useEffect(() => {
    if (data) setForm({ schoolYear: String(data.schoolYear), grade: String(data.grade), number: String(data.number), description: data.description ?? "", teacherUsId: String(data.teacherUsId ?? ""), clrId: String(data.clrId ?? "") });
    else setForm((f) => ({ ...f, schoolYear: String(new Date().getFullYear()) }));
  }, [data]);

  const save = async () => {
    const creating = !data || !data.isActive;
    const r = await run(() => (creating ? api.post<Homeroom>("/teacher/class", toPayload(form)) : api.patch<Homeroom>("/teacher/class", toPayload(form))), creating ? "담임 학급을 만들었습니다." : "학급 정보를 수정했습니다.");
    if (r) { setData(r); refresh(); if (r.teacherUsId !== profile?.usId) toast.info("담임 교사가 변경되었습니다."); }
  };

  if (loading) return <Skeleton className="h-96" />;
  const noClass = error?.code === "CLASS408";

  return (
    <>
      <PageHeader title="학급 설정" description="담임 학급 정보는 언제든지 수정할 수 있어요." />
      {data && !data.isActive && (
        <div className="mb-5"><InactiveClassNotice label={data.label} deactivatedAt={data.deactivatedAt} studentCount={data.studentCount} onActivated={(h) => setData(h)} /></div>
      )}
      {(noClass || (data && !data.isActive)) && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl bg-brand-50 px-4 py-3 text-[13px] text-brand-700 ring-1 ring-brand-200">
          <DoorOpen className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">{data && !data.isActive ? "다른 학급을 맡으려면 " : ""}학교 관리자가 이미 학급을 만들었다면 <b>학급 들어가기</b>에서 골라 바로 담임으로 들어갈 수 있어요.</span>
          <ButtonLink to="/teacher/join" size="sm">학급 들어가기</ButtonLink>
        </div>
      )}
      {error && !noClass ? <Card><ErrorState error={error} onRetry={() => reload()} /></Card> : (
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <Card initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6">
            <div className="mb-5 flex items-center gap-2 text-[16px] font-bold">
              <School className="h-5 w-5 text-brand-500" />{noClass || !data?.isActive ? "새 담임 학급 만들기" : "담임 학급 정보"}
            </div>
            <ClassForm value={form} onChange={setForm} options={options.data} showTeacher={!!data?.isActive} />
            <div className="mt-6 flex justify-end"><Button onClick={save} loading={pending} disabled={!profile?.active}>{noClass || !data?.isActive ? "학급 만들기" : "저장하기"}</Button></div>
          </Card>
          {data && (
            <div className="space-y-5">
              <Card initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="p-6">
                <div className="text-[13px] font-semibold text-ink-500">학급 고유 가입 코드</div>
                <motion.div key={data.accessCode} initial={{ opacity: 0, letterSpacing: "0.6em" }} animate={{ opacity: 1, letterSpacing: "0.25em" }} className="mt-1 font-mono text-[28px] font-extrabold text-brand-600">{data.accessCode}</motion.div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="secondary" icon={<Copy className="h-3.5 w-3.5" />} onClick={() => { navigator.clipboard?.writeText(data.accessCode); toast.success("복사했습니다."); }}>복사</Button>
                  <Button size="sm" variant="secondary" icon={<RefreshCw className="h-3.5 w-3.5" />} disabled={!data.isActive} onClick={async () => { const r = await run(() => api.post<Homeroom>("/teacher/class/access-code"), "새 가입 코드를 발급했습니다."); if (r) setData(r); }}>재발급</Button>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-xl bg-ink-50 p-3"><div className="text-[22px] font-extrabold">{data.studentCount}</div><div className="text-[12px] text-ink-500">소속 학생</div></div>
                  <div className="rounded-xl bg-ink-50 p-3"><div className="text-[22px] font-extrabold">{data.pendingCount}</div><div className="text-[12px] text-ink-500">가입 대기</div></div>
                </div>
              </Card>
              {data.isActive && (
                <Card className="border border-rose-100 p-6">
                  <div className="font-bold text-rose-600">학급 비활성화</div>
                  <p className="mt-1 text-[13px] leading-5 text-ink-500">비활성화해도 학생 소속·출결 기록은 그대로 보관돼요. 비활성 동안은 출결 통계만 볼 수 있고, 언제든 재활성화할 수 있어요.</p>
                  <Button variant="danger" size="sm" className="mt-4" icon={<Power className="h-3.5 w-3.5" />} onClick={() => setConfirmOpen(true)}>비활성화</Button>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="학급을 비활성화할까요?" size="sm" description="학생 소속·출결 기록은 그대로 보관되고, 학급 설정에서 언제든 재활성화할 수 있어요."
        footer={<><Button variant="secondary" onClick={() => setConfirmOpen(false)}>취소</Button><Button variant="danger" loading={pending} onClick={async () => { const r = await run(() => api.patch<Homeroom>("/teacher/class/deactivate"), "학급을 비활성화했습니다."); if (r) { setData(r); setConfirmOpen(false); reload(true); } }}>비활성화</Button></>}>
        <div className="text-[13.5px] text-ink-600">{data?.label} · 학생 {data?.studentCount}명</div>
      </Modal>
    </>
  );
}
