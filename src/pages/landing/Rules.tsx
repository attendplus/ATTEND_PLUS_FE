import { motion } from "framer-motion";
import clsx from "clsx";
import { CalendarX2, Clock, Crosshair, FileLock2, KeyRound, LockKeyhole, QrCode, School, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { ease, reveal, SectionHead, stagger } from "./shared";

// *
// 출석 판정 기준 (서버 period_service·geo 설정과 같은 값)
// - 수업 시작 5분 전부터 측정 준비, 시작 후 3분까지 확인 → 출석, 3분 초과~10분 → 지각
// - 10분이 지나도 확인되지 않으면 결석으로 자동 확정하지 않고 '보류' → 담당 선생님이 확인
// - QR은 시작 후 10분 이내 출석, 이후 교시가 끝나기 전까지 지각으로 인정, 특별 일정이 있는 교시는 출결을 확인하지 않음
// *
const PHASES: { label: string; time: string; desc: string; tone: string; grow: number }[] = [
  { label: "준비", time: "-5분", desc: "앱이 위치 측정을 준비해요", tone: "bg-ink-200", grow: 5 },
  { label: "출석", time: "0~3분", desc: "교실 안이 확인되면 출석", tone: "bg-mint-500", grow: 3 },
  { label: "지각", time: "3~10분", desc: "이때 확인되면 지각", tone: "bg-amber-500", grow: 7 },
  { label: "보류", time: "10분~", desc: "자동 결석 없이 선생님이 확인", tone: "bg-ink-400", grow: 12 },
];

const RULES: { icon: ReactNode; title: string; desc: string }[] = [
  { icon: <Crosshair className="h-4 w-4" />, title: "벽 바깥 2m까지 인정", desc: "GPS 오차를 감안해 교실 경계 바깥 2m 이내는 교실 안으로 봐요." },
  { icon: <Clock className="h-4 w-4" />, title: "정확도가 낮으면 다시 측정", desc: "위치 정확도가 30m보다 나쁘면 판정하지 않고 다시 측정해요." },
  { icon: <QrCode className="h-4 w-4" />, title: "QR은 교시 끝까지", desc: "위치 확인이 어려운 교실은 QR로 — 시작 10분 안이면 출석, 이후 교시가 끝나기 전까지는 지각이에요." },
  { icon: <CalendarX2 className="h-4 w-4" />, title: "특별 일정은 제외", desc: "면담·행사처럼 특별 일정이 등록된 교시는 출결을 확인하지 않아요." },
];

export function Rules() {
  const total = PHASES.reduce((n, p) => n + p.grow, 0);
  return (
    <section id="rules" className="scroll-mt-24 bg-ink-50 px-4 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto max-w-6xl">
        <SectionHead index="03" eyebrow="판정 기준" title="출석·지각·보류는 이렇게 정해져요"
          desc="모든 반에 같은 기준이 적용돼요. 확인되지 않은 학생을 결석으로 자동 처리하지 않고, 담당 선생님이 최종 확인해요." />

        {/* 수업 시작 기준 타임라인 */}
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.7, ease }}
          className="mt-14 rounded-[32px] bg-white p-6 ring-1 ring-ink-200/70 sm:p-10">
          <div className="mb-5 flex items-center justify-between text-[13px] font-semibold text-ink-500">
            <span>수업 시작 기준</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand-500" />수업 시작</span>
          </div>
          <div className="relative flex h-4 w-full overflow-hidden rounded-full bg-ink-100">
            {PHASES.map((p, i) => (
              <motion.div key={p.label} className={clsx("h-full origin-left", p.tone)} style={{ width: `${(p.grow / total) * 100}%` }}
                initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.25, duration: 0.6, ease }} />
            ))}
            <span className="absolute inset-y-0 w-0.5 bg-brand-600" style={{ left: `${(PHASES[0].grow / total) * 100}%` }} />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {PHASES.map((p) => (
              <div key={p.label}>
                <div className="flex items-center gap-2"><span className={clsx("h-2.5 w-2.5 rounded-full", p.tone)} /><span className="text-[15px] font-extrabold text-ink-950">{p.label}</span><span className="text-[12.5px] font-semibold tabular-nums text-ink-400">{p.time}</span></div>
                <p className="mt-1.5 text-[13.5px] leading-6 text-ink-500">{p.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div variants={stagger(0.06)} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {RULES.map((r) => (
            <motion.div key={r.title} variants={reveal} className="rounded-[24px] bg-white p-6 ring-1 ring-ink-200/70">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-500">{r.icon}</span>
              <h3 className="mt-4 text-[16px] font-bold text-ink-950">{r.title}</h3>
              <p className="mt-1.5 text-[13.5px] leading-6 text-ink-500">{r.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// *
// 보안·개인정보 (실제 구현과 같은 내용)
// AES-256-GCM 암호화 + 이메일 HMAC 색인, HttpOnly 쿠키 + 요청 헤더 확인(CSRF), 학교 단위 권한, bcrypt + 로그인 시도 제한
// *
const SECURITY: { icon: ReactNode; title: string; desc: string }[] = [
  { icon: <FileLock2 className="h-5 w-5" />, title: "개인정보 암호화 저장", desc: "이름·이메일·출결 사유·알림, 학생 명단 파일과 프로필 사진까지 AES-256으로 암호화해 저장해요." },
  { icon: <KeyRound className="h-5 w-5" />, title: "HttpOnly 쿠키 로그인", desc: "로그인 토큰은 스크립트가 읽을 수 없는 쿠키로만 주고받고, 요청 헤더를 확인해 위조 요청을 막아요." },
  { icon: <School className="h-5 w-5" />, title: "학교 단위 접근 권한", desc: "다른 학교의 학생·출결·업로드 파일은 볼 수 없고, 역할마다 쓸 수 있는 기능이 나뉘어 있어요." },
  { icon: <ShieldCheck className="h-5 w-5" />, title: "안전한 비밀번호", desc: "비밀번호는 bcrypt로만 저장하고, 로그인·인증번호 요청 횟수를 제한해 무차별 대입을 막아요." },
];

export function Security() {
  return (
    <section id="security" className="scroll-mt-24 relative overflow-hidden bg-ink-950 px-4 py-24 text-white sm:px-6 lg:py-32">
      <div className="pointer-events-none absolute -left-40 top-0 h-[420px] w-[420px] rounded-full bg-brand-500/25 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-[420px] w-[420px] rounded-full bg-teal-500/15 blur-[120px]" />
      <div className="relative mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <SectionHead index="05" eyebrow="보안 · 개인정보" dark align="left" title={<>학생 정보는<br />학교 안에서만, 안전하게</>}
            desc="출결과 위치는 민감한 정보예요. 저장부터 전송, 접근 권한까지 단계마다 보호해요." />
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.3 }}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-[13px] font-semibold text-white/70 ring-1 ring-white/10">
            <LockKeyhole className="h-4 w-4 text-brand-200" />운영 환경은 암호화 키와 보안 쿠키 설정 없이는 서버가 시작되지 않아요
          </motion.div>
        </div>
        <motion.div variants={stagger(0.08)} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} className="grid gap-4 sm:grid-cols-2">
          {SECURITY.map((s) => (
            <motion.div key={s.title} variants={reveal} whileHover={{ y: -4 }} className="rounded-[24px] bg-white/[0.04] p-6 ring-1 ring-white/10 transition-colors hover:bg-white/[0.07]">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-brand-200">{s.icon}</span>
              <h3 className="mt-5 text-[17px] font-bold">{s.title}</h3>
              <p className="mt-2 text-[14px] leading-6 text-white/60">{s.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
