import type { AttStatus } from "@/api/types";

export const STATUS_META: Record<AttStatus, { label: string; tone: string; dot: string; soft: string }> = {
  PRESENT: { label: "출석", tone: "text-mint-600", dot: "bg-mint-500", soft: "bg-mint-50 text-mint-600 ring-mint-500/20" },
  LATE: { label: "지각", tone: "text-amber-600", dot: "bg-amber-500", soft: "bg-amber-50 text-amber-600 ring-amber-500/20" },
  ABSENT: { label: "결석", tone: "text-rose-600", dot: "bg-rose-500", soft: "bg-rose-50 text-rose-600 ring-rose-500/20" },
  EARLY_LEAVE: { label: "조퇴", tone: "text-sky-500", dot: "bg-sky-500", soft: "bg-sky-50 text-sky-500 ring-sky-500/20" },
  PENDING: { label: "보류", tone: "text-ink-500", dot: "bg-ink-400", soft: "bg-ink-100 text-ink-500 ring-ink-400/20" },
};

export const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

export const pad = (n: number) => String(n).padStart(2, "0");

export function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDate(iso: string, withWeekday = true) {
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  const wd = (d.getDay() + 6) % 7;
  return `${d.getMonth() + 1}월 ${d.getDate()}일${withWeekday ? ` (${WEEKDAYS[wd]})` : ""}`;
}

// 서버 시각(ISO, 시간대 포함)을 학교 기준 시간대(KST)로 표시합니다. 브라우저 시간대가 달라도 같은 시각으로 보입니다.
const KST_TIME = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false });
export function formatTime(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : KST_TIME.format(d);
}

export function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return formatDate(iso, false);
}

export const ROLE_LABEL = { STUDENT: "학생", TEACHER: "교사", SCHOOL_ADMIN: "학교 관리자" } as const;
// 서버와 같은 규칙: 8~64자, 영문 대·소문자·숫자·특수문자 포함
export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,64}$/;
