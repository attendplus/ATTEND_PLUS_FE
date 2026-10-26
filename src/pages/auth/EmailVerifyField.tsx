import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/api/client";
import { Button, Input } from "@/components/ui";

// 이메일 입력 + 인증번호 발송/확인 (5분 타이머)
export default function EmailVerifyField({ email, setEmail, verified, setVerified, purpose = "SIGNUP" }: {
  email: string; setEmail: (v: string) => void; verified: boolean; setVerified: (v: boolean) => void; purpose?: "SIGNUP" | "RESET_PASSWORD";
}) {
  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [left, setLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setLeft(Math.max(0, Math.round((expiresAt - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  const send = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("올바른 이메일 형식으로 입력해주세요.");
    setSending(true); setError(null);
    try {
      const r = await api.post<{ expiresAt: string }>("/auth/email/send", { email, purpose });
      setExpiresAt(new Date(r.expiresAt).getTime() || Date.now() + 5 * 60 * 1000);
      setVerified(false);
      setCode("");
      toast.success(`${email}로 인증번호를 보냈어요.`, { description: "메일이 보이지 않으면 스팸함도 확인해주세요." });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "인증번호 발송에 실패했습니다.");
    } finally { setSending(false); }
  };

  const verify = async () => {
    setChecking(true); setError(null);
    try {
      await api.post("/auth/email/verify", { email, code });
      setVerified(true);
      toast.success("이메일 인증이 완료되었습니다.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "인증에 실패했습니다.");
    } finally { setChecking(false); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <Input className="flex-1" label="이메일" required type="email" placeholder="name@school.kr" value={email} disabled={verified}
          onChange={(e) => { setEmail(e.target.value); setVerified(false); }} />
        <Button type="button" variant={expiresAt ? "secondary" : "soft"} onClick={send} loading={sending} disabled={verified} className="shrink-0">
          {expiresAt ? "재발송" : "인증요청"}
        </Button>
      </div>
      <AnimatePresence initial={false}>
        {verified ? (
          <motion.div key="ok" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2 rounded-xl bg-mint-50 px-3.5 py-2.5 text-[13.5px] font-semibold text-mint-600">
            <CheckCircle2 className="h-4 w-4" /> 이메일 인증 완료
          </motion.div>
        ) : expiresAt ? (
          <motion.div key="code" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-start gap-2 overflow-hidden">
            <Input className="flex-1" placeholder="인증번호 6자리" inputMode="numeric" maxLength={6} value={code} error={error}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              right={<span className={`mr-1 text-[12.5px] font-semibold tabular-nums ${left < 60 ? "text-rose-500" : "text-ink-400"}`}>{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>} />
            <Button type="button" onClick={verify} loading={checking} disabled={code.length !== 6 || left === 0}>확인</Button>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {!expiresAt && error && <p className="text-[12.5px] font-medium text-rose-500">{error}</p>}
      {expiresAt && !verified && <p className="text-[12px] text-ink-500">메일이 오지 않으면 스팸함을 확인하거나 1분 뒤 재발송해주세요.</p>}
    </div>
  );
}
