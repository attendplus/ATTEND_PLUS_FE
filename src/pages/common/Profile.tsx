import { BellRing, Camera, KeyRound, Mail, School, ShieldQuestion, UserMinus, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, ApiError } from "@/api/client";
import type { Gender, Profile as ProfileT } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Avatar, Badge, Button, Card, Checkbox, ErrorState, Input, Modal, PageHeader, PasswordInput, Segmented, Skeleton, Toggle } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import PasswordFields, { passwordChecks } from "../auth/PasswordFields";

const EMPLOYMENT = { EMPLOYEE: "재직", RETIRED: "퇴직", JOB_CHANGED: "이직", ON_LEAVE: "휴직" } as Record<string, string>;
const MEMBERSHIP = { PENDING: "승인 대기", APPROVED: "소속", REJECTED: "거절됨", LEFT: "탈퇴" } as Record<string, string>;

export default function Profile() {
  const { profile, setProfile } = useAuth();
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("MALE");
  const [isForeign, setIsForeign] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { run, pending } = useAction();

  useEffect(() => {
    if (!profile) return;
    setName(profile.name); setGender(profile.gender); setIsForeign(profile.isForeign);
  }, [profile]);
  if (!profile) return null;

  const dirty = name !== profile.name || gender !== profile.gender || isForeign !== profile.isForeign;

  // PATCH /me — 이름·성별·외국인 여부만 수정 (이메일은 인증 후 PATCH /me/email)
  const save = async () => {
    if (!name.trim()) return toast.error("필수 정보를 모두 입력해주세요.");
    const r = await run(() => api.patch<ProfileT>("/me", { name, gender, isForeign }), "정보가 수정되었습니다.");
    if (r) setProfile(r);
  };

  const upload = async (file: File) => {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      setProfile(await api.upload<ProfileT>("/me/profile-image", form));
      toast.success("프로필 사진이 변경되었습니다.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "프로필 사진을 업로드하지 못했습니다.");
    } finally { setUploading(false); }
  };

  const toggleAlarm = async (v: boolean) => {
    const r = await run(() => api.patch<ProfileT>("/me/settings", { alarmEnabled: v }), v ? "알림을 받습니다." : "알림 수신을 해제했습니다.");
    if (r) setProfile(r);
  };

  return (
    <>
      <PageHeader title="내 정보" description="프로필 정보는 언제든지 수정할 수 있어요." />
      {/* 긴 이메일·인증 코드가 카드를 화면 밖으로 밀지 않도록 칸 최소 폭을 0으로 둡니다. */}
      <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)] [&>*]:min-w-0">
        <Card initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden">
          <div className="h-24 bg-gradient-to-br from-brand-400 via-brand-500 to-[#5F87BD]" />
          <div className="-mt-12 px-6 pb-6">
            <div className="group relative w-fit">
              <Avatar src={profile.profileImageUrl} name={profile.name} size={96} className="ring-4" />
              <button type="button" onClick={() => fileRef.current?.click()} aria-label="프로필 사진 바꾸기" className="absolute inset-0 grid place-items-center rounded-full bg-ink-950/50 text-white opacity-0 transition focus-visible:opacity-100 group-hover:opacity-100">
                {uploading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Camera className="h-6 w-6" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="text-[20px] font-extrabold">{profile.name}</div>
              <Badge className="bg-brand-50 text-brand-700 ring-brand-200">{ROLE_LABEL[profile.role]}</Badge>
            </div>
            <div className="mt-1 flex min-w-0 items-center gap-1.5 break-all text-[13.5px] text-ink-500"><Mail className="h-3.5 w-3.5 shrink-0" />{profile.isTempAccount ? `임시 계정 · 학번 ${profile.schoolClass?.studentId ?? ""} 로그인` : profile.email}</div>
            {profile.isTempAccount && (
              <button onClick={() => setEmailOpen(true)} className="mt-2 rounded-lg bg-brand-50 px-2.5 py-1.5 text-[12.5px] font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-100">
                이메일을 추가하면 이메일로도 로그인할 수 있어요 →
              </button>
            )}
            <div className="mt-5 space-y-3 text-[13.5px]">
              <div className="flex items-start gap-3 rounded-xl bg-ink-50 p-3">
                <School className="mt-0.5 h-4 w-4 text-ink-400" />
                <div><div className="font-semibold">{profile.school.name}</div><div className="text-[12.5px] text-ink-500">{profile.school.address ?? "-"}</div></div>
              </div>
              {profile.schoolClass && (
                <div className="flex items-start gap-3 rounded-xl bg-ink-50 p-3">
                  <Users className="mt-0.5 h-4 w-4 text-ink-400" />
                  <div>
                    <div className="font-semibold">{profile.schoolClass.schoolYear}학년도 {profile.schoolClass.label}</div>
                    <div className="text-[12.5px] text-ink-500">
                      {profile.role === "STUDENT"
                        ? `학번 ${profile.schoolClass.studentId} · ${profile.schoolClass.studentNumber}번 · ${MEMBERSHIP[profile.schoolClass.membershipStatus ?? ""] ?? ""}`
                        : `담임 · ${profile.schoolClass.isActive ? "활성" : "비활성"}`}
                    </div>
                  </div>
                </div>
              )}
              {profile.employmentStatus && profile.role === "TEACHER" && (
                <div className="flex items-center justify-between rounded-xl bg-ink-50 p-3"><span className="text-ink-500">재직 상태</span><span className="font-semibold">{EMPLOYMENT[profile.employmentStatus]}</span></div>
              )}
              {profile.school.accessCodeMasked && (
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl bg-ink-50 p-3"><span className="text-ink-500">학교 고유 인증 코드</span><span className="min-w-0 break-all font-mono font-semibold tracking-widest">{profile.school.accessCodeMasked}</span></div>
              )}
            </div>
          </div>
        </Card>

        <div className="space-y-5">
          <Card initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="p-5 sm:p-6">
            <h2 className="mb-5 text-[16px] font-bold">기본 정보</h2>
            <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
              <Input label="이름" required value={name} onChange={(e) => setName(e.target.value)} maxLength={20} />
              <div>
                <span className="label">{profile.isTempAccount ? "로그인" : "이메일"}</span>
                <div className="flex items-center gap-2">
                  <div className="field min-w-0 flex-1 truncate bg-ink-50 text-ink-700">{profile.isTempAccount ? `학교 + 학번 ${profile.schoolClass?.studentId ?? ""}` : profile.email}</div>
                  <Button size="sm" variant="secondary" onClick={() => setEmailOpen(true)}>{profile.isTempAccount ? "이메일 추가" : "변경"}</Button>
                </div>
              </div>
              <div>
                <span className="label">성별</span>
                <Segmented value={gender} onChange={setGender} options={[{ value: "MALE", label: "남성" }, { value: "FEMALE", label: "여성" }]} />
              </div>
              <div className="flex items-end pb-2"><Checkbox checked={isForeign} onChange={setIsForeign}>외국인</Checkbox></div>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setResetOpen(true)} icon={<ShieldQuestion className="h-4 w-4" />}>비밀번호 찾기</Button>
              <Button variant="secondary" onClick={() => setPwOpen(true)} icon={<KeyRound className="h-4 w-4" />}>비밀번호 변경</Button>
              <Button onClick={save} loading={pending} disabled={!dirty}>저장하기</Button>
            </div>
          </Card>

          {profile.role !== "STUDENT" && (
            <Card initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex items-center justify-between gap-4 p-6">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><BellRing className="h-5 w-5" /></div>
                <div>
                  <div className="font-bold">출결 알림 받기</div>
                  <div className="text-[13px] text-ink-500">지각 · QR 출석 · 조회/종례 출석 현황 알림을 받습니다.</div>
                </div>
              </div>
              <Toggle checked={profile.alarmEnabled} onChange={toggleAlarm} label="출결 알림 받기" />
            </Card>
          )}

          {/* 회원 탈퇴 — 다른 정보 수정과 구분해 맨 아래 따로 둡니다. */}
          <WithdrawSection role={profile.role} />
        </div>
      </div>
      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} onForgot={() => { setPwOpen(false); setResetOpen(true); }} />
      <ResetPasswordModal open={resetOpen} onClose={() => setResetOpen(false)} email={profile.email} isTemp={!!profile.isTempAccount} />
      <EmailModal open={emailOpen} onClose={() => setEmailOpen(false)} isTemp={!!profile.isTempAccount} onDone={(p) => { setProfile(p); setEmailOpen(false); }} />
    </>
  );
}

function ChangePasswordModal({ open, onClose, onForgot }: { open: boolean; onClose: () => void; onForgot: () => void }) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const { run, pending } = useAction();
  const submit = async () => {
    const ok = await run(() => api.patch("/auth/password", { currentPassword: current, newPassword: password, newPasswordConfirm: confirm }), "비밀번호가 변경되었습니다.");
    if (ok !== undefined) { setCurrent(""); setPassword(""); setConfirm(""); onClose(); }
  };
  return (
    <Modal open={open} onClose={onClose} title="비밀번호 변경" size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>취소</Button><Button onClick={submit} loading={pending}>변경</Button></>}>
      <div className="space-y-4">
        <div>
          <PasswordInput label="현재 비밀번호" required value={current} onChange={(e) => setCurrent(e.target.value)} />
          <button type="button" onClick={onForgot} className="mt-1.5 text-[12.5px] font-semibold text-brand-600 hover:underline">현재 비밀번호가 기억나지 않나요?</button>
        </div>
        <PasswordFields password={password} setPassword={setPassword} confirm={confirm} setConfirm={setConfirm} label="새 비밀번호" />
      </div>
    </Modal>
  );
}

// *
// 비밀번호 찾기 (로그인 상태) — 현재 비밀번호를 몰라도 내 계정 이메일 인증으로 재설정합니다.
// 1) POST /auth/email/send {email: 내 이메일, purpose: RESET_PASSWORD} — 인증번호 메일 발송
// 2) POST /auth/email/verify {email, code} — 인증번호 확인
// 3) POST /auth/password/reset/me {newPassword, newPasswordConfirm} — 서버가 로그인 계정의 이메일 인증 기록을 확인한 뒤 재설정
//    다른 기기의 로그인은 끊기고, 지금 화면은 새 쿠키로 계속 사용합니다.
// 학번 임시 계정은 이메일이 없어 담임 선생님께 초기화를 요청해야 합니다.
// *
function ResetPasswordModal({ open, onClose, email, isTemp }: { open: boolean; onClose: () => void; email: string; isTemp: boolean }) {
  const [step, setStep] = useState<"send" | "code" | "password">("send");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const { run, pending } = useAction();
  useEffect(() => { if (open) { setStep("send"); setCode(""); setPassword(""); setConfirm(""); } }, [open]);

  const send = async () => {
    const r = await run(() => api.post("/auth/email/send", { email, purpose: "RESET_PASSWORD" }), `${email}로 인증번호를 보냈어요. 스팸함도 확인해주세요.`);
    if (r !== undefined) setStep("code");
  };
  const verify = async () => {
    const r = await run(() => api.post("/auth/email/verify", { email, code }), "본인 확인이 완료되었어요. 새 비밀번호를 정해주세요.");
    if (r !== undefined) setStep("password");
  };
  const save = async () => {
    const r = await run(() => api.post("/auth/password/reset/me", { newPassword: password, newPasswordConfirm: confirm }), "비밀번호를 새로 설정했어요. 다른 기기에서는 다시 로그인해야 해요.");
    if (r !== undefined) onClose();
  };
  const strong = passwordChecks(password).every((c) => c.ok) && password === confirm;
  const steps = ["본인 인증", "인증번호 확인", "새 비밀번호"];
  const index = step === "send" ? 0 : step === "code" ? 1 : 2;

  return (
    <Modal open={open} onClose={onClose} size="sm" title="비밀번호 찾기" description="현재 비밀번호가 기억나지 않으면 내 이메일로 본인 인증을 한 뒤 새 비밀번호를 정할 수 있어요."
      footer={isTemp ? <Button variant="secondary" onClick={onClose}>닫기</Button> : <>
        <Button variant="secondary" onClick={onClose}>취소</Button>
        {step === "send" && <Button onClick={send} loading={pending}>인증번호 받기</Button>}
        {step === "code" && <Button onClick={verify} loading={pending} disabled={code.length !== 6}>확인</Button>}
        {step === "password" && <Button onClick={save} loading={pending} disabled={!strong}>재설정</Button>}
      </>}>
      {isTemp ? (
        <div className="rounded-xl bg-amber-50 p-3.5 text-[13px] leading-6 text-amber-700 ring-1 ring-amber-500/20">
          학번으로 로그인하는 임시 계정은 이메일이 없어 직접 찾을 수 없어요. 담임 선생님께 비밀번호 초기화를 요청하거나, 먼저 이메일을 추가해 주세요.
        </div>
      ) : (
        <div className="space-y-4">
          <ol className="grid grid-cols-3 gap-2">
            {steps.map((label, i) => (
              <li key={label} className={`rounded-lg px-2 py-1.5 text-center text-[12px] font-semibold ${i < index ? "bg-mint-50 text-mint-600" : i === index ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200" : "bg-ink-50 text-ink-400"}`}>
                {i + 1}. {label}
              </li>
            ))}
          </ol>
          <Input label="인증받을 이메일 (내 계정)" value={email} disabled />
          {step === "code" && (
            <Input label="인증번호 (6자리)" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              hint="메일이 안 왔다면 스팸함을 확인하거나 1분 뒤 다시 요청하세요." />
          )}
          {step === "code" && <button type="button" onClick={send} disabled={pending} className="text-[12.5px] font-semibold text-brand-600 hover:underline">인증번호 다시 받기</button>}
          {step === "password" && <PasswordFields password={password} setPassword={setPassword} confirm={confirm} setConfirm={setConfirm} label="새 비밀번호" />}
        </div>
      )}
    </Modal>
  );
}

// *
// 이메일 추가·변경
// 1) POST /auth/email/send {email, purpose: CHANGE_EMAIL} — 새 이메일로 6자리 인증번호 발송 (이미 쓰는 이메일이면 거부)
// 2) POST /auth/email/verify {email, code} — 인증번호 확인
// 3) PATCH /me/email {email, currentPassword} — 현재 비밀번호를 확인한 뒤 로그인 이메일 변경
// 임시 계정은 이후 이메일로도, 학번으로도 로그인할 수 있습니다.
// *
function EmailModal({ open, onClose, isTemp, onDone }: { open: boolean; onClose: () => void; isTemp: boolean; onDone: (p: ProfileT) => void }) {
  const [step, setStep] = useState<"email" | "code" | "password">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const { run, pending } = useAction();
  useEffect(() => { if (open) { setStep("email"); setEmail(""); setCode(""); setPassword(""); } }, [open]);

  const send = async () => {
    const r = await run(() => api.post<{ expiresAt: string }>("/auth/email/send", { email: email.trim(), purpose: "CHANGE_EMAIL" }), "인증번호를 메일로 보냈어요. 스팸함도 확인해주세요.");
    if (r !== undefined) setStep("code");
  };
  const verify = async () => {
    const r = await run(() => api.post("/auth/email/verify", { email: email.trim(), code }), "이메일 인증이 완료되었어요.");
    if (r !== undefined) setStep("password");
  };
  const save = async () => {
    const r = await run(() => api.patch<ProfileT>("/me/email", { email: email.trim(), currentPassword: password }),
      isTemp ? "이메일을 추가했어요. 이제 이메일로도 로그인할 수 있어요." : "이메일을 변경했어요.");
    if (r) onDone(r);
  };

  return (
    <Modal open={open} onClose={onClose} size="sm" title={isTemp ? "이메일 추가" : "이메일 변경"}
      description={isTemp ? "이메일을 인증해 추가하면 로그인 화면의 '내 계정'에서 이메일로 로그인할 수 있어요. 학번 로그인도 계속 쓸 수 있어요." : "새 이메일을 인증한 뒤 현재 비밀번호를 확인하면 로그인 이메일이 바뀝니다."}
      footer={<>
        <Button variant="secondary" onClick={onClose}>취소</Button>
        {step === "email" && <Button onClick={send} loading={pending} disabled={!email.includes("@")}>인증번호 받기</Button>}
        {step === "code" && <Button onClick={verify} loading={pending} disabled={code.length !== 6}>확인</Button>}
        {step === "password" && <Button onClick={save} loading={pending} disabled={!password}>{isTemp ? "이메일 추가" : "변경하기"}</Button>}
      </>}>
      <div className="space-y-3">
        <Input label="새 이메일" type="email" autoComplete="email" value={email} disabled={step !== "email"} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
        {step !== "email" && (
          <Input label="인증번호 (6자리)" inputMode="numeric" value={code} disabled={step !== "code"} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            hint={step === "code" ? "메일이 안 왔다면 스팸함을 확인하거나 1분 뒤 다시 요청하세요." : undefined} />
        )}
        {step === "password" && <PasswordInput label="현재 비밀번호" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
        {step === "code" && <button onClick={() => setStep("email")} className="text-[12.5px] font-semibold text-brand-600 hover:underline">이메일 다시 입력</button>}
      </div>
    </Modal>
  );
}

const WITHDRAW_MESSAGE = "회원 탈퇴 시 계정 이용이 중단되며, 일부 정보는 관련 정책에 따라 복구할 수 없을 수 있습니다. 탈퇴를 진행하시겠습니까?";

interface WithdrawalPreview {
  role: string; schoolName: string; confirmText: string | null; notes: string[];
  deletes: { label: string; count: number }[]; retains: { label: string; count: number }[];
}

// *
// 회원 탈퇴
// - 학생·교사: '회원 탈퇴' → 확인 창(취소 / 회원 탈퇴) → POST /me/withdrawal {confirm: true}
// - 관리자: 탈퇴하면 학교가 삭제되므로 먼저 영향 범위(GET /me/withdrawal)를 보여주고 학교 이름을 입력받은 뒤 같은 확인 창을 띄웁니다.
// 성공하면 서버가 세션을 무효화(토큰 버전 증가)하고 쿠키를 지우며, 화면도 로그아웃 상태로 바꿉니다. '취소'는 아무것도 바꾸지 않습니다.
// *
function WithdrawSection({ role }: { role: ProfileT["role"] }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = role === "SCHOOL_ADMIN";
  const [impactOpen, setImpactOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const { run, pending } = useAction();

  const submit = async () => {
    const r = await run(() => api.post<{ schoolDeleted: boolean }>("/me/withdrawal", { confirm: true, confirmText: isAdmin ? confirmText : undefined }),
      isAdmin ? "학교와 계정이 삭제되었습니다. 이용해 주셔서 감사합니다." : "회원 탈퇴가 완료되었습니다. 이용해 주셔서 감사합니다.");
    setConfirmOpen(false);
    if (r === undefined) return;
    setImpactOpen(false);
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <Card initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="flex flex-wrap items-center justify-between gap-4 p-6 ring-1 ring-rose-100">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600"><UserMinus className="h-5 w-5" /></div>
        <div>
          <div className="font-bold">회원 탈퇴</div>
          <div className="text-[13px] text-ink-500">
            {isAdmin ? "관리자가 탈퇴하면 학교와 소속 교사·학생 계정, 출결 기록이 함께 삭제됩니다. 결제·구독 기록은 보존 정책에 따라 남습니다." : "탈퇴하면 이 계정으로 더 이상 로그인할 수 없습니다."}
          </div>
        </div>
      </div>
      <Button variant="secondary" className="text-rose-600" onClick={() => (isAdmin ? setImpactOpen(true) : setConfirmOpen(true))}>회원 탈퇴</Button>
      {isAdmin && <SchoolDeletionModal open={impactOpen} onClose={() => setImpactOpen(false)} confirmText={confirmText} setConfirmText={setConfirmText}
        onNext={() => setConfirmOpen(true)} />}
      <ConfirmDialog open={confirmOpen} tone="danger" title="회원 탈퇴" description={WITHDRAW_MESSAGE} cancelLabel="취소" confirmLabel="회원 탈퇴"
        loading={pending} onConfirm={submit} onCancel={() => setConfirmOpen(false)} />
    </Card>
  );
}

// 관리자 탈퇴 전 안내: 삭제되는 범위와 보존되는 기록, 최종 확인용 학교 이름 입력
function SchoolDeletionModal({ open, onClose, confirmText, setConfirmText, onNext }: {
  open: boolean; onClose: () => void; confirmText: string; setConfirmText: (v: string) => void; onNext: () => void;
}) {
  const [preview, setPreview] = useState<WithdrawalPreview | null>(null);
  const [error, setError] = useState<unknown>(null);
  const load = () => { setError(null); setPreview(null); api.get<WithdrawalPreview>("/me/withdrawal").then(setPreview).catch(setError); };
  useEffect(() => { if (open) { setConfirmText(""); load(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const matches = !!preview?.confirmText && confirmText.replace(/\s/g, "") === preview.confirmText.replace(/\s/g, "");
  return (
    <Modal open={open} onClose={onClose} size="md" title="학교 삭제 안내" description="관리자 탈퇴는 이 학교의 서비스 데이터를 삭제합니다. 다른 학교 데이터에는 영향이 없습니다."
      footer={<><Button variant="secondary" onClick={onClose}>취소</Button><Button variant="danger" disabled={!matches} onClick={onNext}>다음</Button></>}>
      {error ? <ErrorState error={error} onRetry={load} /> : !preview ? <div className="space-y-2"><Skeleton className="h-24" /><Skeleton className="h-16" /></div> : (
        <div className="space-y-4 text-[13.5px]">
          <div>
            <div className="mb-1.5 font-bold text-rose-700">삭제되는 정보 · {preview.schoolName}</div>
            <ul className="grid gap-1 rounded-xl bg-rose-50/60 p-3 sm:grid-cols-2">
              {preview.deletes.map((i) => <li key={i.label} className="flex justify-between gap-2"><span className="text-ink-600">{i.label}</span><b className="tabular-nums">{i.count.toLocaleString()}</b></li>)}
            </ul>
          </div>
          <div>
            <div className="mb-1.5 font-bold text-ink-700">보존되는 기록 (회계·법적 보존)</div>
            <ul className="grid gap-1 rounded-xl bg-ink-50 p-3 sm:grid-cols-2">
              {preview.retains.map((i) => <li key={i.label} className="flex justify-between gap-2"><span className="text-ink-600">{i.label}</span><b className="tabular-nums">{i.count.toLocaleString()}</b></li>)}
            </ul>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-[12.5px] text-ink-500">{preview.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          <Input label={`확인을 위해 학교 이름 '${preview.confirmText}'을(를) 입력하세요`} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
        </div>
      )}
    </Modal>
  );
}
