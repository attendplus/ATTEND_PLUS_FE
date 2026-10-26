import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { ArrowRight, Hash, Info, Mail, School, Search } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "@/api/client";
import { homePath, useAuth } from "@/auth/AuthContext";
import { Button, ErrorBanner, Input, PasswordInput, Spinner } from "@/components/ui";
import AuthLayout from "./AuthLayout";

type Mode = "account" | "student";
interface SchoolOption { scId: number; name: string; address?: string | null }

// 임시 계정 로그인에서 고른 학교는 서버가 HttpOnly 쿠키(ap_login_school)로 기억합니다. (브라우저 저장소 사용 안 함)
// GET /auth/login/school 로 불러오고, '변경'을 누르면 DELETE /auth/login/school 로 지웁니다.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MODES: { value: Mode; title: string; desc: string; icon: JSX.Element }[] = [
  { value: "account", title: "내 계정", desc: "이메일로 로그인", icon: <Mail className="h-4 w-4" /> },
  { value: "student", title: "임시 계정", desc: "학번으로 로그인", icon: <Hash className="h-4 w-4" /> },
];

// *
// 로그인
// - 내 계정: 이메일 + 비밀번호 (POST /auth/login)
// - 임시 계정: 학교 + 학번 + 비밀번호 (POST /auth/login/student-id)
// 입력값은 보내기 전에 형식을 확인하고, 서버 오류는 위쪽 배너로 보여 줍니다.
// *
export default function Login() {
  const { login, loginWithStudentId } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("account");
  const [email, setEmail] = useState("");
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [school, setSchool] = useState<SchoolOption | null>(null);
  useEffect(() => {
    api.get<SchoolOption | null>("/auth/login/school").then((s) => { if (s) setSchool((cur) => cur ?? s); }).catch(() => undefined);
  }, []);
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<SchoolOption[]>([]);
  const [searchState, setSearchState] = useState<"idle" | "loading" | "ok" | "empty" | "error">("idle");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 학교 검색 (GET /schools/search) — 입력이 멈추면 검색합니다.
  useEffect(() => {
    if (mode !== "student" || school || keyword.trim().length < 2) { setResults([]); setSearchState("idle"); return; }
    setSearchState("loading");
    const t = setTimeout(() => {
      api.get<{ schools: SchoolOption[] }>("/schools/search", { keyword: keyword.trim() })
        .then((r) => { setResults(r.schools.slice(0, 8)); setSearchState(r.schools.length ? "ok" : "empty"); })
        .catch(() => { setResults([]); setSearchState("error"); });
    }, 250);
    return () => clearTimeout(t);
  }, [keyword, mode, school]);

  // 필드별 검증 메시지 (제출을 한 번 시도한 뒤부터 보여 줍니다)
  const fieldError = {
    email: !email ? "이메일을 입력해주세요." : !EMAIL_RE.test(email.trim()) ? "이메일 형식이 올바르지 않아요." : null,
    school: !school ? "학교를 검색해 선택해주세요." : null,
    studentId: !studentId ? "학번을 입력해주세요." : studentId.length !== 5 ? "학번은 5자리예요. (예: 30201)" : null,
    password: !password ? "비밀번호를 입력해주세요." : null,
  };
  const invalid = mode === "account" ? fieldError.email || fieldError.password : fieldError.school || fieldError.studentId || fieldError.password;

  const switchMode = (m: Mode) => { setMode(m); setError(null); setTouched(false); setPassword(""); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (invalid) return;
    setLoading(true);
    setError(null);
    try {
      const me = mode === "account"
        ? await login(email.trim(), password)
        : await loginWithStudentId(school!.scId, Number(studentId), password);
      navigate(me.mustChangePassword ? "/change-password" : homePath(me.role), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "로그인에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="text-[26px] font-extrabold tracking-tight text-ink-950">로그인</h1>
      <p className="mt-1 text-[14px] text-ink-500">어떤 계정으로 로그인할지 먼저 골라주세요.</p>

      {/* 두 카드는 같은 높이·같은 정렬(아이콘 → 제목 → 설명 한 줄) */}
      <div role="tablist" aria-label="로그인 방식" className="mt-6 grid grid-cols-2 gap-2.5">
        {MODES.map((m) => {
          const active = mode === m.value;
          return (
            <button key={m.value} type="button" role="tab" aria-selected={active} onClick={() => switchMode(m.value)}
              className={clsx("flex h-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left ring-1 transition",
                active ? "bg-brand-50 ring-2 ring-brand-500" : "bg-white ring-ink-200 hover:bg-ink-50")}>
              <span className={clsx("hidden h-9 w-9 shrink-0 place-items-center rounded-xl min-[400px]:grid", active ? "bg-brand-500 text-white" : "bg-ink-100 text-ink-500")}>{m.icon}</span>
              <span className="min-w-0">
                <span className={clsx("block text-[14px] font-bold leading-5", active ? "text-brand-700" : "text-ink-800")}>{m.title}</span>
                <span className="block truncate text-[12px] leading-4 text-ink-500">{m.desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      <form onSubmit={submit} noValidate className="mt-6 space-y-4">
        <ErrorBanner message={error} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={mode} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }} className="space-y-4">
            {mode === "account" ? (
              <Input label="이메일" type="email" autoComplete="email" placeholder="name@school.kr" value={email} onChange={(e) => setEmail(e.target.value)}
                right={<Mail className="mr-1.5 h-4 w-4 text-ink-400" />} error={touched ? fieldError.email : null} />
            ) : (
              <>
                {school ? (
                  <div>
                    <span className="label">학교</span>
                    <div className="flex items-center justify-between rounded-xl bg-white px-3.5 py-2.5 ring-1 ring-ink-200">
                      <span className="flex items-center gap-2 font-semibold"><School className="h-4 w-4 text-brand-500" />{school.name}</span>
                      <button type="button" onClick={() => { setSchool(null); setKeyword(""); api.del("/auth/login/school").catch(() => undefined); }} className="text-[12.5px] font-semibold text-brand-600 hover:underline">변경</button>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <Input label="학교" placeholder="학교 이름 2글자 이상" value={keyword} onChange={(e) => setKeyword(e.target.value)}
                      right={searchState === "loading" ? <Spinner className="mr-1.5 h-4 w-4" /> : <Search className="mr-1.5 h-4 w-4 text-ink-400" />}
                      error={searchState === "error" ? "학교를 검색하지 못했어요. 잠시 후 다시 시도해주세요." : touched ? fieldError.school : null}
                      hint={searchState === "empty" ? "검색 결과가 없어요. 학교 이름을 확인해주세요." : undefined} />
                    {results.length > 0 && (
                      <div className="absolute inset-x-0 z-10 mt-1 overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-ink-200">
                        {results.map((s) => (
                          <button key={s.scId} type="button" onClick={() => { setSchool(s); setResults([]); }} className="block w-full px-3.5 py-2.5 text-left hover:bg-ink-50">
                            <div className="text-[14px] font-semibold">{s.name}</div>
                            {s.address && <div className="truncate text-[12px] text-ink-500">{s.address}</div>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <Input label="학번" inputMode="numeric" autoComplete="username" placeholder="예: 30201 (학년·반·번호)" value={studentId}
                  onChange={(e) => setStudentId(e.target.value.replace(/\D/g, "").slice(0, 5))} right={<Hash className="mr-1.5 h-4 w-4 text-ink-400" />}
                  error={touched ? fieldError.studentId : null} />
              </>
            )}
            <PasswordInput label="비밀번호" autoComplete="current-password" placeholder={mode === "student" ? "처음에는 담임 선생님이 알려준 임시 비밀번호" : "비밀번호"}
              value={password} onChange={(e) => setPassword(e.target.value)} error={touched ? fieldError.password : null} />
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between gap-3 text-[12.5px]">
          {mode === "account"
            ? <><span className="text-ink-400">학번 계정은 '임시 계정'을 눌러주세요.</span><Link to="/find-password" className="font-semibold text-brand-600 hover:underline">비밀번호 찾기</Link></>
            : <span className="flex items-center gap-1 text-ink-500"><Info className="h-3.5 w-3.5" />비밀번호를 잊었다면 담임 선생님께 문의하세요.</span>}
        </div>
        <Button type="submit" size="lg" className="w-full" loading={loading}>{loading ? "로그인하는 중…" : <>로그인 <ArrowRight className="h-4 w-4" /></>}</Button>
      </form>

      <div className="mt-6 rounded-2xl bg-ink-50 p-4 text-center text-[13.5px] text-ink-600">
        처음이신가요? <Link to="/signup" className="font-bold text-brand-600 hover:underline">회원가입</Link>
        <div className="mt-1 text-[12px] text-ink-400">학생은 담임 선생님께 받은 학급 가입 코드가 필요해요.</div>
      </div>
    </AuthLayout>
  );
}
