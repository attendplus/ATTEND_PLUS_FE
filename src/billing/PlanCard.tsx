import clsx from "clsx";
import { Check, MapPin, Minus, QrCode, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { won, type CycleId, type ServiceId, type ServicePlan } from "./subscription";

// *
// 요금제 카드 (요금제 · 결제 화면, 랜딩 요금 안내 공용)
// 카드마다 월간/연간을 따로 고르고, 연간이면 할인율·정상가·할인 금액·최종 금액·월 환산 금액을 함께 보여줍니다.
// 금액은 모두 서버 공통 요금제 설정(GET /billing/plans)의 값입니다.
// *
export const SERVICE_ICON: Record<ServiceId, JSX.Element> = { QR: <QrCode className="h-5 w-5" />, QR_GPS: <MapPin className="h-5 w-5" /> };

export function CycleToggle({ cycle, rate, onChange, label }: { cycle: CycleId; rate: number; onChange: (c: CycleId) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-1 rounded-xl bg-ink-100/80 p-1">
      {(["MONTHLY", "YEARLY"] as CycleId[]).map((c) => (
        <button key={c} type="button" role="radio" aria-checked={cycle === c} onClick={(e) => { e.stopPropagation(); onChange(c); }}
          className={clsx("flex items-center justify-center gap-1 whitespace-nowrap rounded-lg px-2 py-2 text-[13px] font-bold transition",
            cycle === c ? "bg-white text-ink-950 shadow-sm ring-1 ring-ink-200" : "text-ink-500 hover:text-ink-800")}>
          {c === "MONTHLY" ? "월간" : "연간"}
          {c === "YEARLY" && <span className={clsx("rounded-md px-1 text-[10.5px] font-extrabold", cycle === c ? "bg-teal-50 text-teal-700" : "text-teal-700")}>{rate}%↓</span>}
        </button>
      ))}
    </div>
  );
}

interface Props {
  plan: ServicePlan;
  cycle: CycleId;
  onCycle: (c: CycleId) => void;
  missing?: string[];          // 이 요금제에 없는 기능 (다른 요금제 전용) — 차이를 분명히 보여주기 위해
  selected?: boolean;
  highlight?: boolean;         // 추천 표시
  children?: ReactNode;        // 하단 버튼
}

export default function PlanCard({ plan, cycle, onCycle, missing = [], selected, highlight, children }: Props) {
  const q = plan.quotes[cycle];
  const y = plan.quotes.YEARLY;
  const yearly = cycle === "YEARLY";
  return (
    <div className={clsx("relative flex h-full flex-col rounded-[24px] bg-white p-5 transition sm:p-6",
      selected ? "ring-2 ring-brand-500 shadow-[0_24px_60px_-34px_rgba(43,87,147,.75)]" : highlight ? "ring-1 ring-brand-200 shadow-[0_24px_60px_-40px_rgba(43,87,147,.6)]" : "ring-1 ring-ink-200")}>
      <div className="flex items-start justify-between gap-3">
        <span className={clsx("grid h-11 w-11 place-items-center rounded-2xl", selected || highlight ? "bg-brand-500 text-white" : "bg-brand-50 text-brand-500")}>{SERVICE_ICON[plan.id]}</span>
        {selected ? <span className="inline-flex items-center gap-1 rounded-full bg-brand-500 px-2.5 py-1 text-[11.5px] font-bold text-white"><Check className="h-3 w-3" strokeWidth={3} />선택됨</span>
          : highlight ? <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11.5px] font-bold text-brand-700 ring-1 ring-brand-200">위치 기반 자동 출석</span> : null}
      </div>
      <h3 className="mt-4 text-[19px] font-extrabold tracking-tight text-ink-950">{plan.name}</h3>
      <p className="mt-1 min-h-[40px] text-[13.5px] leading-5 text-ink-500">{plan.summary}</p>

      <div className="mt-4"><CycleToggle cycle={cycle} rate={y.discountRate} onChange={onCycle} label={`${plan.name} 구독 기간`} /></div>

      {/* 금액 — 월간/연간을 바꿔도 높이가 같도록 자리를 고정 */}
      <div className="mt-4 min-h-[132px] rounded-2xl bg-ink-50 p-4 ring-1 ring-ink-200/70" aria-live="polite">
        {yearly ? (
          <>
            <div className="flex items-center justify-between gap-2 text-[12.5px]">
              <span className="font-semibold text-ink-400 line-through">정상가 {won(q.listPrice)}</span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-500 px-2 py-0.5 text-[11px] font-bold text-white"><Sparkles className="h-3 w-3" />{q.discountRate}% 할인</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1"><span className="text-[30px] font-extrabold tracking-tight text-ink-950">{won(q.finalPrice)}</span><span className="text-[13px] text-ink-500">/ 년</span></div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[12.5px]">
              <div className="rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-ink-200/70"><div className="text-ink-500">할인 금액</div><div className="font-bold text-teal-700">− {won(q.discountAmount)}</div></div>
              <div className="rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-ink-200/70"><div className="text-ink-500">월 환산</div><div className="font-bold text-ink-900">{won(q.monthlyEquivalent)}</div></div>
            </div>
          </>
        ) : (
          <>
            <div className="text-[12.5px] font-semibold text-ink-500">매월 결제 · 1개월 이용</div>
            <div className="mt-1 flex items-baseline gap-1"><span className="text-[30px] font-extrabold tracking-tight text-ink-950">{won(q.finalPrice)}</span><span className="text-[13px] text-ink-500">/ 월</span></div>
            <div className="mt-2 text-[12.5px] leading-5 text-ink-500">
              연간으로 바꾸면 <b className="text-teal-700">{won(y.finalPrice)}</b> (월 {won(y.monthlyEquivalent)}) · {won(y.discountAmount)} 절약
            </div>
          </>
        )}
      </div>

      <ul className="mt-5 flex-1 space-y-2">
        {plan.features.map((f) => <li key={f} className="flex items-start gap-2 text-[13.5px] text-ink-700"><Check className="mt-0.5 h-4 w-4 shrink-0 text-mint-500" strokeWidth={3} />{f}</li>)}
        {plan.extraFeatures.map((f) => (
          <li key={f} className="flex items-start gap-2 text-[13.5px] font-semibold text-brand-700">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" strokeWidth={3} />{f}
          </li>
        ))}
        {missing.map((f) => <li key={f} className="flex items-start gap-2 text-[13.5px] text-ink-400"><Minus className="mt-0.5 h-4 w-4 shrink-0 text-ink-300" />{f} <span className="shrink-0 text-[11.5px]">(미포함)</span></li>)}
      </ul>
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}
