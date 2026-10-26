import clsx from "clsx";
import { AlertTriangle, ArrowRight, BadgeCheck, ReceiptText, CheckCircle2, Download, FileSpreadsheet, FlaskConical, Info, Loader2, Mail, PlugZap, Plus, RefreshCw, ShieldCheck, Trash2, Wallet } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/api/client";
import { fetchBillingStatus, instrumentOf, kst, type Attempt, type BillingStatus as Status, type Instrument } from "@/billing/billingStatus";
import { BankForm, CardForm } from "@/billing/InstrumentForms";
import { METHOD_ICON } from "@/billing/PaymentMethodPicker";
import { CYCLE_LABEL, METHOD_LABEL, planOf, useSubscription, won, type PaymentMethodId, type Plans, type ServiceId } from "@/billing/subscription";
import { Badge, Button, ButtonLink, Card, Checkbox, ErrorState, Modal, PageHeader, Skeleton, Toggle } from "@/components/ui";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useAsync } from "@/lib/hooks";

// *
// 구독 관리 (학교 관리자, 독립 메뉴 /admin/subscription) — GET /admin/billing/status 한 번으로 그리고, 판정은 모두 서버 값 기준입니다.
// - 구독 상태·이용 요금제 · 결제 수단(카드·계좌 등록/변경/해제, 기본 수단) · 자동 결제 On/Off(끌 때 확인 모달)
// - 결제·미납·유예 기간 · 결제 내역/안내 메일 이력 · 전체 출결 기록 엑셀 내보내기 · 데모 시뮬레이션
// - 구독이 없거나 미납이어도 열려 있습니다. (구독 확인 없이 접근 — 상태 확인과 결제 수단 관리, 출결 기록 확보가 가능해야 함)
// - 결제 대행사 미연동: 실제 승인·청구·자동 결제·메일 발송은 일어나지 않고, 데모 시뮬레이션은 SIMULATED로 따로 표시합니다.
// *
const ATTEMPT_STATUS: Record<string, [string, string]> = {
  REQUESTED: ["요청 중", "bg-ink-100 text-ink-700 ring-ink-200"], SUCCEEDED: ["성공", "bg-mint-50 text-mint-700 ring-mint-500/25"],
  FAILED: ["실패", "bg-rose-50 text-rose-700 ring-rose-500/25"], UNKNOWN: ["결과 미확인", "bg-amber-50 text-amber-800 ring-amber-500/25"],
};
const KIND = { SCHEDULED: "예정 결제", RETRY: "재시도", MANUAL: "수동 결제" } as Record<string, string>;
const BASIS_LABEL: Record<string, string> = { SUBSCRIPTION_CANCELED: "구독 해지", GRACE_ELAPSED: "미납 · 유예 경과", AUTO_PAY_OFF: "미납 · 자동 결제 꺼짐" };
const MAIL_KIND: Record<string, string> = { WELCOME: "구독 시작 축하", FAILURE: "결제 실패 안내", REMINDER: "미납 안내" };
const EMAIL_STATUS: Record<string, string> = { PENDING: "발송 대기", SENT: "발송 완료", FAILED: "발송 실패(재처리 예정)", SKIPPED: "발송 안 함", CANCELED: "취소(미납 해소)" };

function remaining(to: string, now: number) {
  const ms = new Date(to).getTime() - now;
  if (ms <= 0) return "종료";
  const h = Math.floor(ms / 3_600_000), m = Math.floor((ms % 3_600_000) / 60_000);
  return h >= 24 ? `${Math.floor(h / 24)}일 ${h % 24}시간 남음` : `${h}시간 ${m}분 남음`;
}

export default function AdminSubscription() {
  return (
    <>
      <PageHeader title="구독 관리" description="구독 상태와 요금제, 결제 수단, 자동 결제, 결제 내역과 미납 상태를 한곳에서 확인하고 관리해요." />
      <SubscriptionManage />
    </>
  );
}

function SubscriptionManage() {
  const { plans, reload: reloadSubscription } = useSubscription();
  const { data, loading, error, reload } = useAsync(fetchBillingStatus, []);
  const [tick, setTick] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setTick(Date.now()), 30_000); return () => clearInterval(t); }, []);
  const refresh = async () => { await reload(true); await reloadSubscription(); };

  if (loading && !data) return <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-64" /></div>;
  if (error || !data) return <Card><ErrorState error={error} title="구독 관리 정보를 불러오지 못했어요" onRetry={() => reload()} /></Card>;

  const offset = new Date(data.now).getTime() - Date.now();
  const now = tick + offset;
  return (
    <div className="space-y-5">
      <IntegrationNotice s={data} />
      <OverviewCard s={data} plans={plans} onChanged={refresh} />
      <div className="grid items-stretch gap-5 lg:grid-cols-2">
        <InstrumentsCard s={data} onChanged={refresh} />
        <AutoPayCard s={data} planName={planOf(plans, data.subscription.service)?.name} onChanged={refresh} />
      </div>
      <PaymentStateCard s={data} now={now} planName={(id) => planOf(plans, id)?.name ?? id} onChanged={refresh} />
      <div className="grid items-stretch gap-5 lg:grid-cols-2">
        <AttemptList attempts={data.attempts} planName={(id) => planOf(plans, id)?.name ?? id} />
        <EmailList s={data} />
      </div>
      {data.integration.simulation && <SimulationCard s={data} onChanged={refresh} />}
      <ExportCard s={data} onChanged={() => reload(true)} />
      <p className="pt-1 text-center text-[12.5px] text-ink-400">결제 문의 <a className="font-semibold text-brand-600 hover:underline" href={`mailto:${data.supportEmail}`}>{data.supportEmail}</a></p>
    </div>
  );
}

function IntegrationNotice({ s }: { s: Status }) {
  const items: [string, boolean][] = [["결제 대행사 연동", s.integration.pgConnected], ["결제 메일 실제 발송", s.integration.emailEnabled], ["미납 안내 반복 발송", s.integration.automationEnabled]];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-white px-4 py-3 text-[12.5px] text-ink-600 ring-1 ring-ink-200/80">
      <span className="flex items-center gap-1.5 font-bold text-ink-800"><PlugZap className="h-4 w-4 text-ink-400" />운영 상태</span>
      {items.map(([label, on]) => (
        <span key={label} className="flex items-center gap-1.5"><span className={clsx("h-2 w-2 rounded-full", on ? "bg-mint-500" : "bg-ink-300")} />{label} {on ? "켜짐" : "꺼짐"}</span>
      ))}
      {!s.integration.pgConnected && <span className="w-full text-[12px] text-ink-500 sm:ml-auto sm:w-auto">결제 대행사 연동 전이라 실제 승인·청구·이체는 일어나지 않아요.</span>}
    </div>
  );
}

function SectionTitle({ icon, title, desc, right }: { icon: ReactNode; title: string; desc?: string; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-500">{icon}</span>
        <div className="min-w-0">
          <h3 className="text-[16px] font-extrabold leading-9 tracking-tight">{title}</h3>
          {desc && <p className="-mt-1 text-[12.5px] leading-5 text-ink-500">{desc}</p>}
        </div>
      </div>
      {right && <div className="shrink-0 pt-1">{right}</div>}
    </div>
  );
}

// 구독 상태 · 이용 요금제 (요금제 변경은 요금제 · 결제 메뉴로)
function OverviewCard({ s, plans, onChanged }: { s: Status; plans: Plans | null; onChanged: () => Promise<void> }) {
  const sub = s.subscription;
  const plan = planOf(plans, sub.service);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const instrument = instrumentOf(s, sub.paymentMethod);
  const cancelDemo = async () => {
    setBusy(true);
    try { await api.post("/admin/billing/cancel"); setAsking(false); await onChanged(); toast.success("구독을 해지했어요. 전체 출결 기록을 바로 내려받을 수 있어요."); }
    catch (e) { setAsking(false); toast.error(e instanceof ApiError ? e.message : "구독 해지에 실패했어요."); } finally { setBusy(false); }
  };
  if (!sub.active) {
    const c = s.cancellation;
    return (
      <Card className={clsx("flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6", c && "ring-1 ring-rose-200")}>
        <div className="flex min-w-0 items-center gap-3">
          <span className={clsx("grid h-11 w-11 shrink-0 place-items-center rounded-2xl", c ? "bg-rose-50 text-rose-600" : "bg-ink-100 text-ink-500")}><BadgeCheck className="h-5 w-5" /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[17px] font-extrabold text-ink-950">
              {c ? "구독이 해지됐어요" : "구독 중인 요금제가 없어요"}
              {c && <Badge className="bg-rose-50 text-rose-700 ring-rose-500/25">해지됨</Badge>}
            </div>
            <div className="text-[13px] leading-5 text-ink-500">
              {c ? `${kst(c.canceledAt)}에 ${planOf(plans, c.service)?.name ?? ""} 구독을 해지했어요. 출결 기록은 그대로 보관되고, 전체 출결 기록을 바로 내려받을 수 있어요.${s.delinquency ? ` 해지와 별개로 미납 금액 ${won(s.delinquency.amount)}이 남아 있어요.` : ""}`
                : s.delinquency ? "미납 금액이 있어요. 아래 결제 · 미납 상태를 확인해 주세요." : "요금제를 고르고 결제하면 관리자·교사·학생 기능이 바로 열려요."}
            </div>
          </div>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          {c && <Button variant="secondary" className="flex-1 sm:flex-none" icon={<Download className="h-4 w-4" />}
            onClick={() => document.getElementById("attendance-export")?.scrollIntoView({ behavior: "smooth", block: "start" })}>출결 기록 받기</Button>}
          <ButtonLink to="/admin/billing" className="flex-1 sm:flex-none" icon={<ArrowRight className="h-4 w-4" />}>{c ? "다시 구독하기" : "요금제 고르기"}</ButtonLink>
        </div>
      </Card>
    );
  }
  const rows: [string, string][] = [
    ["이용 요금제", `${plan?.name ?? sub.service} · ${sub.cycle ? CYCLE_LABEL[sub.cycle] : ""}`],
    ["이용 기간", `${kst(sub.startedAt)} ~ ${kst(sub.expiresAt)}`],
    ["결제 금액", sub.amount != null ? `${won(sub.amount)}${sub.paymentMode === "DEMO" ? " (데모 · 청구 없음)" : ""}` : "-"],
    ["결제 수단", instrument?.label ?? (sub.paymentMethod ? METHOD_LABEL[sub.paymentMethod] : "기록 없음")],
    ["다음 결제", s.autoPay.enabled && s.nextBillingAt ? `${kst(s.nextBillingAt)} 자동 결제 예정` : "자동 결제 꺼짐 — 만료 전에 직접 결제해야 해요"],
  ];
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-mint-50 text-mint-600"><BadgeCheck className="h-5 w-5" /></span>
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[17px] font-extrabold text-ink-950">구독 중{sub.paymentMode === "DEMO" && <Badge className="bg-amber-50 text-amber-700 ring-amber-500/25">DEMO</Badge>}
              {s.delinquency && <Badge className="bg-rose-50 text-rose-700 ring-rose-500/25">결제 실패 · 미납 {won(s.delinquency.amount)}</Badge>}</div>
            <div className="text-[13px] text-ink-500">이 학교의 관리자·교사·학생 기능을 이용할 수 있어요.</div>
          </div>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <ButtonLink to="/admin/billing" className="flex-1 sm:flex-none" variant="secondary">요금제 변경</ButtonLink>
          {sub.paymentMode === "DEMO" && <Button variant="secondary" className="flex-1 text-rose-600 sm:flex-none" onClick={() => setAsking(true)}>구독 해지</Button>}
        </div>
      </div>
      <dl className="mt-5 grid gap-x-8 text-[13.5px] sm:grid-cols-2">
        {rows.map(([k, v]) => <div key={k} className="flex items-start justify-between gap-4 border-b border-ink-100 py-2.5"><dt className="shrink-0 text-ink-500">{k}</dt><dd className="text-right font-semibold text-ink-900">{v}</dd></div>)}
      </dl>
      <ConfirmDialog open={asking} tone="danger" title="정말 구독을 해지하시겠습니까?" loading={busy} onConfirm={cancelDemo} onCancel={() => setAsking(false)}
        description={`${plan?.name ?? "현재"} 구독을 해지하면 이 학교의 관리자·교사·학생 기능이 바로 잠겨요.`}>
        <ul className="space-y-1.5 rounded-xl bg-ink-50 px-4 py-3 text-[13px] leading-5 text-ink-600 ring-1 ring-ink-200/70">
          <li>· 해지 즉시 전체 학생의 출결 기록을 엑셀로 내려받을 수 있어요.</li>
          <li>· 출결 기록과 결제 내역은 그대로 보관돼요. (삭제·변경 없음)</li>
          <li>· 이미 결제된 다음 기간도 함께 해지되고, 자동 결제는 꺼져요.</li>
          <li>· 다시 결제하면 바로 기능이 열려요. 데모 구독이라 실제 환불·청구는 없어요.</li>
        </ul>
      </ConfirmDialog>
    </Card>
  );
}

// 결제 수단 — 카드·계좌 등록/변경/해제, 기본 결제 수단(자동 결제·예정 결제에 사용) 지정. 원본 정보는 대행사 입력 창에서만.
function InstrumentsCard({ s, onChanged }: { s: Status; onChanged: () => Promise<void> }) {
  const [form, setForm] = useState<PaymentMethodId | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Instrument | null>(null);
  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); await onChanged(); toast.success(ok); } catch (e) { toast.error(e instanceof ApiError ? e.message : "처리하지 못했어요."); } finally { setBusy(null); }
  };
  const registered = async (i: Instrument) => { setForm(null); await onChanged(); toast.success(`${i.label}을(를) 기본 결제 수단으로 설정했어요.`); };
  return (
    <Card id="payment-methods" className="flex h-full scroll-mt-24 flex-col p-5 sm:p-6">
      <SectionTitle icon={<Wallet className="h-[18px] w-[18px]" />} title="결제 수단" desc="결제와 자동 결제에 쓰는 카드·계좌예요." />
      <ul className="mt-4 space-y-2.5">
        {s.paymentMethods.map((m) => {
          const inst = instrumentOf(s, m.id);
          const isDefault = s.paymentMethod === m.id && !!inst;
          return (
            <li key={m.id} className={clsx("rounded-xl p-3.5 ring-1", isDefault ? "bg-brand-50/50 ring-brand-200" : "bg-white ring-ink-200/80")}>
              <div className="flex flex-wrap items-center gap-3">
                <span className={clsx("grid h-10 w-10 shrink-0 place-items-center rounded-xl", inst ? "bg-brand-500 text-white" : "bg-ink-100 text-ink-400")}>{METHOD_ICON[m.id]}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-[14.5px] font-extrabold text-ink-900">
                    {inst ? inst.label : m.name}
                    {isDefault && <Badge className="bg-brand-500 text-white ring-0">기본</Badge>}
                  </div>
                  <div className="text-[12.5px] text-ink-500">{inst ? `${m.name} · ${inst.holderType === "PERSONAL" ? "개인" : "법인"} · ${kst(inst.registeredAt)} 등록` : "등록되지 않았어요"}</div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {inst && !isDefault && <Button size="sm" variant="secondary" loading={busy === `d${m.id}`}
                    onClick={() => run(`d${m.id}`, () => api.put("/admin/billing/payment-method", { method: m.id }), `${inst.label}을(를) 기본 결제 수단으로 바꿨어요.`)}>기본으로</Button>}
                  <Button size="sm" variant={inst ? "secondary" : "primary"} icon={inst ? undefined : <Plus className="h-4 w-4" />} onClick={() => setForm(m.id)}>{inst ? "변경" : "등록"}</Button>
                  {inst && <Button size="sm" variant="ghost" aria-label={`${inst.label} 해제`} icon={<Trash2 className="h-4 w-4" />} onClick={() => setRemoving(inst)} />}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-auto pt-4 text-[12.5px] leading-5 text-ink-500">카드번호·CVC·계좌번호는 결제 대행사 입력 창에서만 입력하고, 출결플러스에는 대행사 토큰과 끝 4자리만 저장돼요. 자동 결제에 쓰는 기본 수단은 자동 결제를 끈 뒤 해제할 수 있어요.</p>
      <ConfirmDialog open={!!removing} tone="danger" title="정말 결제 수단을 해제하시겠습니까?" loading={busy === "remove"}
        onCancel={() => setRemoving(null)}
        onConfirm={() => removing && run("remove", () => api.del(`/admin/billing/payment-instruments/${removing.piId}`), "결제 수단 등록을 해제했어요.").then(() => setRemoving(null))}
        description={<><b className="text-ink-900">{removing?.label}</b> 등록을 해제해요. 다시 쓰려면 정보를 새로 등록해야 해요.</>} />
      <Modal open={!!form} onClose={() => setForm(null)} size="lg" title={form === "BANK_TRANSFER" ? "계좌 등록" : "카드 등록"} description="등록하면 이 수단이 기본 결제 수단이 돼요.">
        {form === "CARD" && <CardForm onRegistered={registered} onCancel={() => setForm(null)} replacing={instrumentOf(s, "CARD")?.label} />}
        {form === "BANK_TRANSFER" && <BankForm banks={s.instrumentOptions.banks} onRegistered={registered} onCancel={() => setForm(null)} replacing={instrumentOf(s, "BANK_TRANSFER")?.label} />}
      </Modal>
    </Card>
  );
}

// 자동 결제 On/Off — 끌 때는 확인 모달에서 명시적으로 확인해야 서버에 저장
function AutoPayCard({ s, planName, onChanged }: { s: Status; planName?: string; onChanged: () => Promise<void> }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const on = s.autoPay.enabled;
  const save = async (enabled: boolean) => {
    setBusy(true);
    try {
      await api.put("/admin/billing/auto-pay", { enabled, confirmed: !enabled });
      await onChanged();
      toast.success(enabled ? "자동 결제를 켰어요." : "자동 결제를 껐어요. 앞으로의 자동 청구가 중단돼요.");
      setConfirmOpen(false);
    } catch (e) { toast.error(e instanceof ApiError ? e.message : "자동 결제 설정을 바꾸지 못했어요."); } finally { setBusy(false); }
  };
  return (
    <Card className="flex h-full flex-col p-5 sm:p-6">
      <SectionTitle icon={<RefreshCw className="h-[18px] w-[18px]" />} title="자동 결제" desc="기본으로 켜져 있어요. 만료일에 기본 결제 수단으로 결제돼요."
        right={<Toggle checked={on} disabled={busy || (!on && !instrumentOf(s, s.paymentMethod))} onChange={(v) => { if (v) save(true); else { setAck(false); setConfirmOpen(true); } }} />} />
      <div className={clsx("mt-4 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[14px] font-bold ring-1", on ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-ink-50 text-ink-600 ring-ink-200")}>
        <span className={clsx("h-2 w-2 rounded-full", on ? "bg-brand-500" : "bg-ink-300")} />
        현재 자동 결제: {on ? "켜짐 (On)" : "꺼짐 (Off)"}
      </div>
      {!instrumentOf(s, s.paymentMethod) && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[13px] leading-5 text-amber-800 ring-1 ring-amber-500/25">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {on ? "자동 결제는 켜져 있지만 등록된 결제 수단이 없어 결제되지 않아요. 결제 수단을 등록해 주세요." : "자동 결제를 켜려면 먼저 신용카드나 계좌를 등록해 주세요."}
        </p>
      )}
      <dl className="mt-4 space-y-2 text-[13.5px]">
        <div className="flex justify-between gap-3"><dt className="shrink-0 text-ink-500">자동 결제 수단</dt><dd className="text-right font-semibold">{instrumentOf(s, s.paymentMethod) ? `${instrumentOf(s, s.paymentMethod)!.label}${s.paymentMethod === "BANK_TRANSFER" ? " (계좌 자동이체)" : " (카드 자동 결제)"}` : "미등록"}</dd></div>
        <div className="flex justify-between gap-3"><dt className="shrink-0 text-ink-500">다음 결제 예정일</dt><dd className="text-right font-semibold">{on && s.nextBillingAt ? `${kst(s.nextBillingAt)}${planName ? ` · ${planName}` : ""}` : on ? "구독 기간 없음" : "자동 결제 꺼짐 — 예정된 자동 청구 없음"}</dd></div>
        <div className="flex justify-between gap-3"><dt className="shrink-0 text-ink-500">마지막 변경</dt><dd className="text-right font-semibold">{s.autoPay.updatedAt ? `${kst(s.autoPay.updatedAt)}${s.autoPay.updatedBy ? ` · ${s.autoPay.updatedBy}` : ""}` : "변경 이력 없음"}</dd></div>
      </dl>
      <p className="mt-auto pt-4 text-[12.5px] leading-5 text-ink-500">자동 결제는 이 학교의 활성 관리자만 바꿀 수 있어요. 끄면 앞으로 예정된 자동 청구(예정 결제·자동 재시도)만 멈추고, 이미 처리된 결제나 미납 금액은 그대로 남아요.</p>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="자동 결제를 끌까요?" description="끄기 전에 아래 내용을 확인해 주세요." size="sm"
        footer={<><Button variant="secondary" onClick={() => setConfirmOpen(false)}>취소</Button><Button variant="danger" disabled={!ack} loading={busy} onClick={() => save(false)}>자동 결제 끄기</Button></>}>
        <ul className="space-y-2 text-[13.5px] leading-6 text-ink-700">
          <li className="flex gap-2"><Info className="mt-1 h-4 w-4 shrink-0 text-ink-400" />다음 결제 예정일의 자동 청구와 실패 후 자동 재시도가 멈춰요.</li>
          <li className="flex gap-2"><Info className="mt-1 h-4 w-4 shrink-0 text-ink-400" />이미 처리된 결제는 취소되지 않고, 미납 금액이 있다면 그대로 남아요.</li>
          <li className="flex gap-2"><Info className="mt-1 h-4 w-4 shrink-0 text-ink-400" />구독 기간이 끝나면 결제 전까지 기능이 잠겨요. 출결 기록은 그대로 보관돼요.</li>
          <li className="flex gap-2"><Info className="mt-1 h-4 w-4 shrink-0 text-ink-400" />미납이 있으면 유예 기간 없이 전체 출결 기록을 바로 내려받을 수 있어요.</li>
        </ul>
        <Checkbox className="mt-4" checked={ack} onChange={setAck}>위 내용을 확인했고 자동 결제를 끕니다.</Checkbox>
      </Modal>
    </Card>
  );
}

// 결제 · 미납 · 유예 기간 (서버 판정) + 결제 실패 후 관리자 직접 결제
// '결제하기' → 최종 확인(금액·결제 수단) → POST /admin/billing/pay-overdue — 미납 해소는 서버가 결제 성공을 확인했을 때만
type PayResult = { paId: number; status: string; duplicate: boolean; mode: string; failureReason: string | null; delinquencyResolved: boolean; subscriptionReactivated: boolean };
const DEMO_OUTCOMES = [["SUCCEEDED", "결제 성공"], ["FAILED_KNOWN", "다시 실패 (사유 있음)"], ["FAILED_UNKNOWN", "다시 실패 (사유 없음)"], ["UNKNOWN", "응답 없음"]] as const;

function PaymentStateCard({ s, now, planName, onChanged }: { s: Status; now: number; planName: (id: ServiceId) => string; onChanged: () => Promise<void> }) {
  const d = s.delinquency, pending = s.unresolvedAttempt;
  const instrument = instrumentOf(s, s.paymentMethod);
  const [asking, setAsking] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [outcome, setOutcome] = useState<string>("SUCCEEDED");
  const [busy, setBusy] = useState<"pay" | "check" | null>(null);
  const [result, setResult] = useState<PayResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const openPay = () => { setRequestId(crypto.randomUUID()); setOutcome("SUCCEEDED"); setError(null); setResult(null); setAsking(true); };
  const pay = async () => {
    if (!d || busy) return;
    setBusy("pay"); setError(null);
    try {
      // 같은 확인 창에서 다시 보내면 같은 requestId → 서버가 같은 결제 시도를 돌려줘 이중 결제가 없어요
      const r = await api.post<PayResult>("/admin/billing/pay-overdue", { bdId: d.bdId, requestId, scenario: s.integration.simulation ? outcome : null });
      setResult(r); setAsking(false);
      if (r.status === "SUCCEEDED") toast.success(r.subscriptionReactivated ? "결제가 확인됐어요. 미납이 해소되고 구독이 이어져요." : "결제가 확인됐어요. 미납이 해소됐어요.");
      else if (r.status === "FAILED") toast.error("결제에 실패했어요. 미납 상태는 그대로예요.");
      else toast.info("결제 결과를 아직 확인하지 못했어요. 결과를 확인한 뒤 처리돼요.");
      await onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "결제를 요청하지 못했어요. 같은 버튼을 다시 눌러도 이중 결제되지 않아요.");
      if (e instanceof ApiError && (e.code === "BILL429" || e.code === "BILL411")) { setAsking(false); await onChanged(); }
    } finally { setBusy(null); }
  };
  const check = async (paId: number) => {
    setBusy("check");
    try {
      const r = await api.post<PayResult>(`/admin/billing/attempts/${paId}/reconcile`);
      setResult(r);
      toast[r.status === "SUCCEEDED" ? "success" : r.status === "FAILED" ? "error" : "info"](r.status === "SUCCEEDED" ? "결제가 확인됐어요." : r.status === "FAILED" ? "결제 실패로 확인됐어요." : "결제 대행사에서 아직 결과를 받지 못했어요.");
      await onChanged();
    } catch (e) { toast.error(e instanceof ApiError ? e.message : "결과를 확인하지 못했어요."); } finally { setBusy(null); }
  };

  const [label, tone, icon] = d
    ? [`결제 실패 · 미납${d.phase === "GRACE" ? " (유예 기간 중)" : " (유예 기간 종료)"}`, d.phase === "GRACE" ? "bg-amber-50 text-amber-800 ring-amber-500/25" : "bg-rose-50 text-rose-700 ring-rose-500/25", <AlertTriangle key="i" className="h-4 w-4" />]
    : pending ? ["결제 결과 확인 중", "bg-amber-50 text-amber-800 ring-amber-500/25", <Loader2 key="i" className="h-4 w-4" />]
      : ["정상 · 미납 없음", "bg-mint-50 text-mint-700 ring-mint-500/25", <CheckCircle2 key="i" className="h-4 w-4" />];
  return (
    <Card className={clsx("p-5 sm:p-6", d && "ring-1 ring-rose-200")}>
      <SectionTitle icon={<ShieldCheck className="h-[18px] w-[18px]" />} title="결제 · 미납 상태" desc="결제에 실패하면 자동으로 다시 청구하지 않아요. 원인을 해결한 뒤 직접 결제해 주세요."
        right={d?.mode === "SIMULATED" ? <Badge className="bg-amber-50 text-amber-700 ring-amber-500/25">DEMO 시뮬레이션</Badge> : undefined} />
      <div className={clsx("mt-4 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[14px] font-bold ring-1", tone)}>{icon}{label}</div>
      {d ? (
        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <dl className="space-y-2 text-[13.5px]">
            <Row label="미납 금액" value={won(d.amount)} strong />
            <Row label="요금제" value={`${planName(d.service)} · ${CYCLE_LABEL[d.cycle]}`} />
            <Row label="결제 실패 일시" value={kst(d.failedAt)} />
            <Row label="실패 사유" value={d.failureReason ?? "확인되지 않음"} />
            <Row label="유예 기간 만료" value={`${kst(d.graceEndsAt)} · ${remaining(d.graceEndsAt, now)}`} />
            {d.retryCount > 0 && <Row label="다시 결제한 횟수" value={`${d.retryCount}회`} />}
            <div className="flex items-center justify-between gap-3 pt-1">
              <dt className="shrink-0 text-ink-500">결제 수단</dt>
              <dd className="flex items-center gap-2 text-right font-semibold">{instrument ? instrument.label : <span className="text-rose-600">등록 필요</span>}
                <button type="button" className="rounded-md px-1.5 py-0.5 text-[12.5px] font-bold text-brand-600 hover:bg-brand-50"
                  onClick={() => document.getElementById("payment-methods")?.scrollIntoView({ behavior: "smooth", block: "center" })}>변경</button></dd>
            </div>
            {!d.failureReason && <p className="rounded-xl bg-ink-50 px-3.5 py-2.5 text-[12.5px] leading-5 text-ink-600 ring-1 ring-ink-200/70">결제 대행사에서 실패 사유를 받지 못했어요. 원인을 단정하지 않으니, 결제 수단 상태(잔액·한도·유효기간)를 확인해 주세요.</p>}
          </dl>
          <div className="rounded-2xl bg-ink-50 p-4 ring-1 ring-ink-200/70">
            <ol className="space-y-2 text-[13px] leading-5 text-ink-700">
              <li className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white text-[11px] font-bold text-brand-600 ring-1 ring-brand-200">1</span>{d.guide}</li>
              <li className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white text-[11px] font-bold text-brand-600 ring-1 ring-brand-200">2</span>아래 '결제하기'를 눌러 직접 결제해요.</li>
              <li className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white text-[11px] font-bold text-brand-600 ring-1 ring-brand-200">3</span>결제 대행사가 성공을 확인하면 미납이 해소돼요.</li>
            </ol>
            {pending ? (
              <div className="mt-4 space-y-2">
                <p className="text-[12.5px] leading-5 text-amber-800">이전 결제(#{pending.paId}) 결과를 아직 확인하지 못했어요. 이중 결제를 막기 위해 결과를 먼저 확인해요.</p>
                <Button className="w-full" variant="secondary" loading={busy === "check"} onClick={() => check(pending.paId)}>결제 결과 다시 확인</Button>
              </div>
            ) : (
              <Button size="lg" className="mt-4 w-full" disabled={!instrument || !!busy} onClick={openPay}>{won(d.amount)} 결제하기</Button>
            )}
            {!instrument && <p className="mt-2 text-center text-[12px] text-rose-600">결제 수단을 먼저 등록해 주세요.</p>}
          </div>
        </div>
      ) : pending ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 flex-1 text-[13.5px] leading-6 text-ink-600">{KIND[pending.kind] ?? pending.kind} #{pending.paId}의 결과를 결제 대행사에서 아직 확인하지 못했어요. 결과가 확인될 때까지 다시 결제하지 않고, 미납으로도 판정하지 않아요.</p>
          <Button variant="secondary" loading={busy === "check"} onClick={() => check(pending.paId)}>결제 결과 다시 확인</Button>
        </div>
      ) : (
        <p className="mt-4 text-[13.5px] leading-6 text-ink-600">진행 중인 미납이 없어요.</p>
      )}
      {result && (
        <div className={clsx("mt-4 rounded-xl px-3.5 py-2.5 text-[13px] leading-5 ring-1",
          result.status === "SUCCEEDED" ? "bg-mint-50 text-mint-700 ring-mint-500/25" : result.status === "FAILED" ? "bg-rose-50 text-rose-700 ring-rose-500/20" : "bg-amber-50 text-amber-800 ring-amber-500/25")}>
          {result.status === "SUCCEEDED" ? `결제가 확인됐어요 (#${result.paId}). 미납이 해소됐어요.${result.subscriptionReactivated ? "" : " 구독을 해지한 학교라 구독은 다시 시작되지 않아요."}`
            : result.status === "FAILED" ? `결제에 실패했어요 (#${result.paId}) · 사유: ${result.failureReason ?? "확인되지 않음"}. 원인을 해결한 뒤 다시 결제해 주세요.`
              : `결제 결과를 아직 확인하지 못했어요 (#${result.paId}). 미납은 결과가 확인된 뒤 처리돼요.`}
          {result.mode === "SIMULATED" && " (데모 · 실제 청구 없음)"}
        </div>
      )}
      <details className="mt-4 text-[12.5px] leading-5 text-ink-500">
        <summary className="cursor-pointer font-semibold text-ink-600">미납 시 이용 정책</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">{s.policy.rules.map((r) => <li key={r}>{r}</li>)}
          <li>안내 메일은 관리자 1명당 하루 최대 {s.policy.maxNoticeEmailsPerDay}회({s.policy.noticeEmailMinIntervalHours}시간 간격)이고, 결제가 되면 바로 멈춰요.</li>
        </ul>
      </details>
      {d && (
        <ConfirmDialog open={asking} loading={busy === "pay"} title="정말 결제하시겠습니까?" onCancel={() => setAsking(false)} onConfirm={pay}
          description="확인을 누르면 아래 결제 수단으로 미납 금액을 결제해요.">
          <dl className="space-y-1.5 rounded-xl bg-ink-50 px-4 py-3 text-[13.5px] ring-1 ring-ink-200/70">
            {([["요금제", `${planName(d.service)} · ${CYCLE_LABEL[d.cycle]}`], ["결제 수단", instrument?.label ?? "-"], ["결제 금액", won(d.amount)]] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3"><dt className="text-ink-500">{k}</dt><dd className={clsx("text-right font-semibold", k === "결제 금액" && "text-brand-600")}>{v}</dd></div>
            ))}
          </dl>
          {s.integration.simulation && (
            <div className="mt-3 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-500/25">
              <div className="text-[12.5px] font-bold text-amber-800">데모 · 결제 대행사 응답 선택 (실제 청구 없음)</div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {DEMO_OUTCOMES.map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setOutcome(v)}
                    className={clsx("rounded-lg px-2 py-1.5 text-[12.5px] font-semibold ring-1", outcome === v ? "bg-white text-ink-900 ring-amber-400" : "text-amber-800 ring-transparent hover:bg-white/60")}>{l}</button>
                ))}
              </div>
            </div>
          )}
          {error && <p className="mt-3 rounded-xl bg-rose-50 px-3.5 py-2.5 text-[13px] leading-5 text-rose-700 ring-1 ring-rose-500/20">{error}</p>}
        </ConfirmDialog>
      )}
    </Card>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className="flex justify-between gap-3"><dt className="shrink-0 text-ink-500">{label}</dt><dd className={clsx("text-right", strong ? "font-bold text-ink-900" : "font-semibold")}>{value}</dd></div>;
}

// 전체 출결 기록 엑셀 — 서버 판정(allowed)일 때만 버튼 활성. 누르면 서버가 그 자리에서 만들어 바로 내려주고(서버 저장 없음), '만들었다' 기록만 남깁니다.
function ExportCard({ s, onChanged }: { s: Status; onChanged: () => Promise<unknown> }) {
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const el = s.export.eligibility;
  const download = async () => {
    setState("working"); setMessage(null);
    try {
      const res = await fetch("/api/v1/admin/billing/attendance-export", { method: "POST", credentials: "include", headers: { "X-AttendPlus-Request": "1" } });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? "파일을 만들지 못했어요.");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") ?? "";
      const name = decodeURIComponent(disposition.match(/filename\*=UTF-8''([^;]+)/)?.[1] ?? "전체출결기록.xlsx");
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: name });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setState("idle");
      toast.success("전체 출결 기록 엑셀을 내려받았어요.");
    } catch (e) {
      setState("error"); setMessage(e instanceof Error ? e.message : "파일을 만들지 못했어요.");
    } finally { await onChanged(); }
  };
  return (
    <Card id="attendance-export" className="scroll-mt-24 p-5 sm:p-6">
      <SectionTitle icon={<FileSpreadsheet className="h-[18px] w-[18px]" />} title="전체 출결 기록 엑셀 다운로드" desc="구독을 해지했거나 미납일 때 학교 출결 기록을 확보할 수 있도록 제공해요." />
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <div className="rounded-xl bg-brand-50/60 px-4 py-3 text-[13.5px] leading-6 text-ink-700 ring-1 ring-brand-100">
          <b className="text-brand-700">포함 범위: 우리 학교 전체 학생 · 전체 기간 (과거 ~ 현재)</b><br />
          한 행에 학생 한 명의 한 교시 기록을 담아요. 열: <b>날짜 · 학번 · 이름 · 교시 · 과목 · 출결 상태 · 인증 방식</b> (출석인정·지각·보류·조퇴·결석 / GPS·QR·수동). 학생 목록 시트에 학생별 건수도 함께 들어가요.
        </div>
        <Button size="lg" disabled={!el.allowed || state === "working"} loading={state === "working"} icon={<Download className="h-4 w-4" />} onClick={download}>
          {state === "error" ? "다시 시도" : "엑셀 다운로드"}
        </Button>
      </div>
      <p className={clsx("mt-3 flex items-start gap-2 text-[13px] leading-5", el.allowed ? "text-mint-700" : "text-ink-500")}>
        {el.allowed ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <Info className="mt-0.5 h-4 w-4 shrink-0" />}{el.message}
      </p>
      {state === "working" && <p className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-brand-700"><Loader2 className="h-4 w-4 animate-spin" />파일을 만드는 중이에요… 기록이 많으면 시간이 걸려요. (출결 기록은 읽기만 해요)</p>}
      {state === "error" && <p className="mt-3 rounded-xl bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700 ring-1 ring-rose-500/20">{message} 출결 기록은 변경되지 않았어요. 다시 시도해 주세요.</p>}
      <p className="mt-3 text-[12.5px] text-ink-500">파일은 내려받는 즉시 만들어지고 서버에 저장되지 않아요. 서버에는 '언제 누가 몇 건을 만들었는지' 기록만 남아요.</p>
      {s.export.records.length > 0 && (
        <div className="mt-4">
          <div className="text-[12.5px] font-semibold text-ink-500">최근 생성 기록</div>
          <ul className="mt-1.5 divide-y divide-ink-100 rounded-xl bg-white px-3.5 ring-1 ring-ink-200/80">
            {s.export.records.map((r) => (
              <li key={r.aeId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[13px]">
                <span className="font-semibold text-ink-800">{kst(r.createdAt)} · 학생 {r.studentCount.toLocaleString()}명 · 기록 {r.recordCount.toLocaleString()}건{r.basis && BASIS_LABEL[r.basis] && <span className="ml-1.5 font-normal text-ink-500">({BASIS_LABEL[r.basis]})</span>}</span>
                <span className="text-[12px] text-ink-500">{r.fileSize != null ? `${(r.fileSize / 1024).toFixed(1)}KB` : "크기 기록 없음"} · 서버 저장 안 함</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

// 데모 시뮬레이션 (데모 환경 전용) — 실제 청구·메일 없이 상태 전환을 확인
const SIMS: { action: string; label: string; desc: string; when: (s: Status) => boolean }[] = [
  { action: "SCHEDULED_FAILED_KNOWN", label: "예정 결제 실패 (사유 확인)", desc: "카드 한도 초과 / 계좌 잔액 부족 (결제 수단별) → 미납·유예 시작", when: (s) => !s.delinquency && !s.unresolvedAttempt && s.subscription.paymentMode === "DEMO" },
  { action: "SCHEDULED_FAILED_UNKNOWN", label: "예정 결제 실패 (사유 미확인)", desc: "사유 없는 실패 → 원인을 단정하지 않고 상태 확인 안내", when: (s) => !s.delinquency && !s.unresolvedAttempt && s.subscription.paymentMode === "DEMO" },
  { action: "SCHEDULED_UNKNOWN", label: "결제 응답 없음", desc: "결과 미확인 → 미납 확정·재시도 보류", when: (s) => !s.delinquency && !s.unresolvedAttempt && s.subscription.paymentMode === "DEMO" },
  { action: "RECONCILE_SUCCEEDED", label: "결과 대조 → 성공", desc: "대행사 조회 결과 결제됨 → 구독 기간 추가", when: (s) => !!s.unresolvedAttempt },
  { action: "RECONCILE_FAILED", label: "결과 대조 → 실패", desc: "대행사 조회 결과 실패 → 미납 확정", when: (s) => !!s.unresolvedAttempt },
  { action: "ELAPSE_GRACE", label: "유예 기간 경과로 이동", desc: "실패 시각을 3일 전으로 옮겨 유예 종료 상태 확인", when: (s) => !!s.delinquency && s.delinquency.phase === "GRACE" },
];

function SimulationCard({ s, onChanged }: { s: Status; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const run = async (action: string) => {
    setBusy(action);
    try { await api.post("/admin/billing/simulate", { action }); await onChanged(); toast.success(s.integration.emailEnabled ? "시뮬레이션을 반영했어요. 실패 안내 메일은 실제로 발송돼요. (청구 없음)" : "시뮬레이션을 반영했어요. (실제 청구 없음)"); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : "시뮬레이션에 실패했어요."); } finally { setBusy(null); }
  };
  return (
    <Card className="border-2 border-dashed border-amber-300 p-5 sm:p-6">
      <SectionTitle icon={<FlaskConical className="h-[18px] w-[18px]" />} title="결제 상태 데모 시뮬레이션" desc="결제 실패·미납 흐름을 직접 확인해 볼 수 있어요. (데모 환경 전용)"
        right={<Button size="sm" variant="secondary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? "접기" : "열기"}</Button>} />
      {open && <>
      <p className="mt-3 text-[13px] leading-5 text-ink-500">돈은 오가지 않고 기록은 SIMULATED로 실제 결제와 구분돼요.{s.integration.emailEnabled && " 결제 실패 안내 메일은 관리자 이메일로 실제 발송돼요(본문에 '데모' 표시)."}
        {s.subscription.paymentMode !== "DEMO" && !s.delinquency && !s.unresolvedAttempt && " 먼저 요금제 · 결제 메뉴에서 데모 결제로 구독을 시작해 주세요."}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {SIMS.map((x) => (
          <button key={x.action} type="button" disabled={!x.when(s) || !!busy} onClick={() => run(x.action)}
            className="rounded-xl bg-white p-3 text-left ring-1 ring-ink-200 transition hover:ring-amber-400 disabled:cursor-not-allowed disabled:opacity-40">
            <div className="flex items-center gap-1.5 text-[13.5px] font-bold text-ink-900">{busy === x.action && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{x.label}</div>
            <div className="mt-0.5 text-[12px] leading-4 text-ink-500">{x.desc}</div>
          </button>
        ))}
      </div>
      </>}
    </Card>
  );
}

function AttemptList({ attempts, planName }: { attempts: Attempt[]; planName: (id: ServiceId) => string }) {
  return (
    <Card className="flex h-full flex-col p-5 sm:p-6">
      <SectionTitle icon={<ReceiptText className="h-[18px] w-[18px]" />} title="결제 내역" desc="최근 결제 시도 20건이에요." />
      {attempts.length === 0 ? <p className="mt-4 text-[13.5px] text-ink-500">결제 내역이 없어요.</p> : (
        <ul className="scrollbar-thin mt-3 max-h-[360px] divide-y divide-ink-100 overflow-y-auto pr-1">
          {attempts.map((a) => {
            const [label, tone] = ATTEMPT_STATUS[a.status] ?? [a.status, "bg-ink-100 text-ink-700 ring-ink-200"];
            return (
              <li key={a.paId} className="flex items-start justify-between gap-3 py-2.5 text-[13px]">
                <div className="min-w-0">
                  <div className="font-semibold text-ink-900">#{a.paId} {KIND[a.kind] ?? a.kind} · {planName(a.service)} {CYCLE_LABEL[a.cycle]} · {won(a.amount)}</div>
                  <div className="text-[12px] text-ink-500">{kst(a.requestedAt)}{a.method && ` · ${METHOD_LABEL[a.method]}`}{a.mode === "SIMULATED" && " · 시뮬레이션"}{a.status === "FAILED" && ` · ${a.failureReason ?? "사유 미확인"}`}</div>
                </div>
                <Badge className={tone}>{label}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function EmailList({ s }: { s: Status }) {
  return (
    <Card className="flex h-full flex-col p-5 sm:p-6">
      <SectionTitle icon={<Mail className="h-[18px] w-[18px]" />} title="결제 메일" desc="구독 시작·결제 실패·미납 안내를 관리자 이메일로 보내요." />
      {s.emails.length === 0 ? <p className="mt-4 text-[13.5px] text-ink-500">보낸 메일이 없어요.</p> : (
        <ul className="scrollbar-thin mt-3 max-h-[360px] divide-y divide-ink-100 overflow-y-auto pr-1">
          {s.emails.map((e) => (
            <li key={e.belId} className="flex items-start justify-between gap-3 py-2.5 text-[13px]">
              <div className="min-w-0">
                <div className="font-semibold text-ink-900">{MAIL_KIND[e.kind] ?? e.kind} · {e.recipient}</div>
                <div className="text-[12px] text-ink-500">{kst(e.sentAt ?? e.scheduledFor)}{e.skipReason && ` · ${e.skipReason}`}{e.status === "FAILED" && e.error && ` · ${e.error}`}{e.tries > 1 && ` · 시도 ${e.tries}회`}</div>
              </div>
              <Badge className={e.status === "SENT" ? "bg-mint-50 text-mint-700 ring-mint-500/25" : e.status === "FAILED" ? "bg-rose-50 text-rose-700 ring-rose-500/25" : "bg-ink-100 text-ink-600 ring-ink-200"}>{EMAIL_STATUS[e.status] ?? e.status}</Badge>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-auto pt-4 text-[12px] leading-5 text-ink-500">수신 주소는 내 정보에서 이메일 인증 + 비밀번호 확인 후 바꿀 수 있어요.</p>
    </Card>
  );
}
