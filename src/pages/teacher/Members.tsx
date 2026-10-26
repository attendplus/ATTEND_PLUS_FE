import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Inbox, Search, UserMinus, UserPlus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/api/client";
import type { Gender, Homeroom } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Input, Modal, PageHeader, PasswordInput, Segmented, Skeleton, Textarea, Toggle } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { useAction, useAsync } from "@/lib/hooks";

// 클립보드 복사: 권한이 없거나 HTTP 환경이라 실패하면 '복사했어요'라고 잘못 알리지 않고 직접 복사하도록 안내합니다.
const copy = async (text: string, done: string) => {
  try { await navigator.clipboard.writeText(text); toast.success(done); }
  catch { toast.error("복사하지 못했어요. 내용을 길게 눌러 직접 복사해 주세요."); }
};

interface Member { cmId: number; usId: number; name: string; email: string | null; isTempAccount?: boolean; gender: Gender; profileImageUrl: string | null; studentId: number; number: number; status: string; active: boolean; mustChangePassword: boolean; requestedAt: string }

export default function TeacherMembers() {
  const { profile } = useAuth();
  const { data, loading, error, reload } = useAsync(() => api.get<{ members: Member[]; pending: Member[] }>("/teacher/members"), []);
  const homeroom = useAsync(() => api.get<Homeroom>("/teacher/class"), []);
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [deactivate, setDeactivate] = useState<Member | null>(null);
  const [kick, setKick] = useState<Member | null>(null);
  const { run } = useAction();
  const list = useMemo(() => (data?.members ?? []).filter((m) => !q || m.name.includes(q) || String(m.studentId).includes(q)), [data, q]);
  const editable = profile?.active && homeroom.data?.isActive;

  const decide = async (m: Member, approve: boolean) => {
    const r = await run(() => api.post(`/teacher/members/${m.cmId}/${approve ? "approve" : "reject"}`), approve ? `${m.name} 학생을 승인했습니다.` : "가입 요청을 거절했습니다.");
    if (r !== undefined) { reload(true); homeroom.reload(true); }
  };
  const activate = async (m: Member) => { const r = await run(() => api.patch(`/teacher/members/${m.usId}/status`, { active: true }), "계정을 활성화했습니다."); if (r !== undefined) reload(true); };

  return (
    <>
      <PageHeader eyebrow={homeroom.data?.label} title="학생 관리" description="학급 가입 코드로 초대하거나, 학생 계정을 직접 만들어 등록할 수 있어요."
        actions={editable && <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>학생 계정 추가</Button>} />

      {homeroom.data && (
        <Card initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-5 flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <div className="text-[13px] font-semibold text-brand-600">학급 고유 가입 코드</div>
            <div className="mt-1 break-all font-mono text-[24px] font-extrabold tracking-[0.2em] text-ink-950 sm:text-[28px] sm:tracking-[0.25em]">{homeroom.data.accessCode}</div>
            <div className="text-[12.5px] text-ink-500">학생에게 공유하면 회원가입 시 이 코드로 학급 가입을 요청합니다.</div>
          </div>
          <Button variant="secondary" icon={<Copy className="h-4 w-4" />} onClick={() => copy(homeroom.data!.accessCode, "가입 코드를 복사했습니다.")}>코드 복사</Button>
        </Card>
      )}

      {error ? <Card><ErrorState error={error} onRetry={() => reload()} /></Card> : (
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-4 py-3.5 sm:px-5">
              <h2 className="font-bold">학급 학생 <span className="text-ink-500">{data?.members.length ?? 0}</span></h2>
              <Input className="w-full sm:w-56" type="search" aria-label="학생 이름 또는 학번 검색" placeholder="이름 · 학번 검색" value={q} onChange={(e) => setQ(e.target.value)} right={<Search className="mr-1.5 h-4 w-4 text-ink-400" />} />
            </div>
            {loading ? <div className="space-y-2 p-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
              : list.length === 0 ? (q && data?.members.length
                ? <EmptyState icon={<Search className="h-6 w-6" />} title={`'${q}'에 맞는 학생이 없어요`} description="이름이나 학번을 다시 확인해 보세요." action={<Button variant="secondary" onClick={() => setQ("")}>검색 지우기</Button>} />
                : <EmptyState title="등록된 학생이 없습니다" description="가입 코드를 공유하거나 학생 계정을 직접 추가하세요." />)
              : (
                <div className="divide-y divide-ink-100">
                  {list.map((m, i) => (
                    <motion.div key={m.usId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.015, 0.2) }} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                      <span className="w-6 text-right text-[12px] font-bold tabular-nums text-ink-400">{m.number}</span>
                      <Avatar src={m.profileImageUrl} name={m.name} size={36} className={!m.active ? "grayscale" : ""} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">{m.name}
                          {!m.active && <Badge className="bg-rose-50 text-rose-600 ring-rose-500/20">비활성</Badge>}
                          {m.mustChangePassword && <Badge className="bg-amber-50 text-amber-600 ring-amber-500/20">임시 비밀번호</Badge>}
                        </div>
                        <div className="truncate text-[12px] text-ink-500">학번 {m.studentId} · {m.isTempAccount ? "임시 계정 (학번 로그인)" : m.email}</div>
                      </div>
                      <Toggle checked={m.active} disabled={!editable} label={`${m.name} 계정 ${m.active ? "활성" : "비활성"}`} onChange={(v) => (v ? activate(m) : setDeactivate(m))} />
                      <Button size="sm" variant="ghost" icon={<UserMinus className="h-4 w-4" />} disabled={!editable} onClick={() => setKick(m)} aria-label={`${m.name} 학생 강퇴`}
                        className="px-2 text-rose-600 hover:bg-rose-50 sm:px-3"><span className="hidden sm:inline">강퇴</span></Button>
                    </motion.div>
                  ))}
                </div>
              )}
          </Card>

          <Card className="h-fit overflow-hidden">
            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3.5">
              <h2 className="font-bold">가입 요청</h2>
              {!!data?.pending.length && <Badge className="bg-brand-500 text-white ring-brand-500">{data.pending.length}</Badge>}
            </div>
            {!data?.pending.length ? <EmptyState icon={<Inbox className="h-6 w-6" />} title="대기 중인 요청이 없어요" /> : (
              <div className="divide-y divide-ink-100">
                <AnimatePresence initial={false}>
                  {data.pending.map((m) => (
                    <motion.div key={m.cmId} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40, height: 0 }} className="flex items-center gap-3 px-5 py-3">
                      <Avatar src={m.profileImageUrl} name={m.name} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{m.name} <span className="text-[12px] font-medium text-ink-500">{m.number}번</span></div>
                        <div className="text-[12px] text-ink-500">학번 {m.studentId} · {formatDate(m.requestedAt, false)}</div>
                      </div>
                      <button type="button" disabled={!editable} onClick={() => decide(m, false)} aria-label={`${m.name} 가입 요청 거절`} title="거절" className="focus-ring grid h-9 w-9 place-items-center rounded-lg text-ink-500 ring-1 ring-ink-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"><X className="h-4 w-4" /></button>
                      <button type="button" disabled={!editable} onClick={() => decide(m, true)} aria-label={`${m.name} 가입 요청 승인`} title="승인" className="focus-ring grid h-9 w-9 place-items-center rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-40"><Check className="h-4 w-4" /></button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </Card>
        </div>
      )}
      <CreateStudentModal open={createOpen} onClose={() => setCreateOpen(false)} onDone={() => { reload(true); homeroom.reload(true); }} />
      <DeactivateModal member={deactivate} onClose={() => setDeactivate(null)} onDone={() => reload(true)} />
      <KickModal member={kick} onClose={() => setKick(null)} onDone={() => { reload(true); homeroom.reload(true); }} />
    </>
  );
}

function CreateStudentModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ studentId: "", name: "", tempPassword: "" });
  const [gender, setGender] = useState<Gender>("MALE");
  const [created, setCreated] = useState<{ studentId: number; password: string } | null>(null);
  const { profile } = useAuth();
  const { run, pending } = useAction();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const close = () => { setCreated(null); setForm({ studentId: "", name: "", tempPassword: "" }); onClose(); };
  // 학번 = 학년(1) + 반(2) + 번호(2). 번호는 학번에서 계산하고, 담임 학급과 맞는지 미리 보여 줍니다. (서버도 같은 규칙으로 검사)
  const sid = form.studentId;
  const parsed = sid.length === 5 ? { grade: Number(sid[0]), cls: Number(sid.slice(1, 3)), no: Number(sid.slice(3)) } : null;
  const home = profile?.schoolClass;
  const matches = !!parsed && !!home && parsed.grade === home.grade && parsed.cls === home.number && parsed.no > 0;
  const sidHint = !sid ? "예) 30201 → 3학년 2반 1번" : !parsed ? "학번은 5자리예요. (학년 1 + 반 2 + 번호 2)"
    : matches ? `→ ${parsed.grade}학년 ${parsed.cls}반 ${parsed.no}번` : `${home?.grade}학년 ${home?.number}반 학번이 아니에요. (${parsed.grade}학년 ${parsed.cls}반 ${parsed.no}번)`;
  // POST /teacher/members — 임시 계정 생성: 학생은 '학교 + 학번 + 임시 비밀번호'로 로그인하고 첫 로그인 때 비밀번호를 바꿉니다.
  const submit = async () => {
    const r = await run(() => api.post<{ studentId: number }>("/teacher/members", {
      studentId: form.studentId ? Number(form.studentId) : null, name: form.name || null,
      tempPassword: form.tempPassword || null, gender,
    }), "학생 계정을 생성했습니다.");
    if (r) { setCreated({ studentId: r.studentId, password: form.tempPassword }); onDone(); }
  };
  const loginInfo = created ? `학교: ${profile?.school.name ?? ""}\n학번: ${created.studentId}\n임시 비밀번호: ${created.password}` : "";
  return (
    <Modal open={open} onClose={close} title="학생 계정 추가" description="학번으로 로그인하는 임시 계정을 만들고 담임 학급에 바로 등록합니다."
      footer={created ? <Button onClick={close}>완료</Button> : <><Button variant="secondary" onClick={close}>취소</Button><Button onClick={submit} loading={pending} disabled={!matches || !form.name || !form.tempPassword}>생성하기</Button></>}>
      {created ? (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-mint-50 text-mint-600"><Check className="h-7 w-7" /></div>
          <div className="mt-3 font-bold">계정이 생성되었습니다</div>
          <p className="mt-1 text-[13.5px] text-ink-500">학생은 로그인 화면의 <b>임시 계정</b> 탭에서 학교와 학번, 임시 비밀번호로 로그인하고 첫 로그인 때 비밀번호를 바꿉니다.</p>
          <div className="mt-4 flex items-start justify-between gap-2 rounded-xl bg-ink-50 p-3 text-left text-[14px] font-semibold">
            <div className="space-y-0.5"><div>학교: {profile?.school.name}</div><div>학번: <span className="font-mono">{created.studentId}</span></div><div>임시 비밀번호: <span className="font-mono">{created.password}</span></div></div>
            <button type="button" onClick={() => copy(loginInfo, "로그인 정보를 복사했습니다.")} className="focus-ring rounded-lg p-1.5 text-ink-500 hover:bg-white" aria-label="로그인 정보 복사" title="로그인 정보 복사"><Copy className="h-4 w-4" /></button>
          </div>
        </motion.div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="학번" required inputMode="numeric" placeholder="30201" value={form.studentId} maxLength={5}
            onChange={(e) => setForm({ ...form, studentId: e.target.value.replace(/\D/g, "").slice(0, 5) })}
            hint={sidHint} error={sid.length === 5 && !matches ? sidHint : undefined} />
          <Input label="이름" required value={form.name} onChange={set("name")} maxLength={20} />
          <div><span className="label">성별</span><Segmented value={gender} onChange={setGender} options={[{ value: "MALE", label: "남성" }, { value: "FEMALE", label: "여성" }]} /></div>
          <PasswordInput className="sm:col-span-2" label="임시 비밀번호" required value={form.tempPassword} onChange={set("tempPassword")} hint="영문 대·소문자, 숫자, 특수문자 포함 8자 이상" />
          <div className="rounded-xl bg-brand-50/60 p-3 text-[12.5px] text-brand-700 ring-1 ring-brand-100 sm:col-span-2">이메일 없이 <b>학번</b>으로 로그인하는 임시 계정이 만들어져요. 학생은 첫 로그인 때 비밀번호를 바꿉니다.</div>
        </div>
      )}
    </Modal>
  );
}

// POST /teacher/members/{usId}/kick — 학급 연결을 끊고 학생의 로그인 세션을 만료시킵니다. (학생은 가입 코드로 다시 가입 가능)
function KickModal({ member, onClose, onDone }: { member: Member | null; onClose: () => void; onDone: () => void }) {
  const { run, pending } = useAction();
  const submit = async () => {
    const r = await run(() => api.post(`/teacher/members/${member!.usId}/kick`), `${member!.name} 학생을 학급에서 내보냈습니다.`);
    if (r !== undefined) { onDone(); onClose(); }
  };
  return (
    <Modal open={!!member} onClose={onClose} title={`${member?.name ?? ""} 학생 강퇴`} size="sm"
      description="학급과의 연결이 해제되고, 학생이 로그인한 웹·앱은 바로 로그아웃됩니다. 출결 기록은 보관되며, 학생은 학급 가입 코드로 다시 가입을 요청할 수 있어요."
      footer={<><Button variant="secondary" onClick={onClose}>취소</Button><Button variant="danger" onClick={submit} loading={pending}>강퇴</Button></>}>
      <div className="rounded-xl bg-rose-50 p-3 text-[13px] text-rose-600">{member?.number}번 {member?.name} (학번 {member?.studentId}) 학생을 학급에서 내보냅니다. 이동수업 배정도 함께 삭제됩니다.</div>
    </Modal>
  );
}

function DeactivateModal({ member, onClose, onDone }: { member: Member | null; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const { run, pending } = useAction();
  const submit = async () => {
    const r = await run(() => api.patch(`/teacher/members/${member!.usId}/status`, { active: false, reason }), "계정을 비활성화했습니다.");
    if (r !== undefined) { setReason(""); onDone(); onClose(); }
  };
  return (
    <Modal open={!!member} onClose={onClose} title={`${member?.name ?? ""} 계정 비활성화`} size="sm" description="비활성화된 계정은 로그인할 수 없으며, 출결 기록은 삭제되지 않고 보관됩니다."
      footer={<><Button variant="secondary" onClick={onClose}>취소</Button><Button variant="danger" onClick={submit} loading={pending}>비활성화</Button></>}>
      <Textarea label="사유" placeholder="예) 전학" value={reason} onChange={(e) => setReason(e.target.value)} />
    </Modal>
  );
}
