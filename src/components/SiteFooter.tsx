import clsx from "clsx";
import { Mail, Phone } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SERVICE } from "@/config/service";

// *
// 서비스 푸터 — 랜딩 페이지에서만 사용합니다. (로그인·회원가입·로그인 후 화면에는 푸터를 두지 않음)
// 아직 준비되지 않은 항목(약관·개인정보 처리방침·문의처)은 가짜 링크를 만들지 않고 '준비 중'으로 표시합니다.
// 운영 정보는 config/service.ts(환경 변수)에서 채워지면 자동으로 링크·연락처가 됩니다.
// *
type Item = { label: string; to?: string; href?: string | null; pending?: boolean };

function FooterLink({ item, dark }: { item: Item; dark?: boolean }) {
  const base = clsx("inline-flex items-center gap-1.5 text-[13.5px] transition-colors", dark ? "text-white/60 hover:text-white" : "text-ink-500 hover:text-ink-900");
  if (item.to) return <Link to={item.to} className={base}>{item.label}</Link>;
  if (item.href) return <a href={item.href} target="_blank" rel="noopener noreferrer" className={base}>{item.label}</a>;
  return (
    <span aria-disabled className={clsx("inline-flex cursor-default items-center gap-1.5 text-[13.5px]", dark ? "text-white/40" : "text-ink-400")}>
      {item.label}<span className={clsx("rounded px-1.5 py-px text-[10.5px] font-semibold", dark ? "bg-white/10 text-white/50" : "bg-ink-100 text-ink-400")}>준비 중</span>
    </span>
  );
}

const policyItems: Item[] = [
  { label: "이용약관", href: SERVICE.policy.terms },
  { label: "개인정보 처리방침", href: SERVICE.policy.privacy },
];

function Contact({ dark }: { dark?: boolean }): ReactNode {
  const { email, phone, hours } = SERVICE.support;
  const tone = dark ? "text-white/60" : "text-ink-500";
  if (!email && !phone) {
    return <p className={clsx("text-[13.5px] leading-6", tone)}>문의 창구는 서비스 정식 공개 때 안내해 드릴게요.</p>;
  }
  return (
    <ul className={clsx("space-y-2 text-[13.5px]", tone)}>
      {email && <li><a href={`mailto:${email}`} className="inline-flex items-center gap-1.5 hover:underline"><Mail className="h-3.5 w-3.5" />{email}</a></li>}
      {phone && <li className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{phone}</li>}
      {hours && <li className="text-[12.5px] opacity-80">{hours}</li>}
    </ul>
  );
}

export default function SiteFooter({ className }: { className?: string }) {
  const year = 2026;

  // 랜딩: 서비스 소개·바로가기·고객지원·정책·운영 정보
  const columns: { title: string; items: Item[] }[] = [
    { title: "서비스", items: [{ label: "작동 방식", to: "/#how" }, { label: "기능", to: "/#features" }, { label: "판정 기준", to: "/#rules" }, { label: "보안 · 개인정보", to: "/#security" }, { label: "요금제", to: "/#pricing" }] },
    { title: "시작하기", items: [{ label: "로그인", to: "/login" }, { label: "회원가입", to: "/signup" }, { label: "학교 관리자로 가입", to: "/signup?role=SCHOOL_ADMIN" }, { label: "비밀번호 찾기", to: "/find-password" }] },
    { title: "고객지원", items: [{ label: "자주 묻는 질문", to: "/#faq" }, { label: "이메일 문의", href: `mailto:${SERVICE.support.email}` }] },
    { title: "정책", items: policyItems },
  ];
  return (
    <footer className={clsx("border-t border-ink-100 bg-white px-4 pb-10 pt-16 sm:px-6", className)}>
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div className="max-w-sm">
            <Link to="/" className="flex items-center gap-2.5" aria-label={`${SERVICE.name} 홈`}>
              <img src="/logo-160.png" alt="" className="h-9 w-9" width={36} height={36} loading="lazy" />
              <span className="text-[18px] font-extrabold tracking-tight text-ink-950">{SERVICE.name}</span>
            </Link>
            <p className="mt-4 text-[14px] leading-7 text-ink-500">{SERVICE.tagline}</p>
            <div className="mt-6">
              <div className="mb-2 text-[12.5px] font-bold text-ink-900">문의</div>
              <Contact />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
            {columns.map((c) => (
              <div key={c.title}>
                <div className="text-[13px] font-bold text-ink-900">{c.title}</div>
                <ul className="mt-4 space-y-3">{c.items.map((i) => <li key={i.label}><FooterLink item={i} /></li>)}</ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-14 flex flex-col gap-3 border-t border-ink-100 pt-6 text-[12.5px] text-ink-400 sm:flex-row sm:items-center sm:justify-between">
          <div>© {year} {SERVICE.name} · {SERVICE.enName}. All rights reserved.</div>
          <div>{SERVICE.operator.name ? <>운영 {SERVICE.operator.name}{SERVICE.operator.info && <> · {SERVICE.operator.info}</>}</> : "운영 정보는 서비스 정식 공개 때 안내해 드릴게요."}</div>
        </div>
      </div>
    </footer>
  );
}
