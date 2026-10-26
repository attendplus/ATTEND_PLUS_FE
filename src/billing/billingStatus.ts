import { api } from "@/api/client";
import type { CycleId, PaymentMethodId, PaymentMethodInfo, ServiceId, Subscription } from "./subscription";

// *
// 구독 관리 상태 (GET /admin/billing/status) — 구독 관리·요금제 결제 화면 공용
// 판정(미납·유예·내보내기 허용·등록된 결제 수단)은 모두 서버 값입니다.
// *
export type Attempt = { paId: number; kind: string; mode: string; method: PaymentMethodId | null; service: ServiceId; cycle: CycleId; amount: number; status: string;
  failureCode: string | null; failureReason: string | null; requestedAt: string; resolvedAt: string | null };
export type ExportRecord = { aeId: number; basis?: string; studentCount: number; recordCount: number; fileName: string; fileSize: number | null; createdAt: string };
export type Instrument = { piId: number; method: PaymentMethodId; mode: string; brand: string | null; bank: string | null; last4: string;
  holderType: "PERSONAL" | "CORPORATE"; label: string; registeredAt: string };
export interface BillingStatus {
  now: string;
  autoPay: { enabled: boolean; updatedAt: string | null; updatedBy: string | null };
  paymentMethod: PaymentMethodId | null;
  paymentMethods: PaymentMethodInfo[];
  instruments: Instrument[];
  instrumentOptions: { cardBrands: { id: string; name: string }[]; banks: { id: string; name: string }[] };
  subscription: Subscription;
  cancellation: null | { ssubId: number; service: ServiceId; cycle: CycleId; canceledAt: string };   // 해지된 학교 (해지 즉시 전체 출결 엑셀 허용)
  nextBillingAt: string | null;
  delinquency: null | { bdId: number; mode: string; service: ServiceId; cycle: CycleId; amount: number; failedAt: string; graceEndsAt: string; phase: "GRACE" | "OVERDUE";
    failureCode: string | null; failureReason: string | null; guide: string; retryCount: number };
  unresolvedAttempt: Attempt | null;
  attempts: Attempt[];
  emails: { belId: number; kind: string; error: string | null; recipient: string; status: string; skipReason: string | null; tries: number; scheduledFor: string; sentAt: string | null }[];
  export: { eligibility: { allowed: boolean; code: string; message: string }; records: ExportRecord[] };
  policy: { gracePeriodHours: number; maxNoticeEmailsPerDay: number; noticeEmailMinIntervalHours: number; retryScheduleHours: number[]; rules: string[] };
  integration: { pgConnected: boolean; emailEnabled: boolean; automationEnabled: boolean; simulation: boolean };
  supportEmail: string;
}

export const fetchBillingStatus = () => api.get<BillingStatus>("/admin/billing/status");
export const instrumentOf = (s: BillingStatus | null, method: PaymentMethodId | null) => s?.instruments.find((i) => i.method === method) ?? null;
export const kst = (s: string | null | undefined) => s ? new Date(s).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }) : "-";
