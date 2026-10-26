import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { AlertTriangle, Clock3, Hourglass, KeyRound, MapPin, QrCode, Smartphone, Sparkles, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/api/client";
import type { Attendance } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Skeleton, describeError } from "@/components/ui";
import { formatDate, formatTime, STATUS_META } from "@/lib/format";
import { useAsync, useNow } from "@/lib/hooks";
import { canUse, useSubscription } from "@/billing/subscription";
import { LockedFeature } from "@/billing/SubscriptionGate";
import QrScanner from "./QrScanner";

interface TodayPeriod { perNo: number; start: string; end: string; subject?: string | null; classroom?: string | null; phase: string; special?: string | null; attendance: Attendance | null }
interface Today { date: string; now: string; currentPerNo: number | null; periods: TodayPeriod[] }
interface CheckResult { result: "PRESENT" | "LATE" | "PENDING" | "OUT_OF_RANGE"; message: string; perNo: number; classroom?: string | null; distanceM?: number | null }

// GPS: 시작 0~3분 출석, 3분 초과~10분 지각, 10분 이후 미확인은 보류(담당 교사 확인). QR: 시작 10분 이내 출석, 이후 수업 종료 전까지 지각.
const PHASE_LABEL: Record<string, string> = { before: "수업 전", first: "출석 확인 (3분)", recheck: "지각 확인 (10분까지)", late_window: "보류 · QR 지각 가능", ended: "종료" };

function ResultIcon({ result }: { result: CheckResult["result"] }) {
  if (result === "PRESENT" || result === "LATE") {
    const color = result === "PRESENT" ? "#12B886" : "#F59F00";
    return (
      <svg viewBox="0 0 80 80" className="h-24 w-24">
        <motion.circle cx="40" cy="40" r="34" fill="none" stroke={color} strokeWidth="5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6 }} />
        <motion.path d="M25 41l10 10 20-22" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.5, duration: 0.4 }} />
      </svg>
    );
  }
  return (
    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className={clsx("grid h-24 w-24 place-items-center rounded-full", result === "PENDING" ? "bg-ink-100 text-ink-500" : "bg-rose-50 text-rose-500")}>
      {result === "PENDING" ? <Hourglass className="h-10 w-10" /> : <XCircle className="h-10 w-10" />}
    </motion.div>
  );
}

// 소속 학급이 없거나(거절·탈퇴·강퇴) 승인 대기 중일 때: 학급 고유 가입 코드로 가입 요청 (POST /student/class/join)
function JoinClass({ status, onJoined }: { status?: string | null; onJoined: () => void }) {
  const [code, setCode] = useState("");
  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(false);
  if (status === "PENDING") {
    return (
      <Card className="p-10 text-center">
        <motion.div animate={{ rotate: [0, 180, 180, 360] }} transition={{ duration: 2.4, repeat: Infinity }} className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-50 text-amber-600"><Hourglass className="h-8 w-8" /></motion.div>
        <div className="mt-5 text-[19px] font-extrabold">학급 가입 승인 대기 중</div>
        <p className="mt-1.5 text-[14px] text-ink-500">담임 선생님이 가입 요청을 승인하면 출석 기능을 사용할 수 있어요.</p>
      </Card>
    );
  }
  const join = async () => {
    setLoading(true);
    try {
      await api.post("/student/class/join", { classCode: code, studentId: Number(studentId) });
      toast.success("가입 요청을 보냈습니다.");
      onJoined();
    } catch (e) { toast.error(e instanceof ApiError ? e.message : "가입 요청에 실패했습니다."); } finally { setLoading(false); }
  };
  return (
    <Card className="mx-auto max-w-lg p-8">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600"><KeyRound className="h-6 w-6" /></div>
      <div className="mt-4 text-[19px] font-extrabold">{status === "REJECTED" ? "가입 요청이 거절되었어요" : status === "KICKED" ? "학급에서 나가게 되었어요" : status === "INACTIVE" ? "다른 학급으로 가입 요청" : "소속된 학급이 없어요"}</div>
      <p className="mt-1 text-[14px] text-ink-500">담임 선생님께 받은 학급 고유 가입 코드로 다시 가입을 요청하세요.</p>
      <div className="mt-6 space-y-3">
        <Input label="학급 고유 가입 코드" required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <Input label="학번" required inputMode="numeric" placeholder="예: 30201" value={studentId} maxLength={5}
          onChange={(e) => setStudentId(e.target.value.replace(/\D/g, "").slice(0, 5))}
          hint={/^\d{5}$/.test(studentId) ? `→ ${studentId[0]}학년 ${Number(studentId.slice(1, 3))}반 ${Number(studentId.slice(3))}번` : "학년(1자리)·반(2자리)·번호(2자리) 5자리, 번호는 자동으로 정해져요."} />
        <Button className="w-full" size="lg" onClick={join} loading={loading} disabled={!code || !/^\d{5}$/.test(studentId)}>가입 요청</Button>
      </div>
    </Card>
  );
}

// GPS 출석은 학생 앱(출결플러스)이 수업 시작부터 자동으로 측정합니다. 웹에서는 상태 안내와 QR 출석만 제공합니다.
function AppGuide() {
  return (
    <div className="relative grid h-44 w-44 place-items-center">
      <motion.span className="absolute inset-0 rounded-full border-2 border-white/40" animate={{ scale: [0.85, 1.05, 0.85], opacity: [0.6, 0.25, 0.6] }} transition={{ duration: 3, repeat: Infinity }} />
      <div className="relative grid h-20 w-20 place-items-center rounded-full bg-white text-brand-600 shadow-2xl">
        <Smartphone className="h-9 w-9" />
      </div>
    </div>
  );
}

// 학급 가입(구독 없이 가능) → 학교 구독 확인 → 오늘 출석. 구독 전에는 출석 API를 부르지 않습니다.
export default function StudentDashboard() {
  const { profile, refresh } = useAuth();
  const sub = useSubscription();
  const membership = profile?.schoolClass?.membershipStatus;
  // 소속 학급이 비활성화됨: 소속·출결 기록은 그대로, 재활성화되면 바로 다시 출석 가능 (다른 학급으로 옮기려면 가입 요청)
  if (profile?.schoolClass && !profile.schoolClass.isActive && (membership === "APPROVED" || membership === "PENDING")) {
    return (
      <>
        <PageHeader eyebrow={profile.school.name} title={`안녕하세요, ${profile.name}님`} />
        <Card className="mx-auto mb-5 max-w-lg p-6">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-600"><AlertTriangle className="h-6 w-6" /></div>
          <div className="mt-4 text-[19px] font-extrabold">{profile.schoolClass.label}이(가) 비활성화되었어요</div>
          <p className="mt-1.5 text-[14px] leading-6 text-ink-500">지금은 출석할 수 없어요. 학급 소속과 지금까지의 출결 기록은 그대로 보관돼 있어요.
            담임 선생님이나 학교 관리자가 학급을 <b className="text-ink-800">재활성화</b>하면 바로 다시 출석할 수 있어요.</p>
          <p className="mt-3 text-[13px] text-ink-500">다른 학급으로 옮겨야 한다면 아래에서 새 학급 가입 코드로 가입을 요청하세요.</p>
        </Card>
        <JoinClass status="INACTIVE" onJoined={() => refresh()} />
      </>
    );
  }
  if (!profile?.schoolClass || membership !== "APPROVED") {
    return (
      <>
        <PageHeader eyebrow={profile?.school.name} title={`안녕하세요, ${profile?.name}님`} />
        <JoinClass status={membership} onJoined={() => refresh()} />
      </>
    );
  }
  if (sub.loading) return <div className="space-y-4"><Skeleton className="h-16" /><Skeleton className="h-96" /></div>;
  if (!canUse(sub.subscription)) return <LockedFeature />;
  return <TodayBoard />;
}

function TodayBoard() {
  const { profile } = useAuth();
  const { data, loading, error, reload } = useAsync(() => api.get<Today>("/student/attendance/today"), []);
  const target = useAsync(() => api.get<{ perNo: number | null; reason: string | null; room: { name: string; floorNo: number | null } | null }>("/student/attendance/target").catch(() => null), [data?.currentPerNo]);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrBusy, setQrBusy] = useState(false);
  const [offset, setOffset] = useState(0);
  useEffect(() => { if (data) setOffset(new Date(data.now).getTime() - Date.now()); }, [data]);

  const onQr = useCallback(async (text: string) => {
    setQrBusy(true);
    try {
      const r = await api.post<CheckResult>("/student/attendance/qr", { code: text });
      setResult(r);
      setQrOpen(false);
      toast.success(r.message);
      reload(true);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "QR 코드 인증에 실패했습니다.");
    } finally {
      setTimeout(() => setQrBusy(false), 1500);
    }
  }, [reload]);

  if (!profile?.schoolClass) return null;

  const current = data?.periods.find((p) => p.perNo === data.currentPerNo) ?? null;
  const next = data?.periods.find((p) => p.phase === "before");
  const done = current?.attendance && current.attendance.status !== "PENDING";
  const canQr = current && !current.special && !done && current.phase !== "ended";

  return (
    <>
      <PageHeader eyebrow={`${profile.school.name} · ${profile.schoolClass.label}`} title={`안녕하세요, ${profile.name}님`}
        description={`${formatDate(data?.date ?? new Date().toISOString())} · 오늘도 좋은 하루 보내세요!`} />

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        {/* 현재 교시 출석 카드 */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          className="relative overflow-clip rounded-3xl bg-gradient-to-br from-brand-500 via-brand-600 to-[#1F406D] p-6 text-white shadow-lift sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-24 left-10 h-64 w-64 rounded-full bg-mint-500/30 blur-3xl" />
          <div className="relative flex items-center justify-between">
            <Badge className="bg-white/15 text-white ring-white/30"><Clock3 className="h-3 w-3" /><LiveClock offset={offset} /></Badge>
            {current && <Badge className="bg-white/15 text-white ring-white/30">{PHASE_LABEL[current.phase]}</Badge>}
          </div>

          {loading ? (
            <div className="relative mt-8 space-y-3"><Skeleton className="h-8 w-40 bg-white/20" /><Skeleton className="h-44 w-44 rounded-full bg-white/20" /></div>
          ) : error ? (
            <div role="alert" className="relative mt-10 space-y-3">
              <div className="text-[15px] font-semibold">{describeError(error).title}</div>
              <p className="text-[13px] leading-5 text-white/75">{describeError(error).fix}</p>
              <Button variant="secondary" size="sm" onClick={() => reload()}>다시 시도</Button>
            </div>
          ) : (
            <div className="relative mt-6 flex flex-col items-center text-center">
              <div className="text-[13.5px] font-semibold text-white/75">{current ? `${current.perNo}교시 · ${current.start} - ${current.end}` : "지금은 수업 시간이 아니에요"}</div>
              <div className="mt-1 text-[28px] font-extrabold tracking-tight">{current?.subject ?? (next ? `다음 수업 ${next.perNo}교시 ${next.subject ?? ""}` : data && data.periods.length === 0 ? "오늘은 수업이 없어요" : "오늘 수업이 끝났어요")}</div>
              {(target.data?.room || current?.classroom) && (
                <div className="mt-1 flex items-center gap-1 text-[13.5px] text-white/80">
                  <MapPin className="h-3.5 w-3.5" />
                  {target.data?.room ? `${target.data.room.floorNo ? `${target.data.room.floorNo}층 ` : ""}${target.data.room.name}` : current?.classroom}
                  {target.data?.reason?.includes("블록") && <span className="ml-1 rounded-md bg-white/15 px-1.5 py-0.5 text-[11px] font-semibold">이동수업</span>}
                </div>
              )}

              <AnimatePresence mode="wait">
                {current?.special ? (
                  <motion.div key="special" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="my-8 rounded-2xl bg-white/15 px-6 py-5 ring-1 ring-white/30">
                    <Sparkles className="mx-auto h-7 w-7" />
                    <div className="mt-2 font-bold">특별 일정 · {current.special}</div>
                    <div className="text-[13px] text-white/75">이 교시는 출결을 확인하지 않습니다.</div>
                  </motion.div>
                ) : result && result.perNo === current?.perNo ? (
                  <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="my-6 flex flex-col items-center rounded-3xl bg-white px-8 py-6 text-ink-900 shadow-2xl">
                    <ResultIcon result={result.result} />
                    <div className="mt-2 max-w-xs text-[14.5px] font-semibold">{result.message}</div>
                    {result.distanceM != null && <div className="mt-1 text-[12px] text-ink-500">교실 중앙까지 약 {result.distanceM}m</div>}
                  </motion.div>
                ) : done ? (
                  <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="my-6 flex flex-col items-center rounded-3xl bg-white px-8 py-6 text-ink-900 shadow-2xl">
                    <ResultIcon result={current!.attendance!.status === "LATE" ? "LATE" : "PRESENT"} />
                    <div className="mt-2 font-bold">{current!.attendance!.statusLabel} · {current!.attendance!.methodLabel}</div>
                    <div className="text-[12.5px] text-ink-500">{formatTime(current!.attendance!.checkedAt)} 확인</div>
                  </motion.div>
                ) : (
                  <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="my-4 flex flex-col items-center">
                    <AppGuide />
                    <div className="mt-1 text-[13.5px] font-semibold text-white/85">{current ? "출결플러스 앱이 교실 위치를 자동으로 확인하고 있어요" : "수업이 시작되면 앱이 자동으로 출석을 확인해요"}</div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex w-full max-w-sm gap-2">
                <Button size="lg" className="flex-1 bg-white !bg-none !text-brand-700 shadow-xl hover:!bg-white" onClick={() => setQrOpen(true)} disabled={!canQr} icon={<QrCode className="h-4 w-4" />}>QR 출석</Button>
              </div>
              <p className="mt-3 text-[12px] text-white/70">GPS 출석은 출결플러스 앱에서 자동으로 진행돼요. 위치 확인이 어려우면 교실 화면의 QR로 출석하세요.</p>
            </div>
          )}
        </motion.div>

        {/* 오늘 타임라인 */}
        <Card initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-[16px] font-bold">오늘의 출결</div>
            <div className="flex gap-3 text-[12px] text-ink-500">
              {(["PRESENT", "LATE"] as const).map((s) => <span key={s} className="flex items-center gap-1"><span className={clsx("h-2 w-2 rounded-full", STATUS_META[s].dot)} />{STATUS_META[s].label}</span>)}
            </div>
          </div>
          {loading ? <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
            : !data || data.periods.length === 0 ? <EmptyState title="오늘은 수업이 없어요" description="주말이거나 교시 정보가 등록되지 않았습니다." />
            : (
              <ol className="relative space-y-2">
                <div className="absolute bottom-4 left-[22px] top-4 w-px bg-ink-200" />
                {data.periods.map((p, i) => {
                  const isCurrent = p.perNo === data.currentPerNo;
                  const meta = p.attendance ? STATUS_META[p.attendance.status] : null;
                  return (
                    <motion.li key={p.perNo} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.05 }}
                      className={clsx("relative flex items-center gap-3 rounded-2xl p-2.5 pr-3", isCurrent && "bg-brand-50 ring-1 ring-brand-200")}>
                      <div className={clsx("relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-extrabold ring-4 ring-white", meta ? `${meta.dot} text-white` : isCurrent ? "bg-brand-500 text-white" : "bg-ink-100 text-ink-500")}>
                        {isCurrent && !meta && <span className="absolute inset-0 animate-ping rounded-full bg-brand-400/50" />}
                        <span className="relative">{p.perNo}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-bold">{p.special ? `✨ ${p.special}` : p.subject ?? "수업"}</div>
                        <div className="text-[12px] text-ink-500">{p.start} - {p.end}{p.classroom ? ` · ${p.classroom}` : ""}</div>
                      </div>
                      {p.attendance ? (
                        <Badge className={meta!.soft}>{p.attendance.statusLabel} · {p.attendance.methodLabel}</Badge>
                      ) : p.phase === "ended" && !p.special ? (
                        <Badge className="bg-ink-100 text-ink-500 ring-ink-200"><AlertTriangle className="h-3 w-3" />미확인</Badge>
                      ) : null}
                    </motion.li>
                  );
                })}
              </ol>
            )}
        </Card>
      </div>

      <Modal open={qrOpen} onClose={() => setQrOpen(false)} title="QR 출석" description="선생님이 TV에 띄운 이번 교시 QR 코드를 스캔하세요." size="sm">
        {qrOpen && <QrScanner onDetect={onQr} paused={qrBusy} />}
      </Modal>
    </>
  );
}

// 1초마다 바뀌는 시계는 따로 떼어 이 부분만 다시 그립니다. (출석 카드·교시 목록 전체가 매초 다시 그려지지 않게)
function LiveClock({ offset }: { offset: number }) {
  const now = useNow(1000);
  return <>{new Date(now.getTime() + offset).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</>;
}
