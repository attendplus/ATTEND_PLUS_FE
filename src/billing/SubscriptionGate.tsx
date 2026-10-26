import { motion } from "framer-motion";
import { ArrowRight, Check, Lock, MapPin, Sparkles } from "lucide-react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { ButtonLink, Card, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { canUse, useSubscription, won, type ServicePlan } from "./subscription";

// *
// 기능 잠금 (학교 구독 전 · 모든 역할)
// 라우트 구조에서 한 번에 적용합니다. (App.tsx의 기능 라우트를 <RequireSubscription>으로 감쌈)
// - 구독 전에는 실제 화면을 열지 않으므로 데이터 조회·수정 요청이 나가지 않습니다. (서버도 같은 조건으로 402/403)
// - 대신 그 화면의 제목·하는 일·레이아웃 모양과 요금 안내를 보여줍니다.
//   관리자: '결제하기' 버튼 → 요금제 선택 / 교사·학생: 학교 관리자가 구독을 시작해야 한다는 안내
// *
type Page = { title: string; desc: string; points: string[] };
const PAGES: Record<string, Page> = {
  "/admin": { title: "대시보드", desc: "학교 조직과 출결 환경을 한눈에 관리해요.", points: ["교사·학급·교실 영역 현황", "출결 환경 설정 진행도", "주요 메뉴 바로가기"] },
  "/admin/teachers": { title: "교사 관리", desc: "교사 계정 상태와 재직 상태를 관리해요.", points: ["학년·담임 기준 교사 목록", "재직·휴직·퇴직 상태 변경", "계정 비활성화·재활성화"] },
  "/admin/classes": { title: "학급 관리", desc: "학년별 반을 만들고 담임 교사와 교실을 지정해요.", points: ["학년별 학급 생성", "담임 교사·담임 교실 지정", "학급 비활성화"] },
  "/admin/layout": { title: "교실 배치도", desc: "배치도 PDF로 층·교실을 인식하고 실제 건물에 맞춰요.", points: ["배치도 PDF 자동 분석", "건물 외곽(VWorld) 정합", "도면 위에서 공간 추가·삭제"] },
  "/admin/timetable": { title: "시간표 연동", desc: "컴시간 알리미 시간표와 교시표를 자동으로 가져와요.", points: ["반별 시간표 자동 연동", "교시 시각 교시표 반영", "수동 동기화"] },
  "/admin/electives": { title: "이동수업 배정", desc: "학년별 이동수업 배정 엑셀로 학생마다 수업 교실을 정해요.", points: ["학년별 엑셀 업로드", "반별 배정 현황", "가입 전 학생 자동 배정"] },
  "/admin/subject-spaces": { title: "과목별 출석 공간", desc: "과목마다 출석을 인정할 공간을 지정해요.", points: ["과목별 공간 추가·삭제", "약어·원본 과목명 통합", "GPS 판정 영역 확인"] },
  "/admin/schedules": { title: "특별 일정", desc: "출결을 확인하지 않을 행사·면담 일정을 등록해요.", points: ["학교·학년·학급·학생 단위", "교시별 출결 제외", "예정·진행 중·종료 상태"] },
  "/admin/school": { title: "학교 정보", desc: "NEIS 학교 정보와 교시표, 학교 고유 인증 코드를 관리해요.", points: ["NEIS 기본 정보", "교시표 수정", "학교 인증 코드 재발급"] },
  "/teacher": { title: "출결 현황", desc: "담임반 학생들의 오늘 출결을 교시별로 확인해요.", points: ["교시별 출석·지각·결석", "수동 출결 처리와 사유", "변경 이력"] },
  "/teacher/join": { title: "학급 들어가기", desc: "관리자가 만든 학급에 담임으로 들어가요.", points: ["담임 지정 대기 학급 목록", "학급 담임으로 들어가기"] },
  "/teacher/lessons": { title: "이동수업 출결", desc: "내가 맡은 이동수업 반의 출결을 확인해요.", points: ["주간 수업별 출결", "수업 반 학생 목록", "수동 출결 처리"] },
  "/teacher/stats": { title: "출결 통계", desc: "학생별 · 월별 출결 통계를 기간과 출결 상태로 확인해요.", points: ["월별 출결 통계", "학생별 출결 현황", "기간·출결 상태 필터"] },
  "/teacher/qr": { title: "QR 출석", desc: "교실 화면에 띄울 교시별 QR 코드를 만들어요.", points: ["내 수업 교실 QR (이동수업 배정 기준)", "교시 종료 시 자동 만료", "실시간 출석 현황"] },
  "/teacher/members": { title: "학생 관리", desc: "학급 가입 코드로 초대하거나 학생 계정을 직접 등록해요.", points: ["가입 요청 승인·거절", "학생 계정 직접 추가", "학급 연결 해제"] },
  "/teacher/schedules": { title: "특별 일정", desc: "면담·행사로 출결을 확인하지 않을 교시를 등록해요.", points: ["학급·학생 단위 일정", "교시별 출결 제외"] },
  "/teacher/electives": { title: "이동수업 배정", desc: "관리자가 올린 이동수업 배정으로 교시마다 학생이 갈 교실을 확인해요.", points: ["학년별 배정 현황", "교시별 수업 교실 판단"] },
  "/teacher/class": { title: "학급 설정", desc: "담임 학급 정보를 수정해요.", points: ["담임 학급 정보 수정", "학급 비활성화"] },
  "/timetable": { title: "시간표", desc: "일주일 시간표와 수업 교실을 확인해요.", points: ["컴시간 연동 시간표", "이동수업 실제 교실", "특별 일정 표시"] },
  "/student": { title: "오늘 출석", desc: "오늘 교시별 출석 상태를 확인하고 QR로 출석해요.", points: ["현재 교시 출석 상태", "QR 코드 출석", "출석 대상 교실 안내"] },
  "/student/history": { title: "출결 기록", desc: "지난 출결 기록과 요약을 확인해요.", points: ["월별 출결 기록", "출석·지각·결석 요약"] },
};

function PriceRow({ plan }: { plan: ServicePlan }) {
  const y = plan.quotes.YEARLY;
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2.5">
      <span className="text-[13px] font-bold text-ink-800">{plan.name}</span>
      <span className="text-[13px] text-ink-600">
        월 <b className="text-ink-900">{won(plan.monthlyPrice)}</b>
        <span className="mx-1.5 text-ink-300">·</span>
        연 <b className="text-ink-900">{won(y.finalPrice)}</b>
        <span className="ml-1 inline-flex items-center gap-0.5 text-[11.5px] font-semibold text-teal-700"><Sparkles className="h-3 w-3" />{y.discountRate}%↓</span>
      </span>
    </div>
  );
}

export function LockedFeature({ gps = false }: { gps?: boolean }) {
  const { pathname } = useLocation();
  const { profile } = useAuth();
  const { subscription, plans } = useSubscription();
  const isAdmin = profile?.role === "SCHOOL_ADMIN";
  const page = PAGES[pathname] ?? { title: "이 기능", desc: "", points: [] };
  const needUpgrade = gps && subscription?.active && subscription.service !== "QR_GPS";   // QR 요금제 구독 중 → GPS 기능
  const shown = (plans?.services ?? []).filter((p) => !gps || p.id === "QR_GPS");
  const to = `/admin/billing${gps ? "?service=QR_GPS" : ""}`;

  const title = needUpgrade ? "QR + GPS 출결 요금제에서 쓸 수 있어요" : isAdmin ? "구독 결제 후 이용할 수 있어요" : "학교 구독이 시작되면 이용할 수 있어요";
  const body = needUpgrade
    ? `지금은 QR 출결 요금제를 이용 중이에요. ${page.title}은(는) 교실 위치 기반 출석에 필요한 기능이라 QR + GPS 출결 요금제가 필요해요.`
    : isAdmin
      ? `${page.title} 메뉴는 학교 구독을 시작하면 바로 쓸 수 있어요. 메뉴와 화면 구성은 지금도 둘러볼 수 있어요.`
      : `출결플러스는 학교 단위로 구독해요. 학교 관리자가 구독을 시작하면 ${page.title} 기능을 바로 쓸 수 있어요.`;

  return (
    <>
      <PageHeader title={page.title} description={page.desc} />
      <div className="relative min-h-[560px]">
        {/* 화면 모양 미리보기 (실제 데이터 없음, 흐리게) */}
        <div aria-hidden className="pointer-events-none select-none space-y-4 opacity-60 blur-[2px]">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-24" />)}</div>
          <div className="card h-[360px] p-5"><div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 rounded-xl bg-ink-100" />)}</div></div>
        </div>

        <div className="absolute inset-x-0 top-6 flex justify-center px-2 sm:top-10">
          <motion.div initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.35 }}
            className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-[0_30px_80px_-30px_rgba(20,41,68,.45)] ring-1 ring-ink-200/80 sm:p-8">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-500">{needUpgrade ? <MapPin className="h-6 w-6" /> : <Lock className="h-6 w-6" />}</span>
            <h2 className="mt-5 text-[21px] font-extrabold tracking-tight text-ink-950">{title}</h2>
            <p className="mt-2 text-[14px] leading-6 text-ink-500">{body}</p>
            {page.points.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {page.points.map((p) => <li key={p} className="flex items-center gap-2 text-[13.5px] text-ink-700"><Check className="h-4 w-4 text-mint-500" strokeWidth={3} />{p}</li>)}
              </ul>
            )}
            {shown.length > 0 && (
              <div className="mt-5 divide-y divide-ink-200/70 rounded-2xl bg-ink-50 ring-1 ring-ink-200/70">
                {shown.map((p) => <PriceRow key={p.id} plan={p} />)}
              </div>
            )}
            {isAdmin ? (
              <>
                <ButtonLink to={to} className="mt-6 flex w-full" size="lg">결제하기<ArrowRight className="h-4 w-4" /></ButtonLink>
                <p className="mt-3 text-center text-[12px] text-ink-400">결제 화면은 데모예요 · 실제 결제·청구·영수증 발급은 일어나지 않아요</p>
              </>
            ) : (
              <p className="mt-5 rounded-2xl bg-brand-50 px-4 py-3 text-[13px] leading-5 text-brand-700">구독·결제는 학교 관리자 계정에서 진행해요. 학교 관리자에게 문의해 주세요.</p>
            )}
          </motion.div>
        </div>
      </div>
    </>
  );
}

// 기능 라우트 가드: 구독(또는 GPS 기능이면 QR + GPS 구독)이 있으면 실제 화면, 없으면 잠금 안내
export function RequireSubscription({ gps = false }: { gps?: boolean }) {
  const { loading, error, failure, subscription, reload } = useSubscription();
  if (loading) return <div className="space-y-4"><Skeleton className="h-16" /><Skeleton className="h-96" /></div>;
  if (error) return <Card><ErrorState error={failure ?? new Error(error)} title="구독 정보를 불러오지 못했어요" onRetry={reload} /></Card>;
  return canUse(subscription, gps) ? <Outlet /> : <LockedFeature gps={gps} />;
}
