import clsx from "clsx";
import { CheckCircle2, CreditCard, FlaskConical, Lock, ShieldCheck } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/api/client";
import { Button, Checkbox, Input, Select } from "@/components/ui";
import type { Instrument } from "./billingStatus";
import EmailVerification from "./EmailVerification";
import {
  BRAND_LABEL, detectBrand, digits, formatCardNumber, formatExpiry, tokenizeBank, tokenizeCard, validateBank, validateCard,
  type BankField, type BankInput, type CardField, type CardInput, type HolderType, type Tokenized,
} from "./pgSandbox";

// *
// 결제 수단 입력 (신용카드 / 계좌이체)
// 이 입력 창은 실제 연동 때 결제 대행사 등록창이 들어갈 자리입니다. (pgSandbox.ts 참고)
// 입력값은 브라우저 안에서만 검사·토큰화되고, 서버에는 토큰과 표시용 정보(브랜드·은행, 끝 4자리)만 보냅니다.
// 등록 전에 관리자 등록 이메일 본인 인증(서버 인증번호)을 마쳐야 하고, 그 인증은 등록 1회에만 쓰입니다.
// *
async function saveInstrument(method: "CARD" | "BANK_TRANSFER", t: Tokenized, verificationId: number): Promise<Instrument> {
  return api.post<Instrument>("/admin/billing/payment-instruments", {
    method, token: t.token, last4: t.last4, holderType: t.holderType, brand: t.brand ?? null, bank: t.bank ?? null, verificationId,
  });
}

function StepBar({ steps, at }: { steps: string[]; at: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] font-semibold">
      {steps.map((s, i) => (
        <li key={s} className={clsx("flex items-center gap-1.5", i <= at ? "text-brand-700" : "text-ink-400")}>
          <span className={clsx("grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold", i < at ? "bg-mint-500 text-white" : i === at ? "bg-brand-500 text-white" : "bg-ink-100 text-ink-400")}>
            {i < at ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
          </span>{s}{i < steps.length - 1 && <span className="text-ink-300">›</span>}
        </li>
      ))}
    </ol>
  );
}

function SandboxNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 px-3.5 py-3 text-[12.5px] leading-5 text-amber-800 ring-1 ring-amber-500/25">
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><div>{children}</div>
    </div>
  );
}

function SecureNote() {
  return (
    <p className="flex items-start gap-1.5 text-[12px] leading-5 text-ink-500"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
      카드번호·CVC·비밀번호·계좌번호·생년월일은 출결플러스 서버로 보내지 않아요. 결제 대행사 토큰과 끝 4자리만 저장돼요.</p>
  );
}

function HolderFields({ type, id, onType, onId, error, disabled }: { type: HolderType; id: string; onType: (t: HolderType) => void; onId: (v: string) => void; error?: string; disabled?: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-start">
      <div>
        <div className="label">명의 구분<span className="ml-0.5 text-brand-500">*</span></div>
        <div role="radiogroup" aria-label="명의 구분" className="grid grid-cols-2 gap-1 rounded-xl bg-ink-100/80 p-1">
          {(["PERSONAL", "CORPORATE"] as HolderType[]).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={type === t} disabled={disabled} onClick={() => { onType(t); onId(""); }}
              className={clsx("rounded-lg px-3 py-2 text-[13px] font-bold transition", type === t ? "bg-white text-ink-950 shadow-sm ring-1 ring-ink-200" : "text-ink-500")}>
              {t === "PERSONAL" ? "개인" : "법인"}
            </button>
          ))}
        </div>
      </div>
      <Input label={type === "PERSONAL" ? "생년월일 (YYMMDD)" : "사업자등록번호"} required inputMode="numeric" autoComplete="off" disabled={disabled}
        placeholder={type === "PERSONAL" ? "예: 850101" : "숫자 10자리"} value={id} maxLength={type === "PERSONAL" ? 6 : 10}
        onChange={(e) => onId(digits(e.target.value).slice(0, type === "PERSONAL" ? 6 : 10))} error={error} />
    </div>
  );
}

// ── 신용카드 ──────────────────────────────────────────────────────────
const EMPTY_CARD: CardInput = { number: "", expiry: "", cvc: "", password2: "", holderType: "PERSONAL", holderId: "", agreed: false };

export function CardForm({ onRegistered, onCancel, replacing }: { onRegistered: (i: Instrument) => void; onCancel?: () => void; replacing?: string | null }) {
  const [card, setCard] = useState<CardInput>(EMPTY_CARD);
  const [touched, setTouched] = useState<Partial<Record<CardField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [verificationId, setVerificationId] = useState<number | null>(null);
  const [formKey, setFormKey] = useState(0);
  const errors = validateCard(card);
  const show = (f: CardField) => (submitted || touched[f]) ? errors[f] : undefined;
  const set = <K extends CardField>(k: K, v: CardInput[K]) => setCard((c) => ({ ...c, [k]: v }));
  const blur = (f: CardField) => () => setTouched((t) => ({ ...t, [f]: true }));
  const brand = digits(card.number) ? detectBrand(card.number) : null;
  const amex = brand === "AMEX";
  const missing = Object.keys(errors).length + (verificationId ? 0 : 1);
  const step = !verificationId ? (Object.keys(errors).filter((k) => k !== "agreed").length ? 0 : 1) : 2;

  const submit = async () => {
    setSubmitted(true); setServerError(null);
    if (missing || !verificationId) return;
    setBusy(true);
    try {
      const token = await tokenizeCard(card);
      const instrument = await saveInstrument("CARD", token, verificationId);
      setCard(EMPTY_CARD); setTouched({}); setSubmitted(false); setVerificationId(null); setFormKey((k) => k + 1);   // 입력값은 화면에서도 즉시 지움
      toast.success(`${instrument.label} 카드를 등록했어요.`);
      onRegistered(instrument);
    } catch (e) {
      setServerError(e instanceof ApiError || e instanceof Error ? e.message : "카드를 등록하지 못했어요.");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4" aria-label="신용카드 정보 입력">
      <SandboxNote><b>결제 대행사 카드 등록 창 (데모)</b> · 실제 카드 승인·결제는 일어나지 않아요. 확인용 테스트 카드번호 예: 4242 4242 4242 4242</SandboxNote>
      <StepBar steps={["카드 정보 입력", "이메일 본인 인증", "카드 등록"]} at={step} />
      {replacing && <p className="text-[13px] text-ink-600">새 카드를 등록하면 지금 등록된 <b>{replacing}</b> 대신 사용돼요.</p>}
      {/* 카드 미리보기 */}
      <div className="relative h-[124px] max-w-sm overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 to-[#1F406D] p-4 text-white shadow-lift">
        <div className="flex items-center justify-between text-[12px] font-bold opacity-90"><span className="flex items-center gap-1.5"><CreditCard className="h-4 w-4" />신용카드</span><span>{brand ? BRAND_LABEL[brand] : ""}</span></div>
        <div className="mt-5 font-mono text-[18px] tracking-[0.12em]">{formatCardNumber(card.number) || "•••• •••• •••• ••••"}</div>
        <div className="mt-2 flex justify-between text-[12px] opacity-85"><span>{card.holderType === "PERSONAL" ? "개인" : "법인"}</span><span>{card.expiry || "MM/YY"}</span></div>
      </div>
      <Input label="카드번호" required inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" disabled={busy}
        value={formatCardNumber(card.number)} onChange={(e) => set("number", digits(e.target.value).slice(0, 19))} onBlur={blur("number")} error={show("number")}
        right={brand && <span className="rounded-md bg-ink-100 px-1.5 py-0.5 text-[11px] font-bold text-ink-600">{BRAND_LABEL[brand]}</span>} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Input label="유효기간" required inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" disabled={busy}
          value={card.expiry} onChange={(e) => set("expiry", formatExpiry(e.target.value))} onBlur={blur("expiry")} error={show("expiry")} />
        <Input label={amex ? "CVC (앞면 4자리)" : "CVC"} required type="password" inputMode="numeric" autoComplete="cc-csc" placeholder={amex ? "0000" : "000"} disabled={busy}
          value={card.cvc} maxLength={amex ? 4 : 3} onChange={(e) => set("cvc", digits(e.target.value).slice(0, amex ? 4 : 3))} onBlur={blur("cvc")} error={show("cvc")} />
        <Input className="col-span-2 sm:col-span-1" label="비밀번호 앞 2자리" required type="password" inputMode="numeric" autoComplete="off" placeholder="••" disabled={busy}
          value={card.password2} maxLength={2} onChange={(e) => set("password2", digits(e.target.value).slice(0, 2))} onBlur={blur("password2")} error={show("password2")} />
      </div>
      <HolderFields type={card.holderType} id={card.holderId} onType={(t) => set("holderType", t)} onId={(v) => set("holderId", v)} error={show("holderId")} disabled={busy} />
      <EmailVerification key={formKey} purpose="CARD" onVerified={setVerificationId} showError={submitted} disabled={busy} />
      <div>
        <Checkbox checked={card.agreed} onChange={(v) => set("agreed", v)}>카드 정보를 결제 대행사에 등록하고, 구독 요금 결제와 자동 결제(정기 결제)에 사용하는 데 동의해요.</Checkbox>
        {show("agreed") && <p className="mt-1 text-[12.5px] text-rose-600">{show("agreed")}</p>}
      </div>
      {submitted && missing > 0 && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700 ring-1 ring-rose-500/20">
        {!verificationId && missing === 1 ? "이메일 본인 인증을 완료해 주세요." : `입력이 필요한 항목이 ${missing}개 있어요. 빨간색으로 표시된 칸${verificationId ? "" : "과 이메일 본인 인증"}을 확인해 주세요.`}</p>}
      {serverError && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700 ring-1 ring-rose-500/20">{serverError}</p>}
      <SecureNote />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && <Button variant="secondary" onClick={onCancel} disabled={busy}>취소</Button>}
        <Button loading={busy} icon={<ShieldCheck className="h-4 w-4" />} onClick={submit}>{busy ? "카드사 인증 중…" : "카드 등록"}</Button>
      </div>
    </div>
  );
}

// ── 계좌이체 ──────────────────────────────────────────────────────────
const EMPTY_BANK: BankInput = { bank: "", account: "", holderName: "", holderType: "PERSONAL", holderId: "", agreed: false };

export function BankForm({ banks, onRegistered, onCancel, replacing }: { banks: { id: string; name: string }[]; onRegistered: (i: Instrument) => void; onCancel?: () => void; replacing?: string | null }) {
  const [bank, setBank] = useState<BankInput>(EMPTY_BANK);
  const [touched, setTouched] = useState<Partial<Record<BankField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [verificationId, setVerificationId] = useState<number | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errors = validateBank(bank);
  const show = (f: BankField) => (submitted || touched[f]) ? errors[f] : undefined;
  const set = <K extends BankField>(k: K, v: BankInput[K]) => setBank((b) => ({ ...b, [k]: v }));
  const blur = (f: BankField) => () => setTouched((t) => ({ ...t, [f]: true }));
  const missing = Object.keys(errors).length + (verificationId ? 0 : 1);
  const infoDone = !Object.keys(errors).filter((k) => k !== "agreed").length;
  const step = !infoDone ? 0 : !bank.agreed ? 1 : !verificationId ? 2 : 3;

  const submit = async () => {
    setSubmitted(true); setError(null);
    if (missing || !verificationId) return;
    setBusy(true);
    try {
      const token = await tokenizeBank(bank);
      const instrument = await saveInstrument("BANK_TRANSFER", token, verificationId);
      setBank(EMPTY_BANK); setTouched({}); setSubmitted(false); setVerificationId(null); setFormKey((k) => k + 1);
      toast.success(`${instrument.label} 계좌를 등록했어요.`);
      onRegistered(instrument);
    } catch (e) { setError(e instanceof ApiError || e instanceof Error ? e.message : "계좌를 등록하지 못했어요."); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4" aria-label="계좌 정보 입력">
      <SandboxNote><b>결제 대행사 계좌 자동이체 등록 창 (데모)</b> · 실제 출금·이체는 일어나지 않아요.</SandboxNote>
      {replacing && <p className="text-[13px] text-ink-600">새 계좌를 등록하면 지금 등록된 <b>{replacing}</b> 대신 사용돼요.</p>}
      <StepBar steps={["계좌 정보 입력", "출금 동의", "이메일 본인 인증", "계좌 등록"]} at={step} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="은행" required value={bank.bank} disabled={busy} onChange={(e) => set("bank", e.target.value)} onBlur={blur("bank")} error={show("bank")}>
          <option value="">은행 선택</option>
          {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <Input label="계좌번호" required inputMode="numeric" autoComplete="off" placeholder="숫자만 입력" disabled={busy}
          value={bank.account} onChange={(e) => set("account", digits(e.target.value).slice(0, 14))} onBlur={blur("account")} error={show("account")} />
      </div>
      <Input label="예금주명" required autoComplete="off" placeholder="통장에 적힌 이름 (법인은 법인명)" disabled={busy} maxLength={20}
        value={bank.holderName} onChange={(e) => set("holderName", e.target.value)} onBlur={blur("holderName")} error={show("holderName")} />
      <HolderFields type={bank.holderType} id={bank.holderId} onType={(t) => set("holderType", t)} onId={(v) => set("holderId", v)} error={show("holderId")} disabled={busy} />
      <div>
        <Checkbox checked={bank.agreed} onChange={(v) => set("agreed", v)}>위 계좌에서 구독 요금을 출금하는 자동이체(출금 이체)에 동의해요.</Checkbox>
        {show("agreed") && <p className="mt-1 text-[12.5px] text-rose-600">{show("agreed")}</p>}
      </div>
      <EmailVerification key={formKey} purpose="BANK_TRANSFER" onVerified={setVerificationId} showError={submitted} disabled={busy} />
      {submitted && missing > 0 && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700 ring-1 ring-rose-500/20">
        {!verificationId && missing === 1 ? "이메일 본인 인증을 완료해 주세요." : `입력이 필요한 항목이 ${missing}개 있어요. 빨간색으로 표시된 칸${verificationId ? "" : "과 이메일 본인 인증"}을 확인해 주세요.`}</p>}
      {error && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700 ring-1 ring-rose-500/20">{error}</p>}
      <SecureNote />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && <Button variant="secondary" onClick={onCancel} disabled={busy}>취소</Button>}
        <Button loading={busy} icon={<ShieldCheck className="h-4 w-4" />} onClick={submit}>{busy ? "계좌 확인 중…" : "계좌 등록"}</Button>
      </div>
    </div>
  );
}
