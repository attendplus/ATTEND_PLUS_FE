import clsx from "clsx";
import { Check, CheckCircle2, CreditCard, Landmark, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { instrumentOf, kst, type BillingStatus, type Instrument } from "./billingStatus";
import { BankForm, CardForm } from "./InstrumentForms";
import type { PaymentMethodId } from "./subscription";

// *
// 결제 수단 선택 + 정보 확인 (요금제 결제 2단계 · 구독 관리 공용)
// 1) 신용카드 / 계좌이체 선택 → 2) 그 수단의 카드·계좌가 등록돼 있으면 그대로 사용(바꾸기 가능), 없으면 바로 입력 창
// 등록 여부는 서버(GET /admin/billing/status의 instruments) 기준입니다.
// *
export const METHOD_ICON: Record<PaymentMethodId, JSX.Element> = { CARD: <CreditCard className="h-5 w-5" />, BANK_TRANSFER: <Landmark className="h-5 w-5" /> };

export default function PaymentMethodStep({ status, value, onChange, onRegistered }: {
  status: BillingStatus; value: PaymentMethodId | null; onChange: (m: PaymentMethodId) => void; onRegistered: (i: Instrument) => Promise<void> | void;
}) {
  const saved = instrumentOf(status, value);
  const [replacing, setReplacing] = useState(false);
  useEffect(() => setReplacing(false), [value]);
  const showForm = value && (!saved || replacing);
  const done = async (i: Instrument) => { setReplacing(false); await onRegistered(i); };

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="결제 수단" className="grid gap-3 sm:grid-cols-2">
        {status.paymentMethods.map((m) => {
          const active = value === m.id;
          const inst = instrumentOf(status, m.id);
          return (
            <button key={m.id} type="button" role="radio" aria-checked={active} onClick={() => onChange(m.id)}
              className={clsx("flex h-full items-start gap-3 rounded-2xl bg-white p-4 text-left ring-1 transition",
                active ? "ring-2 ring-brand-500 shadow-[0_18px_40px_-28px_rgba(43,87,147,.7)]" : "ring-ink-200 hover:ring-brand-200")}>
              <span className={clsx("grid h-11 w-11 shrink-0 place-items-center rounded-2xl", active ? "bg-brand-500 text-white" : "bg-brand-50 text-brand-500")}>{METHOD_ICON[m.id]}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[16px] font-extrabold text-ink-950">{m.name}</span>
                  <span className={clsx("grid h-5 w-5 shrink-0 place-items-center rounded-full ring-2", active ? "bg-brand-500 text-white ring-brand-500" : "ring-ink-300")}>{active && <Check className="h-3 w-3" strokeWidth={3} />}</span>
                </span>
                <span className="mt-0.5 block text-[12.5px] text-ink-500">{m.summary}</span>
                <span className={clsx("mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-bold ring-1",
                  inst ? "bg-mint-50 text-mint-700 ring-mint-500/25" : "bg-ink-50 text-ink-500 ring-ink-200")}>
                  {inst ? <><CheckCircle2 className="h-3 w-3" />등록됨 · {inst.label}</> : "정보 등록 필요"}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {!value && <p className="text-[13px] text-ink-500">결제 수단을 고르면 필요한 정보 입력 창이 열려요.</p>}

      {value && saved && !replacing && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-mint-50/60 p-4 ring-1 ring-mint-500/25">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-mint-600 ring-1 ring-mint-500/25">{METHOD_ICON[value]}</span>
            <div>
              <div className="text-[14.5px] font-extrabold text-ink-900">{saved.label}</div>
              <div className="text-[12.5px] text-mint-700">저장된 {value === "CARD" ? "카드" : "계좌"}로 결제할 수 있어요 · {kst(saved.registeredAt)} 등록 · {saved.holderType === "PERSONAL" ? "개인" : "법인"}</div>
            </div>
          </div>
          <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setReplacing(true)}>다른 {value === "CARD" ? "카드" : "계좌"} 등록</Button>
        </div>
      )}

      {showForm && (
        <div className="rounded-2xl bg-ink-50/60 p-4 ring-1 ring-ink-200/80 sm:p-5">
          <div className="mb-3 text-[15px] font-extrabold text-ink-900">{value === "CARD" ? "카드 정보 입력" : "계좌 정보 입력"}</div>
          {value === "CARD"
            ? <CardForm onRegistered={done} onCancel={saved ? () => setReplacing(false) : undefined} replacing={saved?.label} />
            : <BankForm banks={status.instrumentOptions.banks} onRegistered={done} onCancel={saved ? () => setReplacing(false) : undefined} replacing={saved?.label} />}
        </div>
      )}
    </div>
  );
}
