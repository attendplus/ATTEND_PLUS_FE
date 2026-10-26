import { AnimatePresence, motion } from "framer-motion";
import { Clock, Maximize2, Minimize2, QrCode, RefreshCw, Users } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "@/api/client";
import ClassTabs from "@/components/ClassTabs";
import { Button, Card, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { useAction, useAsync, useNow } from "@/lib/hooks";

// kind: LESSON — 수업 교실 QR만 있습니다. (담임반 QR 없음)
interface Target { key: string; kind: "LESSON"; label: string; subjects: string[]; todayPeriods: { perNo: number; start: string; end: string }[]; availableNow: boolean }
interface Targets { currentPerNo: number | null; targets: Target[] }
interface Qr { qrId: number; payload: string; classLabel: string; perNo: number; periodStart: string; expiresAt: string; checkedCount: number; serverNow: string }

// *
// QR 출석 (교사)
// GET  /teacher/qr/targets                 — QR을 띄울 수 있는 수업 교실: 오늘 시간표에서 내가 수업하는 교실(교시 포함)
// GET  /teacher/qr/current?target=3-5      — 지금 그 교실 수업의 QR (없으면 자동 생성, 교시가 끝나면 만료)
// POST /teacher/qr/regenerate?target=…     — 기존 QR 폐기 후 새로 생성
// 출석 대상은 이동수업 배정(엑셀) 기준으로 이 교시에 이 교실에서 수업을 듣는 학생이며, 학생의 담임 학급과는 관계없습니다.
// 출석 기록의 담당 교사는 QR을 띄운 수업 교사입니다.
// *
export default function TeacherQr() {
  const targets = useAsync(() => api.get<Targets>("/teacher/qr/targets"), []);
  const [target, setTarget] = useState<string>("");
  // 처음에는 지금 수업 중인 교실 → 첫 번째 교실 순으로 고릅니다.
  useEffect(() => {
    const list = targets.data?.targets ?? [];
    if (!list.length || list.some((t) => t.key === target)) return;
    setTarget((list.find((t) => t.availableNow) ?? list[0]).key);
  }, [targets.data, target]);
  if (targets.loading) return <><PageHeader title="QR 출석" /><Skeleton className="h-[520px]" /></>;
  if (targets.error) return <><PageHeader title="QR 출석" /><Card><ErrorState error={targets.error} onRetry={() => targets.reload()} /></Card></>;
  if (!targets.data?.targets.length) return (
    <><PageHeader title="QR 출석" /><Card><EmptyState icon={<QrCode className="h-6 w-6" />} title="오늘 QR을 띄울 수업이 없어요." description="QR은 오늘 시간표에서 내가 수업하는 교실에서만 만들 수 있어요. 시간표는 관리자의 '시간표 연동'으로 동기화되고, 내 계정이 시간표 교사 이름과 연결되어 있어야 해요." /></Card></>
  );
  const picked = targets.data.targets.find((t) => t.key === target);
  const tabs = (
    <ClassTabs label="QR을 띄울 수업 교실" value={target} onChange={setTarget} tabs={targets.data.targets.map((t) => ({
      key: t.key, kind: "MOVING", label: t.label,
      sub: t.todayPeriods.length ? `오늘 ${t.todayPeriods.map((p) => p.perNo).join("·")}교시` : "오늘 수업 없음",
      badge: t.availableNow ? <span className="shrink-0 rounded-full bg-mint-500 px-1.5 text-[10px] font-bold leading-4 text-white">수업 중</span> : undefined,
    }))} />
  );
  return picked ? <TargetQr key={picked.key} target={picked} tabs={tabs} onExpired={targets.reload} /> : tabs;
}

function TargetQr({ target, tabs, onExpired }: { target: Target; tabs: ReactNode; onExpired: (silent?: boolean) => unknown }) {
  const params = { target: target.key };
  const { data, loading, error, reload, setData } = useAsync(() => api.get<Qr>("/teacher/qr/current", params), [target.key]);
  const { run, pending } = useAction();
  const now = useNow(1000);
  const [full, setFull] = useState(false);
  // 서버 시각과 브라우저 시각의 차이를 보정해 남은 시간을 계산합니다.
  const [offset, setOffset] = useState(0);
  useEffect(() => { if (data) setOffset(new Date(data.serverNow).getTime() - Date.now()); }, [data]);
  const boxRef = useRef<HTMLDivElement>(null);

  // 출석 인원 갱신 + 교시가 바뀌면 새 QR 자동 생성
  // (탭이 가려져 있는 동안에는 갱신을 건너뛰고, 다시 보이면 바로 갱신합니다.)
  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") reload(true); };
    const t = setInterval(tick, 10000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", tick); };
  }, [reload]);

  const left = data ? Math.max(0, Math.floor((new Date(data.expiresAt).getTime() - (now.getTime() + offset)) / 1000)) : 0;
  const total = data ? Math.max(1, (new Date(data.expiresAt).getTime() - new Date(data.periodStart).getTime()) / 1000) : 1;
  // 교시가 끝나면 한 번만 새 QR을 요청하고, 반 목록(오늘 수업·수업 중 표시)도 갱신합니다.
  const expiredRef = useRef<number | null>(null);
  useEffect(() => {
    if (!data || left > 0 || expiredRef.current === data.qrId) return;
    expiredRef.current = data.qrId;
    reload(true);
    onExpired(true);
  }, [left, data, reload, onExpired]);

  // 남은 시간 표시 때문에 1초마다 다시 그려지므로, QR 코드(행렬 계산·SVG)는 내용이 바뀔 때만 새로 만듭니다.
  // 좁은 화면에서는 카드 폭에 맞춰 줄어듭니다. (가로 스크롤 방지)
  const qrSize = full ? 460 : 320;
  const qrCode = useMemo(() => data && <QRCodeSVG value={data.payload} size={qrSize} level="M" fgColor="#0B1020" title={`${data.classLabel} ${data.perNo}교시 출석 QR 코드`} style={{ width: "100%", height: "auto", maxWidth: qrSize }} />, [data?.payload, qrSize]);

  const toggleFull = async () => {
    if (!document.fullscreenElement) { await boxRef.current?.requestFullscreen?.(); setFull(true); }
    else { await document.exitFullscreen(); setFull(false); }
  };
  useEffect(() => { const h = () => setFull(!!document.fullscreenElement); document.addEventListener("fullscreenchange", h); return () => document.removeEventListener("fullscreenchange", h); }, []);

  return (
    <>
      <PageHeader title="QR 출석" description={`${target.label} 수업 교시에만 QR이 만들어져요. 이동수업 배정상 이 교시에 이 교실에서 수업을 듣는 학생만 출석할 수 있고(담임 학급과 무관), 출석은 선생님 담당 수업으로 기록돼요.`}
        actions={data && <>
          <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} loading={pending} onClick={async () => { const r = await run(() => api.post<Qr>(`/teacher/qr/regenerate?target=${encodeURIComponent(target.key)}`), "기존 QR을 폐기하고 새 QR을 생성했습니다."); if (r) setData(r); }}>QR 재생성</Button>
          <Button icon={<Maximize2 className="h-4 w-4" />} onClick={toggleFull}>TV 모드</Button>
        </>} />
      {tabs}
      {loading ? <Skeleton className="h-[520px]" /> : error ? (
        <Card><EmptyState icon={<QrCode className="h-6 w-6" />} title={error.message} description={error.code === "ATT402" || error.code === "QR405"
          ? (target.todayPeriods.length ? `오늘 수업: ${target.todayPeriods.map((p) => `${p.perNo}교시(${p.start}~${p.end})`).join(", ")} — 수업 시작 5분 전부터 QR이 생성됩니다.` : "오늘은 이 반 수업이 없어요.")
          : undefined} action={<Button variant="secondary" onClick={() => reload()}>다시 시도</Button>} /></Card>
      ) : data && (
        <div ref={boxRef} className="relative overflow-clip rounded-3xl bg-gradient-to-br from-ink-950 via-[#142944] to-brand-800 p-6 text-white sm:p-10">
          <div className="pointer-events-none absolute -left-20 -top-20 h-80 w-80 rounded-full bg-brand-500/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-10 h-80 w-80 rounded-full bg-mint-500/25 blur-3xl" />
          {full && <button onClick={toggleFull} aria-label="TV 모드 끝내기" className="focus-ring absolute right-6 top-6 z-10 rounded-xl bg-white/10 p-2 ring-1 ring-white/20"><Minimize2 className="h-5 w-5" /></button>}
          <div className="relative grid min-w-0 items-center gap-8 sm:gap-10 lg:grid-cols-[1fr_auto]">
            <div>
              <div className="text-[15px] font-semibold text-white/60">{data.classLabel}</div>
              <div className="mt-1 text-[56px] font-black leading-none tracking-tight sm:text-[72px]">{data.perNo}교시</div>
              <div className="mt-3 text-[18px] text-white/80">휴대폰 앱의 <b>QR 출석</b>으로 스캔하세요</div>
              <div className="mt-8 grid max-w-md grid-cols-2 gap-3 sm:mt-10 sm:gap-4">
                <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur">
                  <div className="flex items-center gap-1.5 text-[13px] text-white/60"><Clock className="h-4 w-4" />만료까지</div>
                  <div className="mt-1 text-[32px] font-extrabold tabular-nums">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</div>
                </div>
                <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur">
                  <div className="flex items-center gap-1.5 text-[13px] text-white/60"><Users className="h-4 w-4" />출석 확인</div>
                  <AnimatePresence mode="popLayout">
                    <motion.div key={data.checkedCount} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -16, opacity: 0 }} className="mt-1 text-[32px] font-extrabold tabular-nums">{data.checkedCount}명</motion.div>
                  </AnimatePresence>
                </div>
              </div>
              <div className="mt-6 h-2 max-w-md overflow-hidden rounded-full bg-white/10">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-mint-500 to-brand-300" animate={{ width: `${(left / total) * 100}%` }} transition={{ ease: "linear" }} />
              </div>
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={data.payload} initial={{ opacity: 0, rotateY: 90, scale: 0.9 }} animate={{ opacity: 1, rotateY: 0, scale: 1 }} exit={{ opacity: 0, rotateY: -90 }} transition={{ type: "spring", stiffness: 120, damping: 16 }}
                className="relative mx-auto w-full max-w-[384px] rounded-[28px] bg-white p-4 shadow-[0_30px_80px_-20px_rgba(43,87,147,.6)] sm:p-6" style={full ? { maxWidth: 524 } : undefined}>
                <motion.div className="absolute -inset-1 rounded-[32px] bg-gradient-to-br from-brand-400 via-mint-500 to-brand-600 opacity-60 blur" animate={{ opacity: [0.35, 0.7, 0.35] }} transition={{ duration: 3, repeat: Infinity }} />
                <div className="relative rounded-2xl bg-white p-2">
                  {qrCode}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      )}
    </>
  );
}
