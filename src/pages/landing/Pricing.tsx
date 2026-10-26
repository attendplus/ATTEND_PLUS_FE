import { motion } from "framer-motion";
import { ArrowRight, FlaskConical } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PlanCard from "@/billing/PlanCard";
import { fetchPlans, planOf, type CycleId, type Plans, type ServiceId } from "@/billing/subscription";
import { reveal, SectionHead, stagger } from "./shared";

// *
// 랜딩 요금 안내 — 요금제 2개(QR 출결 / QR + GPS 출결), 카드마다 월간·연간 선택
// 금액은 로그인 없이 GET /billing/plans(서버 공통 요금제 설정)에서 받아 요금제 · 결제 화면과 같은 값을 씁니다.
// *
export default function Pricing() {
  const [plans, setPlans] = useState<Plans | null>(null);
  const [failed, setFailed] = useState(false);
  const [cycles, setCycles] = useState<Record<ServiceId, CycleId>>({ QR: "YEARLY", QR_GPS: "YEARLY" });
  useEffect(() => { fetchPlans().then(setPlans).catch(() => setFailed(true)); }, []);
  const gpsExtras = planOf(plans, "QR_GPS")?.extraFeatures ?? [];

  return (
    <section id="pricing" className="scroll-mt-24 bg-ink-50/60 px-4 py-24 sm:px-6 lg:py-32">
      <div className="mx-auto max-w-5xl">
        <SectionHead index="06" eyebrow="요금제" title="학교 단위로, 필요한 출결 방식만"
          desc={`교사·학생 수와 관계없이 학교 1곳당 하나의 구독이에요. 연간 구독은 ${plans?.yearlyDiscountRate ?? 30}% 할인돼요.`} />

        {plans ? (
          <motion.div variants={stagger(0.1)} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} className="mt-12 grid gap-5 md:grid-cols-2">
            {plans.services.map((p) => (
              <motion.div key={p.id} variants={reveal}>
                <PlanCard plan={p} cycle={cycles[p.id]} highlight={p.id === "QR_GPS"} missing={p.id === "QR" ? gpsExtras : []}
                  onCycle={(c) => setCycles((s) => ({ ...s, [p.id]: c }))}>
                  <Link to={`/signup?role=SCHOOL_ADMIN`}
                    className={p.id === "QR_GPS"
                      ? "group flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-3.5 text-[14.5px] font-bold text-white transition hover:bg-brand-600"
                      : "group flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 text-[14.5px] font-bold text-ink-800 ring-1 ring-ink-200 transition hover:bg-ink-50"}>
                    학교 관리자로 시작하기<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </PlanCard>
              </motion.div>
            ))}
          </motion.div>
        ) : failed ? (
          <p className="mt-12 rounded-2xl bg-white p-6 text-center text-[14px] text-ink-500 ring-1 ring-ink-200/70">요금 정보를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.</p>
        ) : (
          <div className="mt-12 grid gap-5 md:grid-cols-2" aria-hidden>{[0, 1].map((i) => <div key={i} className="h-[560px] animate-pulse rounded-[24px] bg-white ring-1 ring-ink-200/70" />)}</div>
        )}

        <div className="mx-auto mt-8 max-w-3xl space-y-2 text-center text-[13.5px] leading-6 text-ink-500">
          <p>학교 관리자가 가입한 뒤 <b className="text-ink-700">요금제 · 결제</b> 메뉴에서 구독을 시작하면 그 학교의 관리자·교사·학생 기능이 함께 열려요.</p>
          <p className="inline-flex items-start gap-1.5 rounded-full bg-amber-50 px-3.5 py-1.5 text-[12.5px] text-amber-800 ring-1 ring-amber-500/25">
            <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />현재 결제는 데모로만 진행돼요 · 실제 결제·청구·영수증 발급은 일어나지 않아요
          </p>
        </div>
      </div>
    </section>
  );
}
