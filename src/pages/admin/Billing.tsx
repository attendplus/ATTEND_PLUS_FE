import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { ArrowLeft, ArrowRight, BadgeCheck, CircleAlert, FlaskConical, Lock, ReceiptText, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { api, ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import ConfirmDialog from "@/components/ConfirmDialog";
import { fetchBillingStatus, instrumentOf, type BillingStatus } from "@/billing/billingStatus";
import PaymentMethodStep, { METHOD_ICON } from "@/billing/PaymentMethodPicker";
import PlanCard, { CycleToggle, SERVICE_ICON } from "@/billing/PlanCard";
import { CYCLE_LABEL, METHOD_LABEL, planOf, useSubscription, won, type CycleId, type PaymentMethodId, type Plans, type ServiceId, type ServicePlan, type Subscription } from "@/billing/subscription";
import { Badge, Button, ButtonLink, Card, Checkbox, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { useAsync } from "@/lib/hooks";

// *
// 요금제 · 결제 (학교 관리자) — 데모 결제
// 1 요금제 선택(카드마다 월간·연간) → 2 결제 수단(신용카드·계좌이체 선택, 저장된 정보 확인 또는 입력) → 3 확인 및 결제 → 결과
// - 가격·할인은 서버 공통 요금제 설정(GET /billing/plans)의 값, 등록된 결제 수단은 GET /admin/billing/status의 값입니다.
// - 3단계에서 확인하면 POST /admin/billing/demo-checkout으로 DEMO 구독을 만들어 학교 기능(관리자·교사·학생)을 켭니다.
//   실제 승인·청구·이체·영수증 발급은 없고, 데모 결제가 꺼진 환경(운영)에서는 서버가 거부합니다.
// - 카드·계좌 원본 정보는 결제 대행사(데모 샌드박스) 입력 창에서만 다루고 서버에는 토큰만 저장합니다.
// - 선택과 단계는 주소(?service=&cycle=&method=&step=)에 남아 새로고침·뒤로 가기에도 유지됩니다.
// - 구독 상태·결제 수단·자동 결제·결제 내역 관리는 별도 메뉴인 '구독 관리'(/admin/subscription)에서 합니다.
// *
const STEPS = ["요금제 선택", "결제 수단", "확인 및 결제"];
const SERVICES: ServiceId[] = ["QR", "QR_GPS"];
const CYCLES: CycleId[] = ["MONTHLY", "YEARLY"];
const METHODS: PaymentMethodId[] = ["CARD", "BANK_TRANSFER"];

const addMonths = (d: Date, n: number) => { const r = new Date(d); r.setMonth(r.getMonth() + n); return r; };
const ymd = (d: Date | string) => { const x = new Date(d); return `${x.getFullYear()}.${String(x.getMonth() + 1).padStart(2, "0")}.${String(x.getDate()).padStart(2, "0")}`; };

export default function AdminBilling() {
  const { loading, error, failure, plans, subscription, reload } = useSubscription();
  const billing = useAsync(fetchBillingStatus, []);
  const [params, setParams] = useSearchParams();

  const service = SERVICES.find((s) => s === params.get("service")) ?? null;
  const cycle = CYCLES.find((c) => c === params.get("cycle")) ?? null;
  const done = params.get("step") === "done";
  const status = billing.data;
  // 결제 수단: 주소에 있으면 그 값, 없으면 학교 기본 결제 수단
  const method = METHODS.find((m) => m === params.get("method")) ?? status?.paymentMethod ?? null;
  const ready = !!instrumentOf(status, method);   // 선택한 수단의 카드·계좌가 등록돼 있는지
  const asked = Math.min(3, Math.max(1, Number(params.get("step")) || 1));
  const step = !service || !cycle ? 1 : asked === 3 && !ready ? 2 : asked;   // 앞 단계가 안 끝났으면 그 단계로

  const go = (next: { step?: number | "done"; service?: ServiceId; cycle?: CycleId; method?: PaymentMethodId }) => {
    const p = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) => v !== undefined && p.set(k, String(v)));
    setParams(p, { replace: next.step === undefined });     // 선택만 바꿀 때는 기록을 쌓지 않음
    if (next.step !== undefined) window.scrollTo({ top: 0 });
  };

  if (loading || (billing.loading && !status)) return <><PageHeader title="요금제 · 결제" /><Skeleton className="h-96" /></>;
  if (error || !plans || !status) {
    return <><PageHeader title="요금제 · 결제" /><Card><ErrorState error={failure ?? billing.error ?? (error ? new Error(error) : null)} title="요금제·결제 정보를 불러오지 못했어요"
      onRetry={() => Promise.all([reload(), billing.reload()])} /></Card></>;
  }

  const plan = planOf(plans, service);
  return (
    <>
      <PageHeader title="요금제 · 결제" description="요금제를 고르고 결제 수단을 등록하면 바로 구독을 시작할 수 있어요."
        actions={<ButtonLink to="/admin/subscription" variant="secondary" icon={<Settings2 className="h-4 w-4" />}>구독 관리</ButtonLink>} />

      <div className="mb-3 flex items-start gap-3 rounded-2xl bg-amber-50 px-4 py-3.5 text-[13.5px] leading-6 text-amber-800 ring-1 ring-amber-500/25">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div><b>데모 결제 화면이에요.</b> 카드·계좌 입력과 결제 흐름은 실제와 같지만, 실제 승인·청구·이체·영수증 발급은 일어나지 않아요. 결제를 마치면 <b>데모 구독</b>으로 학교 기능이 켜져요.</div>
      </div>
      <CurrentSubscription plans={plans} subscription={subscription} />

      {!done && <Stepper step={step} onGo={(n) => n < step && go({ step: n })} />}

      <AnimatePresence mode="wait">
        <motion.div key={done ? "done" : step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          {done ? (
            <Result plans={plans} subscription={subscription} status={status} onRestart={() => setParams(new URLSearchParams())} />
          ) : step === 1 ? (
            <ChoosePlan plans={plans} service={service} cycle={cycle} onPick={(s, c) => go({ service: s, cycle: c, step: 2 })} onCycle={(s, c) => s === service && go({ cycle: c })} />
          ) : plan && cycle && step === 3 && method ? (
            <ConfirmStep plans={plans} plan={plan} cycle={cycle} method={method} status={status} subscription={subscription}
              onCycle={(c) => go({ cycle: c })} goStep={(n) => go({ step: n })}
              onDone={async () => { await Promise.all([reload(), billing.reload(true)]); go({ step: "done" }); }} />
          ) : plan && cycle && (
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0">
                <Panel title="결제 수단" desc="신용카드 또는 계좌이체를 고르세요. 등록된 정보가 없으면 입력 창이 열려요." back={() => go({ step: 1 })}
                  next={ready ? () => go({ step: 3, method: method! }) : undefined} nextLabel="확인 및 결제"
                  footnote={method ? (ready ? `${instrumentOf(status, method)!.label}(으)로 결제해요.` : `${METHOD_LABEL[method]} 정보를 등록하면 다음 단계로 넘어갈 수 있어요.`) : "결제 수단을 골라 주세요."}>
                  <PaymentMethodStep status={status} value={method} onChange={(m) => go({ method: m })}
                    onRegistered={async (i) => { await billing.reload(true); go({ method: i.method }); }} />
                </Panel>
              </div>
              <Summary plan={plan} cycle={cycle} instrumentLabel={instrumentOf(status, method)?.label ?? (method ? `${METHOD_LABEL[method]} (등록 필요)` : null)} onCycle={(c) => go({ cycle: c })} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

// 현재 구독 (자세한 관리는 구독 관리 메뉴)
function CurrentSubscription({ plans, subscription: s }: { plans: Plans; subscription: Subscription | null }) {
  return (
    <div className={clsx("mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-4 py-3 text-[13.5px] ring-1", s?.active ? "bg-mint-50 text-mint-700 ring-mint-500/20" : "bg-white text-ink-600 ring-ink-200")}>
      <BadgeCheck className="h-4 w-4 shrink-0" />
      {s?.active ? (
        <span className="min-w-0 flex-1">
          {s.paymentMode === "DEMO" && <Badge className="mr-1.5 bg-amber-50 text-amber-700 ring-amber-500/25">DEMO</Badge>}
          <b>{planOf(plans, s.service)?.name}</b> · {s.cycle ? CYCLE_LABEL[s.cycle] : ""} 이용 중{s.expiresAt && ` · 만료 ${ymd(s.expiresAt)}`}
          {s.paymentMode === "DEMO" && " — 새로 결제하면 지금 데모 구독 대신 적용돼요."}
        </span>
      ) : <span className="min-w-0 flex-1">현재 구독 상태: <b className="text-ink-900">미구독</b> — 결제를 마치면 관리자·교사·학생 기능이 바로 열려요.</span>}
      <Link to="/admin/subscription" className="shrink-0 text-[13px] font-bold text-brand-600 hover:underline">구독 관리 →</Link>
    </div>
  );
}

function Stepper({ step, onGo }: { step: number; onGo: (n: number) => void }) {
  return (
    <ol className="mb-6 grid grid-cols-3 gap-1.5" aria-label="결제 단계">
      {STEPS.map((label, i) => {
        const n = i + 1, now = n === step, past = n < step;
        return (
          <li key={label} className="min-w-0">
            <button type="button" onClick={() => onGo(n)} disabled={!past} aria-current={now ? "step" : undefined} aria-label={`${n}단계 ${label}`}
              className={clsx("flex w-full items-center justify-center gap-1.5 rounded-xl px-1 py-2.5 text-[12.5px] font-semibold ring-1 transition disabled:cursor-default",
                now ? "bg-brand-50 text-brand-700 ring-brand-200" : past ? "bg-white text-mint-600 ring-ink-200 hover:bg-ink-50" : "bg-white text-ink-400 ring-ink-200")}>
              <span className={clsx("grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold", now ? "bg-brand-500 text-white" : past ? "bg-mint-500 text-white" : "bg-ink-100 text-ink-400")}>{n}</span>
              <span className="truncate">{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// 1단계: 요금제 카드 2개 — 카드마다 월간/연간을 고르고 '이 요금제로 진행'
function ChoosePlan({ plans, service, cycle, onPick, onCycle }: {
  plans: Plans; service: ServiceId | null; cycle: CycleId | null; onPick: (s: ServiceId, c: CycleId) => void; onCycle: (s: ServiceId, c: CycleId) => void;
}) {
  const [cycles, setCycles] = useState<Record<ServiceId, CycleId>>(() => ({ QR: "MONTHLY", QR_GPS: "MONTHLY", ...(service && cycle ? { [service]: cycle } : {}) }));
  const gpsExtras = planOf(plans, "QR_GPS")?.extraFeatures ?? [];
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        {plans.services.map((p) => (
          <PlanCard key={p.id} plan={p} cycle={cycles[p.id]} selected={service === p.id} highlight={p.id === "QR_GPS"}
            missing={p.id === "QR" ? gpsExtras : []}
            onCycle={(c) => { setCycles((s) => ({ ...s, [p.id]: c })); onCycle(p.id, c); }}>
            <Button size="lg" variant={p.id === "QR_GPS" ? "primary" : "secondary"} className="w-full" onClick={() => onPick(p.id, cycles[p.id])}>
              {p.name} · {CYCLE_LABEL[cycles[p.id]]}으로 진행<ArrowRight className="h-4 w-4" />
            </Button>
          </PlanCard>
        ))}
      </div>
      <Conditions />
    </div>
  );
}

function Conditions({ compact }: { compact?: boolean }) {
  const items = [
    "학교 1곳 단위 구독이며, 교사·학생 수와 관계없이 하나의 구독으로 이용해요.",
    "월간은 시작일부터 1개월, 연간은 12개월 동안 이용해요. 연간은 월간 12개월분에서 할인돼요.",
    "교실 배치도·과목별 출석 공간·학생 GPS 출석은 QR + GPS 출결에서만 쓸 수 있어요.",
    "자동 결제는 구독 관리에서 켜고 끌 수 있고, 자동 갱신·환불 규정은 실제 결제 연동 때 이용약관으로 안내돼요.",
  ];
  if (compact) {
    return (
      <details className="mt-5 rounded-2xl bg-ink-50 p-4 text-[13px] leading-6 text-ink-600 ring-1 ring-ink-200/70">
        <summary className="cursor-pointer font-bold text-ink-800">이용 조건 보기</summary>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">{items.map((i) => <li key={i}>{i}</li>)}</ul>
      </details>
    );
  }
  return (
    <div className="mt-5 flex items-start gap-2.5 rounded-2xl bg-ink-50 p-4 text-[13px] leading-6 text-ink-600 ring-1 ring-ink-200/70">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
      <div><b className="text-ink-800">이용 조건</b><ul className="mt-1 list-disc space-y-0.5 pl-4">{items.map((i) => <li key={i}>{i}</li>)}</ul></div>
    </div>
  );
}

function Panel({ title, desc, back, next, nextLabel, footnote, children }: { title: string; desc: string; back: () => void; next?: () => void; nextLabel?: string; footnote?: string; children: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-[18px] font-extrabold tracking-tight">{title}</h2>
      <p className="mt-1 text-[13.5px] text-ink-500">{desc}</p>
      <div className="mt-5">{children}</div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />} onClick={back}>이전</Button>
        <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
          {footnote && <span className={clsx("text-[12.5px]", next ? "text-mint-700" : "text-ink-500")}>{footnote}</span>}
          {nextLabel && <Button disabled={!next} onClick={next}>{nextLabel}<ArrowRight className="h-4 w-4" /></Button>}
        </div>
      </div>
    </Card>
  );
}

// 3단계: 확인 및 결제 — 왼쪽 결제 내용(변경 가능) / 오른쪽 결제 금액·동의·결제 버튼(고정)
// '결제하기' → 최종 확인 창("정말 결제하시겠습니까?") → '확인'일 때만 데모 결제(DEMO 구독 생성, 실제 승인·출금 없음)
function ConfirmStep({ plans, plan, cycle, method, status, subscription, onCycle, goStep, onDone }: {
  plans: Plans; plan: ServicePlan; cycle: CycleId; method: PaymentMethodId; status: BillingStatus; subscription: Subscription | null;
  onCycle: (c: CycleId) => void; goStep: (n: number) => void; onDone: () => Promise<void>;
}) {
  const { profile } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = plan.quotes[cycle];
  const instrument = instrumentOf(status, method);
  const period = useMemo(() => { const start = new Date(); return { start, end: addMonths(start, q.months) }; }, [q.months]);
  useEffect(() => setAgreed(false), [plan.id, cycle, method]);
  const paid = subscription?.active && subscription.paymentMode !== "DEMO";   // 실제 결제로 등록된 구독은 데모로 바꾸지 않음
  const disabledReason = !subscription?.demoCheckout ? "이 환경에서는 데모 결제가 꺼져 있어요. (운영 환경에서는 데모 결제를 쓸 수 없어요)"
    : paid ? "이미 실제 결제로 등록된 구독이 있어 데모 결제를 진행할 수 없어요. 구독 관리에서 확인해 주세요." : null;

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await api.post("/admin/billing/demo-checkout", { service: plan.id, cycle, method, acknowledged: true });
      setAsking(false);
      await onDone();
      toast.success("결제를 마쳤어요. 학교 기능이 켜졌어요. (데모 · 실제 청구 없음)");
    } catch (e) {
      setAsking(false);
      setError(e instanceof ApiError ? e.message : "결제에 실패했어요. 잠시 후 다시 시도해 주세요.");
      if (e instanceof ApiError && e.code === "BILL420") goStep(2);   // 결제 수단 정보가 없으면 2단계로
    } finally { setBusy(false); }
  };

  const Edit = ({ to }: { to: number }) => <button type="button" onClick={() => goStep(to)} className="shrink-0 rounded-md px-1.5 py-0.5 text-[12.5px] font-bold text-brand-600 hover:bg-brand-50">변경</button>;
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="min-w-0 p-5 sm:p-6">
        <h2 className="text-[18px] font-extrabold tracking-tight">확인 및 결제</h2>
        <p className="mt-1 text-[13.5px] text-ink-500">결제 내용을 확인해 주세요. 바꿀 항목은 '변경'을 누르면 돼요.</p>
        <dl className="mt-5 divide-y divide-ink-100 rounded-2xl bg-white px-4 text-[14px] ring-1 ring-ink-200/80">
          <Line label="구독 학교" value={profile?.school.name ?? "-"} sub="이 학교의 모든 교사·학생 계정에 적용" />
          <Line label="신청 관리자" value={profile?.name ?? "-"} sub={profile?.email ? `${profile.email} · 구독 시작 안내 메일 수신` : undefined} />
          <Line label="요금제" value={<span className="inline-flex items-center gap-1.5">{SERVICE_ICON[plan.id]}{plan.name}</span>} action={<Edit to={1} />} />
          <Line label="구독 기간" value={<div className="w-[216px] max-w-full"><CycleToggle cycle={cycle} rate={plan.quotes.YEARLY.discountRate} onChange={onCycle} label="구독 기간" /></div>}
            sub={`${ymd(period.start)} ~ ${ymd(period.end)} · ${q.months}개월`} />
          <Line label="결제 수단" value={<span className="inline-flex items-center gap-1.5">{METHOD_ICON[method]}{instrument?.label ?? `${METHOD_LABEL[method]} (등록 필요)`}</span>}
            sub={method === "CARD" ? "등록된 카드로 결제" : "등록된 계좌에서 출금"} action={<Edit to={2} />} />
        </dl>
        {subscription?.active && subscription.paymentMode === "DEMO" && (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-brand-50 px-3.5 py-2.5 text-[13px] leading-5 text-brand-700">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />지금 {planOf(plans, subscription.service)?.name} 데모 구독이 있어요. 결제하면 기존 데모 구독을 해지하고 이 요금제로 새로 시작해요.
          </p>
        )}
        <Conditions compact />
        <div className="mt-6"><Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => goStep(2)}>이전</Button></div>
      </Card>

      <Card className="p-5 sm:p-6 lg:sticky lg:top-24">
        <div className="text-[13px] font-semibold text-ink-500">결제 금액</div>
        <div className="mt-3 space-y-0.5" aria-live="polite">
          <Amount label={`정상가 (월 ${won(plan.monthlyPrice)} × ${q.months}개월)`} value={won(q.listPrice)} />
          <Amount label={q.discountRate ? `연간 할인 (${q.discountRate}%)` : "할인"} value={q.discountAmount ? `− ${won(q.discountAmount)}` : "없음"} teal={!!q.discountAmount} />
          {cycle === "YEARLY" && <Amount label="월 환산" value={won(q.monthlyEquivalent)} />}
        </div>
        <div className="mt-3 flex items-end justify-between gap-3 border-t border-ink-100 pt-4">
          <span className="text-[14px] font-bold text-ink-900">최종 결제 금액</span>
          <span className="text-[26px] font-extrabold leading-none tracking-tight text-brand-600">{won(q.finalPrice)}</span>
        </div>
        <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-ink-50 px-3.5 py-2.5 text-[13.5px] ring-1 ring-ink-200/70">
          <span className="text-ink-400">{METHOD_ICON[method]}</span>
          <span className="min-w-0 flex-1 truncate font-semibold text-ink-800">{instrument?.label ?? "결제 수단 등록 필요"}</span>
        </div>
        {disabledReason ? (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-ink-50 px-3.5 py-3 text-[13px] leading-5 text-ink-600 ring-1 ring-ink-200/70"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />{disabledReason}</p>
        ) : (
          <Checkbox className="mt-4 text-[13px] leading-5" checked={agreed} onChange={setAgreed}>
            결제 내용과 이용 조건을 확인했어요. (데모 결제라 실제 승인·청구·이체는 일어나지 않아요)
          </Checkbox>
        )}
        {error && <p className="mt-3 rounded-xl bg-rose-50 px-3.5 py-2.5 text-[13px] leading-5 text-rose-700 ring-1 ring-rose-500/20">{error}</p>}
        <Button size="lg" className="mt-5 w-full" disabled={!agreed || !!disabledReason || !instrument} onClick={() => setAsking(true)}>
          {won(q.finalPrice)} 결제하기
        </Button>
        {!agreed && !disabledReason && <p className="mt-2 text-center text-[12px] text-ink-400">결제 내용 확인에 체크하면 결제할 수 있어요.</p>}
      </Card>

      <ConfirmDialog open={asking} title="정말 결제하시겠습니까?" loading={busy} onConfirm={submit} onCancel={() => setAsking(false)}
        description="확인을 누르면 아래 내용으로 결제하고 구독을 시작해요.">
        <dl className="space-y-1.5 rounded-xl bg-ink-50 px-4 py-3 text-[13.5px] ring-1 ring-ink-200/70">
          {([["요금제", `${plan.name} · ${CYCLE_LABEL[cycle]}`], ["이용 기간", `${ymd(period.start)} ~ ${ymd(period.end)}`],
             ["결제 수단", instrument?.label ?? "-"], ["결제 금액", won(q.finalPrice)]] as [string, string][]).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3"><dt className="shrink-0 text-ink-500">{k}</dt><dd className={clsx("text-right font-semibold", k === "결제 금액" && "text-brand-600")}>{v}</dd></div>
          ))}
        </dl>
        <p className="mt-3 text-[12.5px] leading-5 text-amber-700">데모 결제예요. 확인을 눌러도 실제 카드 승인·계좌 출금은 일어나지 않아요.</p>
      </ConfirmDialog>
    </div>
  );
}

// 결제 내용 한 줄 — 왼쪽 항목명 / 오른쪽 값(+보조 설명), 변경 버튼은 값 오른쪽에 같은 줄로
function Line({ label, value, sub, action }: { label: string; value: ReactNode; sub?: string; action?: ReactNode }) {
  return (
    <div className="grid grid-cols-[84px_minmax(0,1fr)] items-start gap-x-4 py-3.5 sm:grid-cols-[112px_minmax(0,1fr)]">
      <dt className="pt-0.5 text-[13px] font-semibold text-ink-500">{label}</dt>
      <dd className="flex min-w-0 flex-col items-end text-right">
        <div className="flex max-w-full items-center justify-end gap-1.5">
          <div className="min-w-0 break-words font-bold text-ink-900">{value}</div>
          {action}
        </div>
        {sub && <div className="mt-1 break-words text-[12.5px] leading-5 text-ink-500">{sub}</div>}
      </dd>
    </div>
  );
}

function Amount({ label, value, teal }: { label: string; value: string; teal?: boolean }) {
  return <div className="flex items-center justify-between gap-3 py-1 text-[13.5px]"><span className="min-w-0 text-ink-500">{label}</span><span className={clsx("shrink-0 font-bold", teal ? "text-teal-700" : "text-ink-900")}>{value}</span></div>;
}

// 오른쪽 요약: 모든 단계에서 같은 선택·금액, 기간을 바꾸면 바로 갱신
function Summary({ plan, cycle, instrumentLabel, onCycle }: { plan: ServicePlan; cycle: CycleId; instrumentLabel: string | null; onCycle: (c: CycleId) => void }) {
  const q = plan.quotes[cycle];
  return (
    <Card className="h-fit p-5 lg:sticky lg:top-24">
      <div className="text-[13px] font-semibold text-ink-500">결제 요약</div>
      <div className="mt-3 flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-500">{SERVICE_ICON[plan.id]}</span>
        <span className="text-[15px] font-extrabold">{plan.name}</span>
      </div>
      <div className="mt-4"><CycleToggle cycle={cycle} rate={plan.quotes.YEARLY.discountRate} onChange={onCycle} label="구독 기간" /></div>
      <div className="mt-3 flex justify-between gap-3 text-[13.5px]"><span className="shrink-0 text-ink-500">결제 수단</span><span className="text-right font-bold">{instrumentLabel ?? "선택 전"}</span></div>
      <div className="mt-4 space-y-1.5 border-t border-ink-100 pt-4 text-[13.5px]" aria-live="polite">
        <div className="flex justify-between"><span className="text-ink-500">정상가 ({q.months}개월)</span><span className="font-semibold">{won(q.listPrice)}</span></div>
        <div className="flex justify-between"><span className="text-ink-500">할인{q.discountRate ? ` (${q.discountRate}%)` : ""}</span><span className={clsx("font-semibold", q.discountAmount ? "text-teal-700" : "")}>{q.discountAmount ? `− ${won(q.discountAmount)}` : "없음"}</span></div>
        {cycle === "YEARLY" && <div className="flex justify-between"><span className="text-ink-500">월 환산</span><span className="font-semibold">{won(q.monthlyEquivalent)}</span></div>}
      </div>
      <div className="mt-4 flex items-end justify-between border-t border-ink-100 pt-4">
        <span className="text-[13px] font-semibold text-ink-700">최종 결제 금액</span>
        <span className="text-[22px] font-extrabold tracking-tight text-brand-600">{won(q.finalPrice)}</span>
      </div>
      <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-[12px] leading-5 text-amber-700">데모 결제 · 실제 승인·청구·이체·영수증 없음</div>
    </Card>
  );
}

// 결과: 데모 결제 완료 → 데모 구독으로 기능 활성화 (실제 결제·영수증과 구분) → 구독 관리로 이어짐
function Result({ plans, subscription, status, onRestart }: { plans: Plans; subscription: Subscription | null; status: BillingStatus; onRestart: () => void }) {
  const s = subscription;
  if (!s?.active || s.paymentMode !== "DEMO") {
    return <Card><EmptyState title="진행 중인 데모 구독이 없어요" description="요금제를 골라 다시 진행해 주세요." action={<Button onClick={onRestart}>요금제 고르기</Button>} /></Card>;
  }
  const instrument = instrumentOf(status, s.paymentMethod);
  const rows: [string, string][] = [
    ["요금제", planOf(plans, s.service)?.name ?? "-"], ["구독 기간", s.cycle ? CYCLE_LABEL[s.cycle] : "-"],
    ["이용 기간", s.startedAt && s.expiresAt ? `${ymd(s.startedAt)} ~ ${ymd(s.expiresAt)}` : "-"],
    ["결제 수단", instrument?.label ?? (s.paymentMethod ? METHOD_LABEL[s.paymentMethod] : "-")],
    ["데모 결제 금액", s.amount != null ? `${won(s.amount)} (청구 없음)` : "-"], ["영수증", "발급 없음 (데모)"],
  ];
  return (
    <Card className="mx-auto max-w-xl p-6 text-center sm:p-8">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-mint-50 text-mint-600"><BadgeCheck className="h-7 w-7" /></div>
      <Badge className="mt-4 bg-amber-50 text-amber-700 ring-amber-500/25">데모 결제 · DEMO</Badge>
      <h2 className="mt-3 text-[20px] font-extrabold tracking-tight">구독이 시작됐어요</h2>
      <p className="mt-2 text-[14px] leading-7 text-ink-500">
        이 학교의 관리자·교사·학생 기능을 지금 바로 쓸 수 있어요.<br />실제 승인·청구·이체는 일어나지 않았고 영수증도 발급되지 않아요.
        {s.service !== "QR_GPS" && <><br />교실 배치도·GPS 출석은 QR + GPS 출결 요금제에서 열려요.</>}
      </p>
      <div className="mx-auto mt-6 max-w-sm space-y-1 rounded-2xl bg-ink-50 p-4 text-left text-[13.5px] ring-1 ring-ink-200/70">
        {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3 py-1"><span className="flex items-center gap-1 text-ink-500">{k === "영수증" && <ReceiptText className="h-3.5 w-3.5" />}{k}</span><span className="text-right font-bold">{v}</span></div>)}
      </div>
      <p className="mt-4 text-[13px] leading-6 text-ink-500">학교 관리자 이메일로 구독 시작 안내 메일을 보내드려요.<br />자동 결제 설정과 결제 수단 변경은 구독 관리에서 할 수 있어요.</p>
      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        <ButtonLink to="/admin" className="w-full sm:w-auto" variant="secondary">관리자 홈으로</ButtonLink>
        <ButtonLink to="/admin/subscription" className="w-full sm:w-auto" icon={<Settings2 className="h-4 w-4" />}>구독 관리로 이동</ButtonLink>
      </div>
    </Card>
  );
}
