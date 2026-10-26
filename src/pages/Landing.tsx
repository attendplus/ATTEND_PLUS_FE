import { AnimatePresence, motion, MotionConfig, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import clsx from "clsx";
import {
  ArrowRight, BellRing, Building2, CalendarDays, Check, ChevronDown, GraduationCap, LockKeyhole, MapPin, QrCode, Shuffle, Sparkles, UserRound,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import SiteFooter from "@/components/SiteFooter";
import HowItWorks from "./landing/HowItWorks";
import Pricing from "./landing/Pricing";
import { Rules, Security } from "./landing/Rules";
import { ease, reveal, SectionHead, stagger } from "./landing/shared";

// *
// 랜딩 페이지 (로그인 전 첫 화면 "/", 로그아웃하면 이곳으로 돌아옵니다)
// - 서비스 소개만 담고, 실제 학교·학생 데이터나 임의의 숫자(가짜 통계)는 보여주지 않습니다. 그림 속 화면은 형태만 표현한 추상 그림입니다.
// - 로그인 → /login, 회원가입 → /signup (역할 탭에서 누르면 ?role=로 가입 유형을 미리 선택)
// - 성능: 로그인 후 화면(차트·QR)과 코드가 분리되어 있고, 애니메이션은 transform·opacity만 사용합니다.
//   흐르는 띠(marquee)는 CSS 애니메이션이며, 기기의 '동작 줄이기' 설정을 켜면 움직임을 멈춥니다.
// *


const INTEGRATIONS = ["컴시간 알리미 시간표 자동 연동", "NEIS 학교 정보", "VWorld 건물 외곽 정합", "교실 배치도 PDF 분석", "학년별 이동수업 배정 엑셀", "HttpOnly 쿠키 로그인", "개인정보 AES-256 암호화"];

const ROLE_TABS = [
  {
    key: "SCHOOL_ADMIN", label: "학교 관리자", icon: <Building2 className="h-4 w-4" />, cta: "학교 관리자로 시작하기",
    headline: "학교 설정은 한 번만, 나머지는 자동으로",
    points: ["학교를 등록하면 컴시간 시간표와 교시표가 자동으로 연동돼요.", "교실 배치도 PDF를 올리면 층·교실 영역을 인식해 건물에 맞춰요.", "학년별 이동수업 엑셀로 학생마다 수업 교실을 정해요.", "학급을 만들면 선생님이 '학급 들어가기'로 담임을 맡아요."],
  },
  {
    key: "TEACHER", label: "선생님", icon: <GraduationCap className="h-4 w-4" />, cta: "선생님으로 시작하기",
    headline: "담임반과 이동수업 반을 한 화면에서",
    points: ["담임반과 내가 수업하는 이동수업 반을 주 단위로 확인해요.", "교시마다 반별 QR을 띄우면 그 교실 학생만 출석할 수 있어요.", "지각·QR 출석 알림이 담당 선생님께 바로 와요.", "수동 처리는 사유와 함께 이력으로 남아요."],
  },
  {
    key: "STUDENT", label: "학생", icon: <UserRound className="h-4 w-4" />, cta: "학생으로 시작하기",
    headline: "가야 할 교실과 출석 상태를 바로",
    points: ["오늘 수업과 이동수업 교실을 한눈에 봐요.", "수업이 시작되면 앱이 교실 위치로 출석을 확인해요.", "위치 확인이 어려우면 교실 화면의 QR로 출석해요.", "이번 주·다음 주 시간표와 출결 기록을 볼 수 있어요."],
  },
] as const;

const FAQ = [
  { q: "시간표는 어디서 가져오나요?", a: "학교를 등록하면 컴시간 알리미에서 학급별 시간표와 교시 시각을 자동으로 가져와요. 학급을 만들거나 선생님이 가입하면 바로 다시 연동되고, 이후 12시간마다 갱신돼요." },
  { q: "이동수업은 어떻게 판단하나요?", a: "관리자가 학년별 이동수업 배정 엑셀을 올리면, 컴시간 시간표의 과목과 합쳐 교시마다 학생이 가야 할 교실과 담당 선생님을 정해요." },
  { q: "학생은 어떻게 가입하나요?", a: "담임 선생님이 알려준 학급 코드로 가입 요청을 하거나, 선생님이 학번으로 임시 계정을 만들어 줄 수 있어요. 임시 계정도 나중에 이메일을 추가할 수 있어요." },
  { q: "GPS가 잘 잡히지 않으면 어떻게 하나요?", a: "위치 정확도가 30m보다 나쁘면 판정하지 않고 다시 측정해요. 그래도 확인이 어려우면 선생님이 띄운 교실 QR로 출석하면 되고, 확인되지 않은 학생은 결석이 아니라 '보류'로 남아 선생님이 확인해요." },
  { q: "행사나 면담이 있는 시간은요?", a: "선생님이나 관리자가 특별 일정(학생·학급·학년·학교 단위)을 등록하면 그 교시는 출결을 확인하지 않아요." },
  { q: "비밀번호를 잊어버렸어요.", a: "로그인 화면의 '비밀번호 찾기'나 내 정보의 '비밀번호 찾기'에서 이메일 인증 후 다시 설정할 수 있어요. 학번 임시 계정은 담임 선생님께 요청해 주세요." },
];

/* ───────── 히어로의 앱 화면 그림 (형태만 표현, 실제 데이터 아님) ───────── */
const CELL_TONES = ["bg-mint-500/80", "bg-mint-500/80", "bg-mint-500/80", "bg-amber-500/70", "bg-mint-500/80", "bg-ink-200", "bg-sky-500/70", "bg-mint-500/80"];
function AppPreview() {
  const reduce = useReducedMotion();
  return (
    <div className="overflow-hidden rounded-[22px] bg-white ring-1 ring-ink-200/80">
      <div className="flex items-center gap-1.5 border-b border-ink-100 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" /><span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" /><span className="h-2.5 w-2.5 rounded-full bg-mint-500/70" />
        <span className="ml-3 h-5 flex-1 rounded-md bg-ink-50" />
      </div>
      <div className="grid sm:grid-cols-[150px_1fr]">
        <div className="hidden space-y-2 border-r border-ink-100 p-4 sm:block">
          <div className="mb-4 flex items-center gap-2"><img src="/logo-160.png" alt="" className="h-6 w-6" width={24} height={24} /><span className="h-3 w-16 rounded bg-ink-200" /></div>
          {[1, 0, 0, 0, 0, 0].map((on, i) => (
            <div key={i} className={clsx("flex items-center gap-2 rounded-lg px-2 py-1.5", on && "bg-brand-50")}>
              <span className={clsx("h-3 w-3 rounded", on ? "bg-brand-500" : "bg-ink-200")} /><span className={clsx("h-2.5 rounded", on ? "w-16 bg-brand-200" : "w-14 bg-ink-100")} />
            </div>
          ))}
        </div>
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div><div className="h-3 w-20 rounded bg-ink-200" /><div className="mt-2 h-5 w-32 rounded bg-ink-900/80" /></div>
            <div className="flex gap-1.5"><span className="h-7 w-20 rounded-lg bg-ink-100" /><span className="h-7 w-16 rounded-lg bg-brand-500" /></div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className={clsx("rounded-xl p-2.5 ring-1 ring-ink-100", i === 0 ? "bg-brand-500" : "bg-white")}>
                <div className={clsx("h-2.5 w-3/4 rounded", i === 0 ? "bg-white/70" : "bg-ink-200")} /><div className={clsx("mt-1.5 h-2 w-1/2 rounded", i === 0 ? "bg-white/40" : "bg-teal-50")} />
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {Array.from({ length: 4 }).map((_, r) => (
              <div key={r} className="flex items-center gap-2">
                <span className="h-2.5 w-12 shrink-0 rounded bg-ink-200" />
                <div className="grid flex-1 grid-cols-8 gap-1.5">
                  {CELL_TONES.map((_, c) => (
                    <motion.span key={c} className={clsx("h-5 rounded-md", CELL_TONES[(c + r * 3) % CELL_TONES.length])}
                      initial={reduce ? false : { opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 + (r * 8 + c) * 0.015, duration: 0.3 }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── 벤토 타일 속 작은 그림들 ───────── */
function FloorArt() {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 320 150" className="w-full" fill="none" aria-hidden>
      <g stroke="#BCCFE6" strokeWidth="1.5"><rect x="2" y="2" width="316" height="146" rx="14" fill="#fff" /><path d="M2 76h316M66 2v74M130 2v74M194 2v74M258 2v74M98 76v72M180 76v72M250 76v72" /></g>
      <rect x="130.75" y="2.75" width="62.5" height="72.5" fill="rgba(43,87,147,.10)" stroke="#2B5793" strokeWidth="1.5" />
      {!reduce && <motion.circle cx="162" cy="39" fill="rgba(43,87,147,.25)" initial={{ r: 8, opacity: 0.9 }} animate={{ r: [8, 30], opacity: [0.9, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }} />}
      <circle cx="162" cy="39" r="8" fill="#2B5793" /><circle cx="162" cy="39" r="3" fill="#fff" />
    </svg>
  );
}
function QrArt() {
  const cells = [1,1,1,0,1,0,1,1,1, 1,0,1,0,0,1,1,0,1, 1,1,1,1,0,1,1,1,1, 0,0,0,1,1,0,0,1,0, 1,0,1,1,0,1,1,0,0, 0,1,0,0,1,0,1,1,1, 1,1,1,0,0,1,0,1,0, 1,0,1,1,1,0,1,0,1, 1,1,1,0,1,1,0,1,1];
  return (
    <div className="grid w-28 grid-cols-9 gap-[3px] rounded-2xl bg-white p-3 ring-1 ring-ink-200/80">
      {cells.map((on, i) => <motion.span key={i} className={clsx("aspect-square rounded-[2px]", on ? "bg-ink-950" : "bg-transparent")}
        initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: (i % 9) * 0.03 + Math.floor(i / 9) * 0.03 }} />)}
    </div>
  );
}
function AlertArt() {
  return (
    <div className="relative h-[108px]">
      {[2, 1, 0].map((i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1 - i * 0.28, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 * (2 - i), duration: 0.5, ease }}
          style={{ top: i * 12, scale: 1 - i * 0.05 }} className="absolute inset-x-0 flex items-center gap-2.5 rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-ink-200/80">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600"><BellRing className="h-3.5 w-3.5" /></span>
          <div className="flex-1"><div className="h-2.5 w-2/3 rounded bg-ink-200" /><div className="mt-1.5 h-2 w-1/2 rounded bg-ink-100" /></div>
        </motion.div>
      ))}
    </div>
  );
}
function RouteArt() {
  const rooms: [string, number][] = [["3-2", 20], ["3-5", 140], ["3-7", 250]];
  return (
    <svg viewBox="0 0 280 90" className="w-full" fill="none" aria-hidden>
      {rooms.map(([label, x]) => (
        <g key={label}><rect x={x - 18} y="30" width="36" height="30" rx="8" fill="#fff" stroke="#BCCFE6" strokeWidth="1.5" /><text x={x} y="50" textAnchor="middle" fontSize="11" fontWeight="700" fill="#1F406D">{label}</text></g>
      ))}
      <motion.path d="M38 45 C 80 10, 100 10, 122 45" stroke="#2B5793" strokeWidth="2" strokeDasharray="4 4" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.9, ease }} />
      <motion.path d="M158 45 C 190 80, 210 80, 232 45" stroke="#0D9488" strokeWidth="2" strokeDasharray="4 4" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ delay: 0.4, duration: 0.9, ease }} />
    </svg>
  );
}

function Bento({ className, icon, title, desc, children }: { className?: string; icon: ReactNode; title: string; desc: string; children?: ReactNode }) {
  return (
    <motion.div variants={reveal} whileHover={{ y: -4 }}
      className={clsx("group relative flex flex-col overflow-hidden rounded-[28px] bg-ink-50 p-6 ring-1 ring-ink-200/70 transition-[box-shadow] duration-300 hover:shadow-[0_24px_60px_-34px_rgba(20,41,68,.45)] sm:p-7", className)}>
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-brand-500 ring-1 ring-ink-200/80">{icon}</span>
        <h3 className="text-[16px] font-bold text-ink-950">{title}</h3>
      </div>
      <p className="mt-2.5 text-[14px] leading-6 text-ink-500">{desc}</p>
      {children && <div className="mt-6 flex flex-1 items-end">{children}</div>}
    </motion.div>
  );
}

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [role, setRole] = useState<(typeof ROLE_TABS)[number]["key"]>("SCHOOL_ADMIN");
  const [open, setOpen] = useState<number | null>(0);
  const { scrollY, scrollYProgress } = useScroll();
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 12));
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });

  // 히어로 앱 화면: 스크롤에 따라 기울어진 화면이 바로 세워집니다.
  const previewRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: previewProgress } = useScroll({ target: previewRef, offset: ["start end", "center center"] });
  const tilt = useTransform(previewProgress, [0, 1], [18, 0]);
  const lift = useTransform(previewProgress, [0, 1], [0.94, 1]);
  const current = ROLE_TABS.find((r) => r.key === role)!;
  // 다른 화면의 푸터에서 /#faq 처럼 들어오면 그 섹션으로 이동합니다.
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    // 다른 페이지에서 넘어온 경우라 애니메이션 없이 바로 그 위치로 이동합니다.
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" }), 120);
    return () => clearTimeout(t);
  }, [hash]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen overflow-x-clip bg-white text-ink-900 selection:bg-brand-100">
        <motion.div style={{ scaleX: progress }} className="fixed inset-x-0 top-0 z-50 h-[3px] origin-left bg-brand-500" aria-hidden />

        {/* 떠 있는 알약 모양 내비게이션 — 스크롤하면 배경·그림자가 생깁니다. */}
        <header className="fixed inset-x-0 top-3 z-40 px-3 sm:top-4">
          <nav className={clsx("mx-auto flex h-14 max-w-5xl items-center justify-between rounded-full pl-3 pr-2 transition-all duration-300 sm:pl-4",
            scrolled ? "bg-white/80 shadow-[0_12px_40px_-20px_rgba(20,41,68,.35)] ring-1 ring-ink-200/70 backdrop-blur-xl" : "bg-transparent")}>
            <Link to="/" className="flex items-center gap-2" aria-label="출결플러스 홈">
              <img src="/logo-160.png" alt="" className="h-8 w-8" width={32} height={32} />
              <span className="text-[16px] font-extrabold tracking-tight">출결플러스</span>
            </Link>
            <div className="hidden items-center gap-1 text-[14px] font-semibold text-ink-600 md:flex">
              {[["#how", "작동 방식"], ["#features", "기능"], ["#rules", "판정 기준"], ["#security", "보안"], ["#pricing", "요금제"], ["#faq", "FAQ"]].map(([href, label]) => (
                <a key={href} href={href} className="rounded-full px-3.5 py-2 transition hover:bg-ink-100 hover:text-ink-900">{label}</a>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <Link to="/login" className="rounded-full px-4 py-2 text-[14px] font-semibold text-ink-700 transition hover:bg-ink-100">로그인</Link>
              <Link to="/signup" className="rounded-full bg-ink-950 px-4 py-2 text-[14px] font-semibold text-white transition hover:bg-brand-600">시작하기</Link>
            </div>
          </nav>
        </header>

        {/* 히어로 */}
        <section className="relative px-4 pt-32 sm:px-6 sm:pt-40">
          <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgba(43,87,147,.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(43,87,147,.06)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_0%,black,transparent)]" />
          <div className="pointer-events-none absolute left-1/2 top-24 h-[420px] w-[820px] max-w-[100vw] -translate-x-1/2 rounded-full bg-brand-500/10 blur-[110px]" />
          <motion.div variants={stagger(0.1)} initial="hidden" animate="show" className="relative mx-auto max-w-4xl text-center">
            <motion.div variants={reveal} className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[13px] font-semibold text-ink-700 shadow-sm ring-1 ring-ink-200/80">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-500 opacity-60 motion-reduce:hidden" /><span className="relative inline-flex h-2 w-2 rounded-full bg-mint-500" /></span>
              컴시간 시간표 · 교실 배치도 연동
            </motion.div>
            <motion.h1 variants={reveal} className="mt-7 text-[42px] font-extrabold leading-[1.08] tracking-[-0.045em] text-ink-950 sm:text-[64px] lg:text-[76px]">
              출결은 자동으로,<br />
              <span className="bg-gradient-to-r from-brand-700 via-brand-500 to-teal-500 bg-clip-text text-transparent">수업에만 집중하세요</span>
            </motion.h1>
            <motion.p variants={reveal} className="mx-auto mt-6 max-w-xl text-[16px] leading-7 text-ink-500 sm:text-[17.5px] sm:leading-8">
              교실 배치도와 시간표로 학생마다 수업 교실을 판단하고, 출결을 담당 선생님께 바로 전달합니다.
            </motion.p>
            <motion.div variants={reveal} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/signup" className="group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-brand-500 px-7 py-4 text-[15.5px] font-bold text-white shadow-[0_18px_40px_-18px_rgba(43,87,147,.8)] transition hover:bg-brand-600 sm:w-auto">
                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                지금 시작하기<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link to="/login" className="inline-flex w-full items-center justify-center rounded-full bg-white px-7 py-4 text-[15.5px] font-bold text-ink-800 ring-1 ring-ink-200 transition hover:bg-ink-50 sm:w-auto">
                로그인
              </Link>
            </motion.div>
            {/* 핵심 판정 기준 한눈에 (서버 설정값과 동일) */}
            <motion.ul variants={reveal} className="mx-auto mt-10 flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13.5px] font-semibold text-ink-500">
              {["시작 3분 안에 확인되면 출석", "10분까지 미확인은 보류", "교실 벽 바깥 2m 오차 보정"].map((t) => (
                <li key={t} className="flex items-center gap-1.5"><Check className="h-4 w-4 text-mint-500" strokeWidth={3} />{t}</li>
              ))}
            </motion.ul>
          </motion.div>

          <div ref={previewRef} className="relative mx-auto mt-16 max-w-5xl [perspective:1400px] sm:mt-20">
            <motion.div style={{ rotateX: tilt, scale: lift }} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.9, ease }}
              className="origin-top rounded-[28px] bg-gradient-to-b from-ink-200/70 to-ink-100/30 p-2 shadow-[0_50px_100px_-50px_rgba(20,41,68,.55)] ring-1 ring-ink-200/60 sm:p-3">
              <AppPreview />
            </motion.div>
          </div>
        </section>

        {/* 연동·보안 띠 (흐르는 텍스트) */}
        <section className="mt-20 border-y border-ink-100 bg-ink-50/60 py-5" aria-label="연동 및 보안">
          <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
            <div className="flex w-max animate-marquee gap-10 motion-reduce:animate-none">
              {[...INTEGRATIONS, ...INTEGRATIONS].map((t, i) => (
                <span key={i} className="flex shrink-0 items-center gap-2 text-[14px] font-semibold text-ink-500"><Sparkles className="h-3.5 w-3.5 text-brand-400" />{t}</span>
              ))}
            </div>
          </div>
        </section>

        <HowItWorks />

        {/* 기능 — 벤토 그리드 */}
        <section id="features" className="scroll-mt-24 px-4 py-24 sm:px-6 lg:py-32">
          <div className="mx-auto max-w-6xl">
            <SectionHead index="02" eyebrow="기능" title={<>출결에 필요한 것만,<br className="sm:hidden" /> 정확하게</>} desc="본반 수업부터 이동수업까지, 학생이 실제로 있어야 할 교실을 기준으로 출결을 판단합니다." />
            <motion.div variants={stagger(0.07)} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} className="mt-14 grid gap-4 md:grid-cols-6">
              <Bento className="md:col-span-4" icon={<MapPin className="h-4 w-4" />} title="교실 위치로 자동 출석" desc="교실 배치도를 실제 건물 외곽에 맞춰 두고, 수업이 시작되면 앱이 학생이 그 교실 안에 있는지 확인해요."><div className="mx-auto w-full max-w-[420px]"><FloorArt /></div></Bento>
              <Bento className="md:col-span-2" icon={<QrCode className="h-4 w-4" />} title="반별 QR 출석" desc="교시마다 담임반·이동수업 반 QR을 띄워요. 교시가 끝나면 자동으로 만료돼요."><div className="flex w-full justify-center"><QrArt /></div></Bento>
              <Bento className="md:col-span-2" icon={<BellRing className="h-4 w-4" />} title="담당 선생님께 바로" desc="본반은 담임, 이동수업은 수업 선생님께 지각·QR 출석이 전달돼요."><div className="w-full"><AlertArt /></div></Bento>
              <Bento className="md:col-span-4" icon={<Shuffle className="h-4 w-4" />} title="이동수업까지 정확하게" desc="컴시간 시간표와 학년별 이동수업 배정표를 합쳐, 교시마다 학생이 가야 할 교실과 담당 선생님을 정해요."><div className="mx-auto w-full max-w-[420px]"><RouteArt /></div></Bento>
              <Bento className="md:col-span-3" icon={<CalendarDays className="h-4 w-4" />} title="주 단위 출결 확인" desc="담임반과 내가 수업하는 반을 골라 한 주 출결을 한 표로 확인하고, 필요하면 사유와 함께 수동 처리해요." />
              <Bento className="md:col-span-3" icon={<LockKeyhole className="h-4 w-4" />} title="개인정보는 암호화" desc="이름·이메일·출결 사유는 암호화해 저장하고, 로그인 정보는 스크립트가 읽을 수 없는 HttpOnly 쿠키로만 다뤄요." />
            </motion.div>
          </div>
        </section>

        <Rules />

        {/* 사용자별 — 탭으로 전환 */}
        <section id="roles" className="scroll-mt-24 px-4 py-24 sm:px-6 lg:py-32">
          <div className="mx-auto max-w-5xl">
            <SectionHead index="04" eyebrow="사용자별" title="역할마다 필요한 화면만" desc="가입할 때 역할을 고르면 그에 맞는 메뉴만 보여요." />
            <div className="mt-12 flex justify-center">
              <div role="tablist" aria-label="사용자 역할" className="inline-flex rounded-full bg-ink-100 p-1">
                {ROLE_TABS.map((r) => (
                  <button key={r.key} type="button" role="tab" aria-selected={role === r.key} onClick={() => setRole(r.key)}
                    className={clsx("relative flex items-center gap-1.5 rounded-full px-3.5 py-2.5 text-[13.5px] font-semibold transition-colors sm:px-5 sm:text-[14px]", role === r.key ? "text-ink-950" : "text-ink-500 hover:text-ink-800")}>
                    {role === r.key && <motion.span layoutId="role-pill" className="absolute inset-0 rounded-full bg-white shadow-sm ring-1 ring-ink-200/70" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                    <span className="relative flex items-center gap-1.5">{r.icon}{r.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-8 rounded-[32px] bg-ink-50 p-6 ring-1 ring-ink-200/70 sm:p-10">
              <AnimatePresence mode="wait">
                <motion.div key={current.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease }}
                  className="grid items-center gap-8 md:grid-cols-[1fr_1.1fr]">
                  <div>
                    <h3 className="text-[24px] font-extrabold leading-tight tracking-[-0.03em] text-ink-950 sm:text-[28px]">{current.headline}</h3>
                    <Link to={`/signup?role=${current.key}`} className="group mt-6 inline-flex items-center gap-2 rounded-full bg-brand-500 px-5 py-3 text-[14.5px] font-bold text-white transition hover:bg-brand-600">
                      {current.cta}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                  <ul className="space-y-3">
                    {current.points.map((p, i) => (
                      <motion.li key={p} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i, duration: 0.35 }}
                        className="flex items-start gap-3 rounded-2xl bg-white p-4 text-[14.5px] leading-6 text-ink-700 ring-1 ring-ink-200/70">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-500 text-white"><Check className="h-3 w-3" strokeWidth={3} /></span>{p}
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </section>

        <Security />

        <Pricing />

        {/* 자주 묻는 질문 */}
        <section id="faq" className="scroll-mt-24 px-4 py-24 sm:px-6 lg:py-32">
          <div className="mx-auto max-w-3xl">
            <SectionHead index="07" eyebrow="자주 묻는 질문" title="궁금한 점이 있나요?" />
            <div className="mt-10 space-y-3">
              {FAQ.map((f, i) => {
                const isOpen = open === i;
                return (
                  <div key={f.q} className={clsx("overflow-hidden rounded-2xl ring-1 transition-colors", isOpen ? "bg-ink-50 ring-ink-200" : "bg-white ring-ink-200/70 hover:bg-ink-50/60")}>
                    <button type="button" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[15.5px] font-bold text-ink-900 sm:px-6">
                      {f.q}<ChevronDown className={clsx("h-5 w-5 shrink-0 text-ink-400 transition-transform duration-300", isOpen && "rotate-180")} />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease }}>
                          <p className="px-5 pb-5 text-[14.5px] leading-7 text-ink-500 sm:px-6">{f.a}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 마지막 행동 유도 */}
        <section className="px-4 py-24 sm:px-6">
          <motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.7, ease }}
            className="relative mx-auto max-w-6xl overflow-hidden rounded-[40px] bg-brand-600 px-6 py-16 text-center text-white sm:px-12 sm:py-20">
            <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-brand-300/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-teal-400/25 blur-3xl" />
            <img src="/logo-160.png" alt="" className="relative mx-auto h-14 w-14" width={56} height={56} loading="lazy" />
            <h2 className="relative mt-6 text-[28px] font-extrabold leading-tight tracking-[-0.035em] sm:text-[40px]">이번 학기 출결, 출결플러스로</h2>
            <p className="relative mx-auto mt-4 max-w-xl text-[15.5px] leading-7 text-white/75">학교 관리자가 먼저 학교를 등록하면, 선생님과 학생은 학교·학급 코드로 바로 가입할 수 있어요.</p>
            <div className="relative mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/signup" className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-7 py-4 text-[15.5px] font-bold text-brand-700 transition hover:bg-brand-50 sm:w-auto">
                회원가입<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link to="/login" className="inline-flex w-full items-center justify-center rounded-full px-7 py-4 text-[15.5px] font-bold text-white ring-1 ring-white/40 transition hover:bg-white/10 sm:w-auto">
                이미 계정이 있어요
              </Link>
            </div>
          </motion.div>
        </section>

        <SiteFooter />
      </div>
    </MotionConfig>
  );
}
