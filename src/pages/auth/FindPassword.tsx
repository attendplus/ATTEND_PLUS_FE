import { ArrowLeft, KeyRound } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, ApiError } from "@/api/client";
import { Button, ErrorBanner } from "@/components/ui";
import { PASSWORD_RULE } from "@/lib/format";
import AuthLayout from "./AuthLayout";
import EmailVerifyField from "./EmailVerifyField";
import PasswordFields from "./PasswordFields";

export default function FindPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [verified, setVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!verified) return setError("이메일 인증을 완료해주세요.");
    if (!PASSWORD_RULE.test(password)) return setError("비밀번호는 영문, 숫자, 특수문자를 포함하여 8자 이상 입력해주세요.");
    if (password !== confirm) return setError("비밀번호가 일치하지 않습니다.");
    setLoading(true);
    try {
      await api.post("/auth/password/reset", { email, newPassword: password, newPasswordConfirm: confirm });
      toast.success("비밀번호가 재설정되었습니다. 새 비밀번호로 로그인해주세요.");
      navigate("/login");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "비밀번호 재설정에 실패했습니다.");
    } finally { setLoading(false); }
  };

  return (
    <AuthLayout>
      <Link to="/login" className="mb-6 inline-flex items-center gap-1 text-[13px] font-semibold text-ink-500 hover:text-ink-900"><ArrowLeft className="h-4 w-4" /> 로그인으로</Link>
      <div className="mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600"><KeyRound className="h-6 w-6" /></div>
      <h1 className="text-[26px] font-extrabold tracking-tight">비밀번호 찾기</h1>
      <p className="mt-1 text-[14px] text-ink-500">가입한 이메일로 본인 인증 후 새 비밀번호를 설정하세요.</p>
      <div className="mt-7 space-y-4">
        <ErrorBanner message={error} />
        <EmailVerifyField email={email} setEmail={setEmail} verified={verified} setVerified={setVerified} purpose="RESET_PASSWORD" />
        <PasswordFields password={password} setPassword={setPassword} confirm={confirm} setConfirm={setConfirm} label="새 비밀번호" />
        <Button size="lg" className="w-full" onClick={submit} loading={loading} disabled={!verified}>비밀번호 재설정</Button>
      </div>
    </AuthLayout>
  );
}
