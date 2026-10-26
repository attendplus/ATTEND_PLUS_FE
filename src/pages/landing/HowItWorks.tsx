import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import clsx from "clsx";
import { BellRing, CalendarDays, Check, Map, MapPin, Navigation, Smartphone } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ease, SectionHead } from "./shared";

// *
// 작동 방식 — 스크롤하면 왼쪽 단계가 하나씩 강조되고, 오른쪽 그림이 그 단계로 바뀝니다. (모바일은 단계마다 그림을 바로 아래에 표시)
// 설명 내용은 실제 서버 동작(컴시간 연동, 배치도 정합, 이동수업 판단, 출석 판정, 담당 교사 전달)과 같습니다.
// 그림은 형태를 보여주는 예시이며 실제 학교 데이터가 아닙니다.
// *
const STEPS: { icon: ReactNode; title: string; desc: string; points: string[] }[] = [
  {
    icon: <CalendarDays className="h-4 w-4" />, title: "시간표를 자동으로 가져와요",
    desc: "학교를 등록하면 컴시간 알리미에서 반별 시간표와 교시 시각을 받아 와요.",
    points: ["학급 생성·교사 가입·배정 엑셀 업로드 즉시 다시 연동", "이후 12시간마다 자동 갱신", "교시 시각으로 교시표도 함께 맞춰요"],
  },
  {
    icon: <Map className="h-4 w-4" />, title: "교실 지도를 만들어요",
    desc: "교실 배치도 PDF를 올리면 층과 교실을 인식하고, 실제 건물 외곽(VWorld)에 맞춰 교실마다 위치 영역을 만들어요.",
    points: ["모든 층이 한 장에 있는 PDF 그대로 사용", "빠진 공간은 도면 위에 직접 그려 추가", "과목별로 출석을 인정할 공간도 지정"],
  },
  {
    icon: <Navigation className="h-4 w-4" />, title: "학생마다 수업 교실을 정해요",
    desc: "시간표의 과목과 학년별 이동수업 배정표를 합쳐, 교시마다 학생이 가야 할 교실과 담당 선생님을 정해요.",
    points: ["본반 수업은 담임 교실", "이동수업은 배정된 분반 교실", "아직 가입하지 않은 학생도 가입 즉시 자동 배정"],
  },
  {
    icon: <Smartphone className="h-4 w-4" />, title: "앱이 출석을 확인해요",
    desc: "수업 5분 전부터 학생 앱이 위치를 측정해 수업 교실 안에 있는지 확인해요.",
    points: ["벽 바깥 2m까지는 GPS 오차로 보고 인정", "정확도가 30m보다 나쁘면 판정하지 않고 다시 측정", "위치 확인이 어려우면 교실 화면의 QR로 출석"],
  },
  {
    icon: <BellRing className="h-4 w-4" />, title: "담당 선생님께 전달돼요",
    desc: "본반 수업은 담임 선생님께, 이동수업은 그 수업 선생님께 출결이 모이고 알림이 가요.",
    points: ["지각·QR 출석은 즉시 알림", "조회·종례 시간에 학급 출석 현황 알림", "수동 처리는 사유와 함께 이력으로 보관"],
  },
];

function StepVisual({ index }: { index: number }) {
  const reduce = useReducedMotion();
  const pulse = !reduce && <motion.circle cx="0" cy="0" fill="rgba(43,87,147,.25)" initial={{ r: 8, opacity: 0.9 }} animate={{ r: [8, 26], opacity: [0.9, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }} />;
  switch (index) {
    case 0:
      return (
        <div className="w-full space-y-2.5">
          <div className="flex items-center justify-between text-[12px] font-semibold text-ink-400"><span>3학년 2반 · 이번 주</span><span className="rounded-full bg-mint-50 px-2 py-0.5 text-mint-600">컴시간 연동</span></div>
          <div className="grid grid-cols-[34px_repeat(5,1fr)] gap-1.5 text-center text-[11px] font-semibold text-ink-400">
            <span />{["월", "화", "수", "목", "금"].map((d) => <span key={d}>{d}</span>)}
            {[["언매", "영독", "확통", "화작", "사문"], ["음연", "여지", "화작", "윤사", "음연"], ["세문", "언매", "확통", "세문", "스생"], ["윤사", "스생", "사문", "영독", "사문"]].map((row, r) => (
              <FragmentRow key={r} per={r + 1} row={row} />
            ))}
          </div>
        </div>
      );
    case 1:
      return (
        <svg viewBox="0 0 360 230" className="w-full" fill="none" aria-hidden>
          <motion.path d="M20 30 L300 18 L340 120 L320 210 L40 214 Z" stroke="#91AFD4" strokeWidth="2" strokeDasharray="6 6" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease }} />
          <g stroke="#BCCFE6" strokeWidth="1.5" fill="#fff">
            {[[40, 40], [110, 40], [180, 40], [250, 40]].map(([x, y], i) => <motion.rect key={i} x={x} y={y} width="64" height="70" rx="6" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.08 }} />)}
            {[[60, 130], [150, 130], [240, 130]].map(([x, y], i) => <motion.rect key={i} x={x} y={y} width="84" height="64" rx="6" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 + i * 0.08 }} />)}
          </g>
          <motion.rect x="180" y="40" width="64" height="70" rx="6" fill="rgba(43,87,147,.12)" stroke="#2B5793" strokeWidth="2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} />
          <text x="212" y="80" textAnchor="middle" fontSize="12" fontWeight="700" fill="#1F406D">3-2</text>
          <text x="22" y="228" fontSize="11" fill="#9CA3AF">건물 외곽(VWorld)에 맞춘 교실 영역</text>
        </svg>
      );
    case 2:
      return (
        <div className="w-full space-y-2.5">
          {[["1교시", "언어와매체", "3-2 (본반)", "brand"], ["2교시", "음악연주", "3-8 이동", "teal"], ["3교시", "화법과작문", "3-1 이동", "teal"], ["4교시", "윤리와사상", "3-2 (본반)", "brand"]].map(([p, s, room, tone], i) => (
            <motion.div key={p} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08, duration: 0.4, ease }}
              className="flex items-center gap-3 rounded-2xl bg-white p-3.5 ring-1 ring-ink-200/80">
              <span className="w-12 shrink-0 text-[12px] font-bold text-ink-400">{p}</span>
              <span className="flex-1 text-[14px] font-bold text-ink-900">{s}</span>
              <span className={clsx("rounded-full px-2.5 py-1 text-[12px] font-bold", tone === "brand" ? "bg-brand-50 text-brand-600" : "bg-teal-50 text-teal-700")}>{room}</span>
            </motion.div>
          ))}
        </div>
      );
    case 3:
      return (
        <div className="relative mx-auto w-[220px] rounded-[34px] bg-ink-950 p-2.5 shadow-[0_30px_60px_-30px_rgba(20,41,68,.6)]">
          <div className="overflow-hidden rounded-[26px] bg-white">
            <div className="px-4 pb-3 pt-5 text-center">
              <div className="text-[11px] font-semibold text-ink-400">3교시 · 화법과작문</div>
              <div className="mt-0.5 text-[15px] font-extrabold text-ink-950">3-1 교실</div>
            </div>
            <svg viewBox="0 0 200 130" className="w-full bg-ink-50" aria-hidden>
              <g stroke="#BCCFE6" strokeWidth="1.5" fill="#fff"><rect x="20" y="20" width="70" height="90" rx="6" /><rect x="110" y="20" width="70" height="90" rx="6" /></g>
              <rect x="110" y="20" width="70" height="90" rx="6" fill="rgba(43,87,147,.10)" stroke="#2B5793" strokeWidth="2" />
              <g transform="translate(145 65)">{pulse}<circle r="7" fill="#2B5793" /><circle r="2.6" fill="#fff" /></g>
            </svg>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
              className="m-3 flex items-center justify-center gap-1.5 rounded-xl bg-mint-50 py-2.5 text-[13px] font-bold text-mint-600">
              <Check className="h-4 w-4" strokeWidth={3} />출석 확인됐어요
            </motion.div>
          </div>
        </div>
      );
    default:
      return (
        <div className="w-full space-y-3">
          {[["담임 선생님", "본반 수업 출결 · 조회/종례 현황", "brand"], ["이동수업 선생님", "3-1 화법과작문 · 지각 알림", "teal"]].map(([who, what, tone], i) => (
            <motion.div key={who} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 * i, duration: 0.45, ease }}
              className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200/80">
              <span className={clsx("grid h-10 w-10 shrink-0 place-items-center rounded-xl", tone === "brand" ? "bg-brand-500 text-white" : "bg-teal-500 text-white")}><BellRing className="h-5 w-5" /></span>
              <div className="min-w-0"><div className="text-[14px] font-bold text-ink-900">{who}</div><div className="truncate text-[12.5px] text-ink-500">{what}</div></div>
            </motion.div>
          ))}
        </div>
      );
  }
}

function FragmentRow({ per, row }: { per: number; row: string[] }) {
  return (
    <>
      <span className="grid place-items-center rounded-lg bg-ink-100 py-2 text-ink-500">{per}</span>
      {row.map((s, c) => (
        <motion.span key={c} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: (per - 1) * 0.06 + c * 0.03 }}
          className={clsx("rounded-lg py-2 text-[11.5px] font-bold", (per + c) % 3 === 0 ? "bg-teal-50 text-teal-700" : "bg-brand-50 text-brand-700")}>{s}</motion.span>
      ))}
    </>
  );
}

function Step({ index, active, onActive }: { index: number; active: boolean; onActive: (i: number) => void }) {
  const ref = useRef<HTMLLIElement>(null);
  const inView = useInView(ref, { margin: "-45% 0px -45% 0px" });
  useEffect(() => { if (inView) onActive(index); }, [inView, index, onActive]);
  const s = STEPS[index];
  return (
    <li ref={ref} className="lg:flex lg:min-h-[62vh] lg:items-center">
      <div className={clsx("w-full rounded-[28px] p-6 transition-all duration-500 sm:p-8 lg:p-0", active ? "lg:opacity-100" : "lg:opacity-35")}>
        <div className="flex items-center gap-3">
          <span className={clsx("grid h-10 w-10 place-items-center rounded-xl transition-colors", active ? "bg-brand-500 text-white" : "bg-brand-500 text-white lg:bg-ink-100 lg:text-ink-500")}>{s.icon}</span>
          <span className="text-[13px] font-bold tabular-nums text-ink-400">STEP {index + 1}</span>
        </div>
        <h3 className="mt-5 text-[24px] font-extrabold leading-tight tracking-[-0.03em] text-ink-950 sm:text-[28px]">{s.title}</h3>
        <p className="mt-3 text-[15.5px] leading-7 text-ink-500">{s.desc}</p>
        <ul className="mt-5 space-y-2.5">
          {s.points.map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-[14.5px] text-ink-700">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-500"><Check className="h-3 w-3" strokeWidth={3} /></span>{p}
            </li>
          ))}
        </ul>
        {/* 모바일: 단계 아래에 바로 그림 */}
        <div className="mt-7 rounded-[24px] bg-ink-50 p-5 ring-1 ring-ink-200/70 lg:hidden"><StepVisual index={index} /></div>
      </div>
    </li>
  );
}

export default function HowItWorks() {
  const [active, setActive] = useState(0);
  return (
    <section id="how" className="scroll-mt-24 px-4 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto max-w-6xl">
        <SectionHead index="01" eyebrow="작동 방식" title={<>학교 설정부터 출석 확인까지,<br className="hidden sm:block" /> 이렇게 이어져요</>}
          desc="관리자가 한 번 설정해 두면, 그다음부터는 매 교시 자동으로 돌아가요." />
        <div className="mt-16 grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          <ol className="space-y-6 lg:space-y-0">
            {STEPS.map((_, i) => <Step key={i} index={i} active={active === i} onActive={setActive} />)}
          </ol>
          <div className="relative hidden lg:block">
            <div className="sticky top-28">
              <div className="relative overflow-hidden rounded-[32px] bg-ink-50 p-8 ring-1 ring-ink-200/70">
                <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl" />
                <div className="mb-6 flex items-center gap-1.5">
                  {STEPS.map((_, i) => <span key={i} className={clsx("h-1.5 rounded-full transition-all duration-500", i === active ? "w-8 bg-brand-500" : "w-1.5 bg-ink-300")} />)}
                  <span className="ml-auto flex items-center gap-1.5 text-[12px] font-semibold text-ink-400"><MapPin className="h-3.5 w-3.5" />예시 화면</span>
                </div>
                <div className="relative flex min-h-[340px] items-center">
                  <AnimatePresence mode="wait">
                    <motion.div key={active} className="w-full" initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.98 }} transition={{ duration: 0.4, ease }}>
                      <StepVisual index={active} />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
