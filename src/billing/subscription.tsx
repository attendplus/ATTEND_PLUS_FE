import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/api/client";

// *
// 학교 구독 상태 + 요금제 (모든 역할)
// GET /billing/subscription — 내 학교 구독 여부·서비스 유형·결제 방식 (서버가 기능 API마다 같은 조건으로 402/403을 돌려줌)
// GET /billing/plans        — 요금제별 가격·할인·기능 (서버 공통 요금제 설정 module_core/common/billing.py, 로그인 없이 조회 가능)
// 화면은 이 값으로 잠금 화면·요금제 화면을 그리고, 실제 접근 제한은 서버가 합니다.
// *
export type ServiceId = "QR" | "QR_GPS";
export type CycleId = "MONTHLY" | "YEARLY";
export type PaymentMode = "DEMO" | "MANUAL" | "PG";
export type PaymentMethodId = "CARD" | "BANK_TRANSFER";
export interface PaymentMethodInfo { id: PaymentMethodId; name: string; summary: string; autoPay: string; notes: string[] }

export interface Quote { months: number; listPrice: number; discountRate: number; discountAmount: number; finalPrice: number; monthlyEquivalent: number }
export interface ServicePlan { id: ServiceId; name: string; summary: string; features: string[]; extraFeatures: string[]; monthlyPrice: number; quotes: Record<CycleId, Quote> }
export interface Plans { currency: string; yearlyDiscountRate: number; cycles: { id: CycleId; months: number }[]; services: ServicePlan[]; paymentMethods: PaymentMethodInfo[] }
export interface Subscription {
  active: boolean; service: ServiceId | null; cycle: CycleId | null; paymentMode: PaymentMode | null; paymentMethod: PaymentMethodId | null; amount: number | null;
  startedAt: string | null; expiresAt: string | null; demoCheckout: boolean;
}

export const fetchPlans = () => api.get<Plans>("/billing/plans");

// failure: 오류 원본(연결 끊김·권한 등 원인별 안내용), error: 화면에 바로 쓰는 메시지
interface Value { loading: boolean; error: string | null; failure?: unknown; subscription: Subscription | null; plans: Plans | null; reload: () => Promise<void> }
const Ctx = createContext<Value>({ loading: false, error: null, subscription: null, plans: null, reload: async () => undefined });

export function SubscriptionProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [state, setState] = useState<Omit<Value, "reload">>({ loading: enabled, error: null, subscription: null, plans: null });
  const load = useCallback(async () => {
    if (!enabled) return;
    setState((s) => ({ ...s, loading: s.subscription === null, error: null, failure: undefined }));
    try {
      const [subscription, plans] = await Promise.all([api.get<Subscription>("/billing/subscription"), fetchPlans()]);
      setState({ loading: false, error: null, subscription, plans });
    } catch (e) {
      setState({ loading: false, error: e instanceof Error ? e.message : "구독 정보를 불러오지 못했어요.", failure: e, subscription: null, plans: null });
    }
  }, [enabled]);
  useEffect(() => { load(); }, [load]);
  return <Ctx.Provider value={{ ...state, reload: load }}>{children}</Ctx.Provider>;
}

export const useSubscription = () => useContext(Ctx);

// 기능별 이용 가능 여부: GPS 기능은 QR + GPS 구독이 필요
export function canUse(subscription: Subscription | null, gps = false) {
  if (!subscription?.active) return false;
  return gps ? subscription.service === "QR_GPS" : true;
}

export const planOf = (plans: Plans | null, id: ServiceId | null) => plans?.services.find((s) => s.id === id) ?? null;
export const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
export const METHOD_LABEL: Record<PaymentMethodId, string> = { CARD: "신용카드", BANK_TRANSFER: "계좌이체" };
export const CYCLE_LABEL: Record<CycleId, string> = { MONTHLY: "월간", YEARLY: "연간" };
