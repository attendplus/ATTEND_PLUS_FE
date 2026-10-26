import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { ArrowLeft, ArrowRight, Building2, Check, Copy, GraduationCap, MapPin, PartyPopper, Search, UserRound } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { api, ApiError } from "@/api/client";
import type { Gender, Role } from "@/api/types";
import { Button, Checkbox, ErrorBanner, Input, Segmented, Spinner } from "@/components/ui";
import { PASSWORD_RULE } from "@/lib/format";
import AuthLayout from "./AuthLayout";
import EmailVerifyField from "./EmailVerifyField";
import PasswordFields from "./PasswordFields";

interface DbSchool { scId: number; name: string; type?: string | null; address?: string | null; officeName?: string | null }
interface NeisSchool { neisCode: string; officeCode: string; officeName?: string; name: string; type?: string; address?: string; addressDetail?: string; zipCode?: string; [k: string]: unknown }

const ROLES: { value: Role; title: string; desc: string; icon: ReactNode }[] = [
  { value: "STUDENT", title: "학생", desc: "학급 가입 코드로 우리 반에 가입해요", icon: <UserRound className="h-5 w-5" /> },
  { value: "TEACHER", title: "교사", desc: "학교 인증 코드로 소속 학교에 가입해요", icon: <GraduationCap className="h-5 w-5" /> },
  { value: "SCHOOL_ADMIN", title: "학교 관리자", desc: "우리 학교를 처음으로 등록해요", icon: <Building2 className="h-5 w-5" /> },
];

const STEPS = ["가입 유형", "계정", "프로필", "소속", "약관 동의"];
const STEP_HINT = [
  "어떤 사용자로 가입하는지 골라주세요.",
  "로그인에 쓸 이메일을 인증하고 비밀번호를 정해주세요.",
  "실명과 기본 정보를 입력해주세요.",
  "소속 학교와 가입 코드를 입력해주세요.",
  "약관을 확인하고 가입을 마쳐주세요.",
];

// 학번 = 학년(1) + 반(2) + 번호(2). 번호는 학번에서 계산합니다. (예: 30201 → 3학년 2반 1번)
function parseStudentId(id: string) {
  if (!/^\d{5}$/.test(id)) return null;
  const grade = Number(id[0]), cls = Number(id.slice(1, 3)), no = Number(id.slice(3));
  return cls > 0 && no > 0 ? { grade, cls, no } : null;
}

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

function SchoolSearch({ role, selected, onSelect }: { role: Role; selected: DbSchool | NeisSchool | null; onSelect: (s: DbSchool | NeisSchool) => void }) {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<(DbSchool | NeisSchool)[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = useDebounced(keyword);
  const isAdmin = role === "SCHOOL_ADMIN";

  useEffect(() => {
    if (q.trim().length < (isAdmin ? 2 : 1)) { setResults([]); return; }
    setLoading(true);
    setError(null);
    const req = isAdmin ? api.get<{ schools: NeisSchool[] }>("/admin/auth/neis-schools", { keyword: q }) : api.get<{ schools: DbSchool[] }>("/schools/search", { keyword: q });
    req.then((r) => setResults(r.schools)).catch((e) => setError(e instanceof ApiError ? e.message : "검색에 실패했습니다.")).finally(() => setLoading(false));
  }, [q, isAdmin]);

  const keyOf = (s: DbSchool | NeisSchool) => ("scId" in s ? `db-${s.scId}` : `neis-${s.neisCode}`);
  return (
    <div>
      <Input label={isAdmin ? "등록할 학교 검색 (NEIS)" : "소속 학교 검색"} required placeholder="학교 이름을 입력하세요" value={keyword} onChange={(e) => setKeyword(e.target.value)}
        right={loading ? <Spinner className="mr-1.5 h-4 w-4" /> : <Search className="mr-1.5 h-4 w-4 text-ink-400" />}
        hint={isAdmin ? "나이스 학교기본정보에서 검색하며, 학교 주소가 자동 입력됩니다." : "출결플러스에 등록된 학교만 검색됩니다."} error={error} />
      <div className="scrollbar-thin mt-2 max-h-56 space-y-1.5 overflow-y-auto">
        <AnimatePresence initial={false}>
          {results.map((s, i) => {
            const active = selected && keyOf(selected) === keyOf(s);
            return (
              <motion.button type="button" key={keyOf(s)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} onClick={() => onSelect(s)}
                className={clsx("flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left ring-1 transition", active ? "bg-brand-50 ring-brand-300" : "bg-white ring-ink-200 hover:ring-brand-200")}>
                <div className={clsx("grid h-8 w-8 shrink-0 place-items-center rounded-lg", active ? "bg-brand-500 text-white" : "bg-ink-100 text-ink-500")}>
                  {active ? <Check className="h-4 w-4" strokeWidth={3} /> : <Building2 className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold">{s.name}</div>
                  <div className="truncate text-[12px] text-ink-500">{[s.type, s.address].filter(Boolean).join(" · ")}</div>
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
        {q && !loading && results.length === 0 && !error && <div className="py-4 text-center text-[13px] text-ink-500">검색 결과가 없습니다.</div>}
      </div>
    </div>
  );
}

export default function Signup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  // 랜딩의 역할 카드에서 들어오면 ?role=TEACHER 처럼 가입 유형을 미리 골라 둡니다.
  const [params] = useSearchParams();
  const [role, setRole] = useState<Role>(() => (["STUDENT", "TEACHER", "SCHOOL_ADMIN"] as Role[]).find((r) => r === params.get("role")) ?? "STUDENT");
  const [email, setEmail] = useState("");
  const [verified, setVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("MALE");
  const [isForeign, setIsForeign] = useState(false);
  const [school, setSchool] = useState<DbSchool | NeisSchool | null>(null);
  const [code, setCode] = useState("");
  const [studentId, setStudentId] = useState("");
  const parsedId = parseStudentId(studentId);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ accessCode?: string } | null>(null);

  const go = (next: number) => { setError(null); setDir(next > step ? 1 : -1); setStep(next); };

  const validate = (): string | null => {
    if (step === 1) {
      if (!verified) return "이메일 인증을 완료해주세요.";
      if (!PASSWORD_RULE.test(password)) return "비밀번호는 영문 대·소문자, 숫자, 특수문자를 포함해 8~64자로 입력해주세요.";
      if (password !== confirm) return "비밀번호가 일치하지 않습니다.";
    }
    if (step === 2 && !name.trim()) return "필수 정보를 모두 입력해주세요.";
    if (step === 3) {
      if (!school) return "소속 학교를 선택해주세요.";
      if (role === "STUDENT" && !code) return "학급 고유 가입 코드를 입력해주세요.";
      if (role === "STUDENT" && !parsedId) return "학번 5자리를 정확히 입력해주세요. (예: 30201)";
      if (role === "TEACHER" && !code) return "학교 고유 인증 코드를 입력해주세요.";
    }
    return null;
  };

  const next = () => { const v = validate(); if (v) return setError(v); go(step + 1); };

  const submit = async () => {
    if (!agreeTerms || !agreePrivacy) return setError("서비스 이용약관에 동의해주세요.");
    setSubmitting(true);
    setError(null);
    const base = { email, password, passwordConfirm: confirm, name: name.trim(), gender, isForeign, agreeTerms: true };
    try {
      if (role === "STUDENT") {
        await api.post("/student/auth/signup", { ...base, scId: (school as DbSchool).scId, classCode: code.trim(), studentId: Number(studentId), studentNumber: parsedId!.no });
        setDone({});
      } else if (role === "TEACHER") {
        await api.post("/teacher/auth/signup", { ...base, scId: (school as DbSchool).scId, schoolCode: code.trim() });
        setDone({});
      } else {
        const r = await api.post<{ accessCode: string }>("/admin/auth/signup", { ...base, school });
        setDone({ accessCode: r.accessCode });
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "회원가입에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <AuthLayout>
        <div className="text-center">
          <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}
            className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-mint-500 to-brand-500 text-white shadow-lift">
            <PartyPopper className="h-9 w-9" />
          </motion.div>
          {Array.from({ length: 14 }).map((_, i) => (
            <motion.span key={i} className="pointer-events-none absolute left-1/2 top-1/3 h-2 w-2 rounded-sm" style={{ background: ["#2B5793", "#12B886", "#F59F00", "#F03E3E"][i % 4] }}
              initial={{ x: 0, y: 0, opacity: 1 }} animate={{ x: Math.cos(i) * 180, y: Math.sin(i) * 140 + 80, opacity: 0, rotate: 360 }} transition={{ duration: 1.4, ease: "easeOut" }} />
          ))}
          <h1 className="mt-6 text-[26px] font-extrabold">가입을 환영합니다!</h1>
          <p className="mt-2 text-[14.5px] text-ink-500">
            {role === "STUDENT" ? "담임 선생님이 학급 가입을 승인하면 출석 기능을 이용할 수 있어요." : role === "TEACHER" ? "로그인 후 담임 학급을 확인해주세요." : "학교 등록이 완료되었습니다. 아래 인증 코드를 선생님들께 공유해주세요."}
          </p>
          {done.accessCode && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-ink-200">
              <div className="text-[12.5px] font-semibold text-ink-500">학교 고유 인증 코드</div>
              <div className="mt-1 flex items-center justify-center gap-3">
                <span className="font-mono text-[26px] font-bold tracking-[0.2em] text-brand-600">{done.accessCode}</span>
                <button onClick={() => { navigator.clipboard?.writeText(done.accessCode!); toast.success("복사했습니다."); }} className="rounded-lg p-2 text-ink-400 hover:bg-ink-100"><Copy className="h-4 w-4" /></button>
              </div>
            </motion.div>
          )}
          <Button size="lg" className="mt-8 w-full" onClick={() => navigate("/login")}>로그인하러 가기</Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight">회원가입</h1>
          <p className="mt-1 text-[14px] text-ink-500">{STEP_HINT[step]}</p>
        </div>
        <div className="shrink-0 rounded-full bg-ink-100 px-2.5 py-1 text-[12px] font-semibold text-ink-500">{step + 1} / {STEPS.length}</div>
      </div>
      {/* 단계 표시: 지난 단계는 체크, 현재 단계는 강조 */}
      <ol className="mb-6 grid grid-cols-5 gap-1.5" aria-label="가입 단계">
        {STEPS.map((s, i) => (
          <li key={s} className="min-w-0">
            <div className="h-1.5 overflow-hidden rounded-full bg-ink-200">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600" initial={false} animate={{ width: i <= step ? "100%" : "0%" }} transition={{ type: "spring", stiffness: 200, damping: 30 }} />
            </div>
            <div className={clsx("mt-1.5 flex items-center gap-1 truncate text-[11.5px] font-semibold", i === step ? "text-brand-700" : i < step ? "text-ink-500" : "text-ink-400")}>
              {i < step && <Check className="h-3 w-3 shrink-0" strokeWidth={3} />}<span className="truncate">{s}</span>
            </div>
          </li>
        ))}
      </ol>

      <ErrorBanner message={error} />

      <div className="relative min-h-[320px]">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div key={step} custom={dir} initial={{ opacity: 0, x: dir * 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -40 }} transition={{ type: "spring", stiffness: 320, damping: 32 }} className="space-y-4">
            {step === 0 && ROLES.map((r) => (
              <motion.button key={r.value} type="button" whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }} onClick={() => { setRole(r.value); setSchool(null); }}
                className={clsx("flex w-full items-center gap-4 rounded-2xl p-4 text-left ring-1 transition", role === r.value ? "bg-white shadow-lift ring-2 ring-brand-400" : "bg-white/70 ring-ink-200 hover:bg-white")}>
                <div className={clsx("grid h-12 w-12 place-items-center rounded-xl transition", role === r.value ? "bg-brand-500 text-white" : "bg-ink-100 text-ink-500")}>{r.icon}</div>
                <div className="flex-1">
                  <div className="text-[15.5px] font-bold">{r.title}</div>
                  <div className="text-[13px] text-ink-500">{r.desc}</div>
                </div>
                <div className={clsx("grid h-6 w-6 place-items-center rounded-full ring-2 transition", role === r.value ? "bg-brand-500 ring-brand-500" : "ring-ink-300")}>
                  {role === r.value && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                </div>
              </motion.button>
            ))}

            {step === 1 && (
              <>
                <EmailVerifyField email={email} setEmail={setEmail} verified={verified} setVerified={setVerified} />
                <PasswordFields password={password} setPassword={setPassword} confirm={confirm} setConfirm={setConfirm} />
              </>
            )}

            {step === 2 && (
              <>
                <Input label="이름 (실명)" required placeholder="홍길동" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} />
                <div>
                  <span className="label">성별 <span className="text-brand-500">*</span></span>
                  <Segmented value={gender} onChange={setGender} options={[{ value: "MALE", label: "남성" }, { value: "FEMALE", label: "여성" }]} />
                  <p className="mt-1.5 text-[12.5px] text-ink-500">성별에 따라 기본 프로필 사진이 등록됩니다.</p>
                </div>
                <Checkbox checked={isForeign} onChange={setIsForeign}>외국인입니다</Checkbox>
              </>
            )}

            {step === 3 && (
              <>
                <SchoolSearch role={role} selected={school} onSelect={setSchool} />
                {role === "SCHOOL_ADMIN" && school && "neisCode" in school && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2.5 rounded-xl bg-brand-50 p-3.5 text-[13px] text-brand-800">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    <div><div className="font-semibold">학교 주소 (자동 입력)</div>{[school.address, school.addressDetail].filter(Boolean).join(" ") || "주소 정보 없음"}</div>
                  </motion.div>
                )}
                {role === "STUDENT" && (
                  <>
                    <Input label="학급 고유 가입 코드" required placeholder="담임 선생님께 받은 코드" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} hint="가입 코드가 없으면 회원가입을 할 수 없습니다." />
                    <Input label="학번" required inputMode="numeric" placeholder="예: 30201" value={studentId} maxLength={5}
                      onChange={(e) => setStudentId(e.target.value.replace(/\D/g, "").slice(0, 5))}
                      hint={parsedId ? `→ ${parsedId.grade}학년 ${parsedId.cls}반 ${parsedId.no}번` : "학년(1자리)·반(2자리)·번호(2자리) 5자리예요. 번호는 학번에서 자동으로 정해져요."}
                      error={studentId.length === 5 && !parsedId ? "반과 번호가 0이 아닌 5자리 학번을 입력해주세요." : null} />
                  </>
                )}
                {role === "TEACHER" && <Input label="학교 고유 인증 코드" required placeholder="학교 관리자에게 받은 코드" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} hint="인증 코드가 없으면 회원가입을 할 수 없습니다." />}
              </>
            )}

            {step === 4 && (
              <div className="space-y-3">
                <div className="rounded-2xl bg-white p-4 ring-1 ring-ink-200">
                  <Checkbox checked={agreeTerms && agreePrivacy} onChange={(v) => { setAgreeTerms(v); setAgreePrivacy(v); }}>
                    <span className="font-bold text-ink-900">전체 동의</span>
                  </Checkbox>
                  <div className="my-3 h-px bg-ink-100" />
                  <div className="space-y-2.5">
                    <Checkbox checked={agreeTerms} onChange={setAgreeTerms}>[필수] 서비스 이용약관 동의</Checkbox>
                    <Checkbox checked={agreePrivacy} onChange={setAgreePrivacy}>[필수] 개인정보(위치 정보 포함) 수집·이용 동의</Checkbox>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-8 flex gap-2">
        {step > 0 && <Button variant="secondary" size="lg" onClick={() => go(step - 1)}><ArrowLeft className="h-4 w-4" /></Button>}
        {step < STEPS.length - 1 ? (
          <Button size="lg" className="flex-1" onClick={next}>다음 <ArrowRight className="h-4 w-4" /></Button>
        ) : (
          <Button size="lg" className="flex-1" onClick={submit} loading={submitting}>가입 완료</Button>
        )}
      </div>
      <p className="mt-6 text-center text-[13.5px] text-ink-500">이미 계정이 있나요? <Link to="/login" className="font-bold text-brand-600 hover:underline">로그인</Link></p>
    </AuthLayout>
  );
}
