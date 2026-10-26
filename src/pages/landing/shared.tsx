import { motion } from "framer-motion";
import type { ReactNode } from "react";

// 랜딩 공용 애니메이션·제목 컴포넌트
export const ease = [0.22, 1, 0.36, 1] as const;
export const reveal = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease } } };
export const stagger = (gap = 0.08) => ({ hidden: {}, show: { transition: { staggerChildren: gap } } });

// 섹션 제목: "01 · 작동 방식" 같은 번호 표시 + 큰 제목 + 설명
export function SectionHead({ index, eyebrow, title, desc, dark = false, align = "center" }: {
  index?: string; eyebrow: string; title: ReactNode; desc?: ReactNode; dark?: boolean; align?: "center" | "left";
}) {
  return (
    <motion.div variants={stagger()} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }}
      className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-xl"}>
      <motion.div variants={reveal} className={`inline-flex items-center gap-2 text-[13px] font-bold tracking-wide ${dark ? "text-brand-200" : "text-brand-500"}`}>
        {index && <span className={`rounded-md px-1.5 py-0.5 text-[11.5px] tabular-nums ${dark ? "bg-white/10" : "bg-brand-50"}`}>{index}</span>}{eyebrow}
      </motion.div>
      <motion.h2 variants={reveal} className={`mt-4 text-[30px] font-extrabold leading-[1.2] tracking-[-0.035em] sm:text-[42px] ${dark ? "text-white" : "text-ink-950"}`}>{title}</motion.h2>
      {desc && <motion.p variants={reveal} className={`mt-4 text-[15.5px] leading-7 ${dark ? "text-white/60" : "text-ink-500"}`}>{desc}</motion.p>}
    </motion.div>
  );
}
