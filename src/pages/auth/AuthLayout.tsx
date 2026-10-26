import { motion } from "framer-motion";
import { BellRing, LockKeyhole, MapPin, QrCode, Shuffle } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/layout/AppShell";

// 인증 화면 왼쪽 소개 패널: 서비스가 하는 일만 설명합니다. (임의의 숫자·예시 통계는 보여주지 않음)
// 흰 배경 위에 메인 색(#2B5793) 포인트, 기능은 같은 높이의 2×2 카드로 정렬합니다.
const FEATURES: { icon: ReactNode; title: string; desc: string }[] = [
  { icon: <MapPin className="h-[18px] w-[18px]" />, title: "교실 위치로 자동 출석", desc: "수업이 시작되면 앱이 교실 안에 있는지 확인해요." },
  { icon: <QrCode className="h-[18px] w-[18px]" />, title: "교시별 QR 출석", desc: "위치 확인이 어려우면 교실 화면의 QR로 출석해요." },
  { icon: <Shuffle className="h-[18px] w-[18px]" />, title: "이동수업까지 반영", desc: "배정표로 학생마다 가야 할 교실을 판단해요." },
  { icon: <BellRing className="h-[18px] w-[18px]" />, title: "담당 선생님께 전달", desc: "본반은 담임, 이동수업은 수업 선생님께 알려요." },
];

// 배치도 위 교실 하나에 위치 핀이 잡히는 모습을 단순화한 그림 (실제 데이터 아님)
function FloorPlanArt() {
  return (
    <svg viewBox="0 0 480 120" className="h-auto w-full" fill="none" aria-hidden>
      <g stroke="#BCCFE6" strokeWidth="1.5">
        <rect x="2" y="2" width="476" height="116" rx="12" fill="#fff" />
        <path d="M2 64h476M98 2v62M194 2v62M290 2v62M386 2v62M150 64v54M262 64v54M370 64v54" />
      </g>
      <rect x="194.75" y="2.75" width="94.5" height="60.5" fill="rgba(43,87,147,.10)" stroke="#2B5793" strokeWidth="1.5" />
      <motion.circle cx="242" cy="33" fill="rgba(43,87,147,.25)" initial={{ r: 8, opacity: 0.8 }} animate={{ r: [8, 24], opacity: [0.8, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }} />
      <circle cx="242" cy="33" r="7" fill="#2B5793" />
      <circle cx="242" cy="33" r="2.8" fill="#fff" />
      <text x="242" y="92" textAnchor="middle" fontSize="12" fontWeight="600" fill="#2B5793">수업 교실 안 · 출석</text>
    </svg>
  );
}

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden border-r border-ink-200/70 bg-white lg:block">
      <div className="relative flex min-h-screen flex-col px-12 py-10 xl:px-16">
        <Link to="/" aria-label="출결플러스 소개로" className="w-fit"><Logo /></Link>

        <div className="my-auto w-full max-w-[540px] py-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-[12px] font-semibold text-brand-600">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />학교 출결 플랫폼
          </span>
          <h2 className="mt-5 text-[38px] font-extrabold leading-[1.2] tracking-[-0.03em] text-ink-950 xl:text-[42px]">
            스마트폰 하나로<br /><span className="text-brand-500">끝나는 학교 출결</span>
          </h2>
          <p className="mt-4 max-w-[460px] text-[15px] leading-7 text-ink-500">교실 배치도와 시간표로 학생마다 수업 교실을 판단하고, 출결을 담당 선생님께 자동으로 전달합니다.</p>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="mt-8 rounded-2xl bg-ink-50 p-3 ring-1 ring-ink-200/70">
            <FloorPlanArt />
          </motion.div>

          <ul className="mt-3 grid grid-cols-2 gap-3">
            {FEATURES.map((f, i) => (
              <motion.li key={f.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.05 }}
                className="flex items-start gap-3 rounded-2xl bg-white p-4 ring-1 ring-ink-200/80 transition hover:ring-brand-200">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-500">{f.icon}</span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-bold leading-5 text-ink-900">{f.title}</span>
                  <span className="mt-1 block text-[12.5px] leading-5 text-ink-500">{f.desc}</span>
                </span>
              </motion.li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-2 text-[12px] text-ink-400">
          <LockKeyhole className="h-3.5 w-3.5 shrink-0" />로그인 정보는 암호화된 쿠키로만 보관되며, 개인정보는 암호화해 저장합니다.
        </div>
      </div>
    </aside>
  );
}

// *
// 로그인·회원가입·비밀번호 찾기 공용 레이아웃
// 데스크톱: 왼쪽 흰색 소개 패널 + 오른쪽 입력 카드 / 모바일: 로고 + 입력 카드 (가로 여백 16px 이상)
// *
export default function AuthLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="grid min-h-screen bg-ink-50 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <BrandPanel />
      <div className="flex min-h-screen flex-col px-4 py-6 sm:px-10">
        <Link to="/" aria-label="출결플러스 소개로" className="w-fit lg:hidden"><Logo /></Link>
        <div className="flex flex-1 items-center justify-center py-6">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 200, damping: 24 }}
            className={`w-full ${wide ? "max-w-[520px]" : "max-w-[440px]"} rounded-3xl bg-white p-6 shadow-[0_24px_60px_-32px_rgba(20,41,68,.35)] ring-1 ring-ink-200/70 sm:p-8`}>
            {children}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
