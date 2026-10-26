import clsx from "clsx";
import { Check } from "lucide-react";
import { PasswordInput } from "@/components/ui";

export const passwordChecks = (pw: string) => [
  { label: "8자 이상", ok: pw.length >= 8 },
  { label: "대·소문자", ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
  { label: "숫자", ok: /\d/.test(pw) },
  { label: "특수문자", ok: /[^A-Za-z0-9]/.test(pw) },
];

export default function PasswordFields({ password, setPassword, confirm, setConfirm, label = "비밀번호" }: {
  password: string; setPassword: (v: string) => void; confirm: string; setConfirm: (v: string) => void; label?: string;
}) {
  const checks = passwordChecks(password);
  return (
    <div className="space-y-3">
      <PasswordInput label={label} required placeholder="영문 대·소문자, 숫자, 특수문자 포함 8자 이상" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
      <div className="flex flex-wrap gap-1.5">
        {checks.map((c) => (
          <span key={c.label} className={clsx("chip transition-colors", c.ok ? "bg-mint-50 text-mint-600" : "bg-ink-100 text-ink-400")}>
            <Check className="h-3 w-3" strokeWidth={3} />{c.label}
          </span>
        ))}
      </div>
      <PasswordInput label={`${label} 확인`} required placeholder="한 번 더 입력" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password"
        error={confirm && confirm !== password ? "비밀번호가 일치하지 않습니다." : null} />
    </div>
  );
}
