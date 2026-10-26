import { ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, ApiError } from "@/api/client";
import { homePath, useAuth } from "@/auth/AuthContext";
import { Button, ErrorBanner, PasswordInput } from "@/components/ui";
import { PASSWORD_RULE } from "@/lib/format";
import AuthLayout from "./AuthLayout";
import PasswordFields from "./PasswordFields";

// 임시 비밀번호로 생성된 계정의 최초 비밀번호 변경
export default function ChangePassword() {
  const { profile, refresh } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!PASSWORD_RULE.test(password)) return setError("비밀번호는 영문, 숫자, 특수문자를 포함하여 8자 이상 입력해주세요.");
    if (password !== confirm) return setError("비밀번호가 일치하지 않습니다.");
    setLoading(true);
    try {
      await api.patch("/auth/password", { currentPassword: current, newPassword: password, newPasswordConfirm: confirm });
      const me = await refresh();
      toast.success("비밀번호가 변경되었습니다.");
      navigate(homePath(me?.role ?? profile!.role), { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "비밀번호 변경에 실패했습니다.");
    } finally { setLoading(false); }
  };

  return (
    <AuthLayout>
      <div className="mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-600"><ShieldAlert className="h-6 w-6" /></div>
      <h1 className="text-[26px] font-extrabold tracking-tight">새 비밀번호를 설정해주세요</h1>
      <p className="mt-1 text-[14px] text-ink-500">담임 선생님이 발급한 임시 비밀번호로 로그인했어요. 안전을 위해 비밀번호를 변경해야 합니다.</p>
      <div className="mt-7 space-y-4">
        <ErrorBanner message={error} />
        <PasswordInput label="임시 비밀번호" required value={current} onChange={(e) => setCurrent(e.target.value)} />
        <PasswordFields password={password} setPassword={setPassword} confirm={confirm} setConfirm={setConfirm} label="새 비밀번호" />
        <Button size="lg" className="w-full" onClick={submit} loading={loading}>변경하고 시작하기</Button>
      </div>
    </AuthLayout>
  );
}
