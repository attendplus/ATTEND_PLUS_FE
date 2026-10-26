import clsx from "clsx";
import { CheckCircle2, FlaskConical, Mail, MailCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { Button, Input } from "@/components/ui";
import { digits } from "./pgSandbox";

// *
// 이메일 본인 인증 — 결제 수단(카드·계좌) 등록 전 필수
// 인증번호는 서버가 만들어 로그인한 관리자의 등록 이메일로 보내고, 서버가 확인합니다. (POST /admin/billing/verifications, .../{id}/confirm)
// 받을 수 없는 점검용 주소이거나 메일 설정이 없으면 데모 환경에서만 화면에 데모 인증번호를 보여줍니다.
// *
type Sent = { verificationId: number; emailMasked: string; delivery: "EMAIL" | "DEMO"; expiresAt: string; resendAfterSeconds: number; demoCode: string | null };

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
const maskEmail = (email: string) => { const [local, domain] = email.split("@"); return domain ? `${local.slice(0, 2)}${"*".repeat(Math.max(1, local.length - 2))}@${domain}` : email; };

export default function EmailVerification({ purpose, onVerified, showError, disabled }: {
  purpose: "CARD" | "BANK_TRANSFER"; onVerified: (verificationId: number | null) => void; showError?: boolean; disabled?: boolean;
}) {
  const { profile } = useAuth();
  const [sent, setSent] = useState<Sent | null>(null);
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState<"send" | "confirm" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const sentAt = useRef(0);
  useEffect(() => { if (!sent || verified) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [sent, verified]);

  const email = profile?.email ? maskEmail(profile.email) : null;
  const left = sent ? Math.max(0, Math.round((new Date(sent.expiresAt).getTime() - now) / 1000)) : 0;
  const resendIn = sent ? Math.max(0, sent.resendAfterSeconds - Math.round((now - sentAt.current) / 1000)) : 0;

  const send = async () => {
    setBusy("send"); setError(null);
    try {
      const r = await api.post<Sent>("/admin/billing/verifications", { purpose });
      sentAt.current = Date.now(); setNow(Date.now());
      setSent(r); setCode(""); setVerified(false); onVerified(null);
    } catch (e) { setError(e instanceof ApiError ? e.message : "인증번호를 보내지 못했어요."); } finally { setBusy(null); }
  };
  const confirm = async () => {
    if (!sent) return;
    setBusy("confirm"); setError(null);
    try {
      await api.post(`/admin/billing/verifications/${sent.verificationId}/confirm`, { code });
      setVerified(true); onVerified(sent.verificationId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "인증번호를 확인하지 못했어요.");
      if (e instanceof ApiError && (e.code === "BILL425" || e.code === "BILL426")) { setSent(null); setCode(""); }
    } finally { setBusy(null); }
  };

  if (verified && sent) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-mint-50 px-4 py-3 text-[13.5px] font-bold text-mint-700 ring-1 ring-mint-500/25">
        <CheckCircle2 className="h-4 w-4" />{sent.emailMasked} 이메일 본인 인증 완료
      </div>
    );
  }

  return (
    <div className={clsx("space-y-3 rounded-2xl bg-white p-4 ring-1", showError && !verified ? "ring-rose-300" : "ring-ink-200/80")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[14px] font-bold text-ink-900"><Mail className="h-4 w-4 text-brand-500" />이메일 본인 인증<span className="text-brand-500">*</span></div>
          <div className="mt-0.5 text-[13px] text-ink-500">등록된 이메일 <b className="text-ink-800">{email ?? "없음"}</b>로 인증번호를 보내요.</div>
        </div>
        <Button variant={sent ? "secondary" : "primary"} className="whitespace-nowrap" loading={busy === "send"} disabled={disabled || !email || (!!sent && resendIn > 0)} onClick={send}>
          {sent ? (resendIn > 0 ? `다시 받기 (${resendIn}초)` : "다시 받기") : "인증번호 받기"}
        </Button>
      </div>
      {!email && <p className="text-[13px] text-rose-600">등록된 이메일이 없어요. <Link to="/profile" className="font-bold underline">내 정보</Link>에서 이메일을 등록해 주세요.</p>}
      {sent && (
        <>
          {sent.delivery === "DEMO" ? (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[13px] leading-5 text-amber-800 ring-1 ring-amber-500/25">
              <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" />
              <span>이 주소로는 메일을 보낼 수 없어 화면에 보여드려요 (데모). 인증번호 <b className="font-mono text-[15px] tracking-widest">{sent.demoCode}</b></span>
            </p>
          ) : (
            <p className="flex items-start gap-2 text-[13px] leading-5 text-ink-600"><MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
              {sent.emailMasked}로 인증번호를 보냈어요. 메일이 보이지 않으면 스팸함도 확인해 주세요.</p>
          )}
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <Input aria-label="인증번호" inputMode="numeric" autoComplete="one-time-code" placeholder="인증번호 6자리" maxLength={6} disabled={disabled || left === 0}
              value={code} onChange={(e) => setCode(digits(e.target.value).slice(0, 6))}
              right={<span className={clsx("pr-1 font-mono text-[12.5px] font-bold", left > 30 ? "text-brand-600" : "text-rose-600")}>{mmss(left)}</span>} />
            <Button className="whitespace-nowrap" loading={busy === "confirm"} disabled={disabled || code.length !== 6 || left === 0} onClick={confirm}>확인</Button>
          </div>
          {left === 0 && <p className="text-[12.5px] text-rose-600">인증 시간이 지났어요. 인증번호를 다시 받아 주세요.</p>}
        </>
      )}
      {error && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-[13px] leading-5 text-rose-700 ring-1 ring-rose-500/20">{error}</p>}
      <p className="text-[12px] leading-5 text-ink-500">인증번호는 3분 동안 유효하고 5회까지 입력할 수 있어요. 받을 이메일은 <Link to="/profile" className="font-semibold underline">내 정보</Link>에서 바꿀 수 있어요.</p>
    </div>
  );
}
