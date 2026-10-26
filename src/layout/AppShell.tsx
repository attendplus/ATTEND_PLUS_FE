import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { BarChart3, Bell, BookOpenCheck, Building2, CalendarClock, CalendarDays, CheckCheck, ChevronDown, ClipboardList, CreditCard, DoorOpen, ReceiptText, GraduationCap, History, LayoutDashboard, ListChecks, Lock, LogOut, MapPinned, Menu, QrCode, School, Settings2, Shuffle, Trash2, UserRound, Users } from "lucide-react";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { canUse, SubscriptionProvider, useSubscription } from "@/billing/subscription";
import { api } from "@/api/client";
import type { Notification, Role } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { useConfirm } from "@/components/ConfirmDialog";
import { Avatar, Skeleton } from "@/components/ui";
import { ROLE_LABEL, relativeTime } from "@/lib/format";

// activeOnly: 비활성 교사(출결 보관 기능만 허용)에게 숨기는 메뉴
// noHomeroomOnly: 활성 담임 학급이 없는 교사에게만 보이는 메뉴 (학급 들어가기)
type NavItem = { to: string; label: string; icon: ReactNode; end?: boolean; activeOnly?: boolean; noHomeroomOnly?: boolean };

const NAV: Record<Role, NavItem[]> = {
  STUDENT: [
    { to: "/student", label: "오늘 출석", icon: <BookOpenCheck className="h-[18px] w-[18px]" />, end: true },
    { to: "/student/history", label: "출결 기록", icon: <History className="h-[18px] w-[18px]" /> },
    { to: "/timetable", label: "시간표", icon: <CalendarDays className="h-[18px] w-[18px]" /> },
    { to: "/profile", label: "내 정보", icon: <UserRound className="h-[18px] w-[18px]" /> },
  ],
  TEACHER: [
    { to: "/teacher/join", label: "학급 들어가기", icon: <DoorOpen className="h-[18px] w-[18px]" />, activeOnly: true, noHomeroomOnly: true },
    { to: "/teacher", label: "출결 현황", icon: <LayoutDashboard className="h-[18px] w-[18px]" />, end: true },
    { to: "/teacher/lessons", label: "이동수업 출결", icon: <Shuffle className="h-[18px] w-[18px]" /> },
    { to: "/teacher/stats", label: "출결 통계", icon: <BarChart3 className="h-[18px] w-[18px]" /> },
    { to: "/teacher/qr", label: "QR 출석", icon: <QrCode className="h-[18px] w-[18px]" />, activeOnly: true },
    { to: "/teacher/members", label: "학생 관리", icon: <Users className="h-[18px] w-[18px]" /> },
    { to: "/teacher/schedules", label: "특별 일정", icon: <CalendarClock className="h-[18px] w-[18px]" /> },
    { to: "/teacher/electives", label: "이동수업 배정", icon: <ListChecks className="h-[18px] w-[18px]" />, activeOnly: true },
    { to: "/timetable", label: "시간표", icon: <CalendarDays className="h-[18px] w-[18px]" /> },
    { to: "/teacher/class", label: "학급 설정", icon: <Settings2 className="h-[18px] w-[18px]" />, activeOnly: true },
  ],
  SCHOOL_ADMIN: [
    { to: "/admin", label: "대시보드", icon: <LayoutDashboard className="h-[18px] w-[18px]" />, end: true },
    { to: "/admin/teachers", label: "교사 관리", icon: <GraduationCap className="h-[18px] w-[18px]" /> },
    { to: "/admin/classes", label: "학급 관리", icon: <Building2 className="h-[18px] w-[18px]" /> },
    { to: "/admin/layout", label: "교실 배치도", icon: <MapPinned className="h-[18px] w-[18px]" /> },
    { to: "/admin/timetable", label: "시간표 연동", icon: <ClipboardList className="h-[18px] w-[18px]" /> },
    { to: "/admin/electives", label: "이동수업 배정", icon: <ListChecks className="h-[18px] w-[18px]" /> },
    { to: "/admin/subject-spaces", label: "과목별 출석 공간", icon: <DoorOpen className="h-[18px] w-[18px]" /> },
    { to: "/admin/schedules", label: "특별 일정", icon: <CalendarClock className="h-[18px] w-[18px]" /> },
    { to: "/admin/school", label: "학교 정보", icon: <School className="h-[18px] w-[18px]" /> },
    { to: "/admin/subscription", label: "구독 관리", icon: <ReceiptText className="h-[18px] w-[18px]" /> },
    { to: "/admin/billing", label: "요금제 · 결제", icon: <CreditCard className="h-[18px] w-[18px]" /> },
  ],
};

// 출결플러스 로고 (public/logo.png, 투명 배경)
export function Logo({ className }: { className?: string }) {
  return (
    <div className={clsx("flex items-center gap-2.5", className)}>
      <img src="/logo-160.png" alt="" width={40} height={40} className="h-10 w-10 shrink-0 select-none" draggable={false} />
      <div className="leading-tight">
        <div className="text-[16px] font-extrabold tracking-tight text-ink-950">출결플러스</div>
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-400">Attend Plus</div>
      </div>
    </div>
  );
}

// 드롭다운 공통: 바깥 클릭·Esc로 닫고, Esc로 닫으면 여는 버튼으로 포커스를 돌려줍니다.
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && closeRef.current();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      closeRef.current();
      ref.current?.querySelector<HTMLElement>("[aria-haspopup]")?.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return ref;
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useDismiss(open, () => setOpen(false));
  const { confirm, dialog } = useConfirm();

  const [loadError, setLoadError] = useState(false);
  // GET /notifications — 30초마다 갱신. 실패하면 임의 데이터 대신 오류 안내를 보여 줍니다.
  const load = () => api.get<{ unreadCount: number; notifications: Notification[] }>("/notifications")
    .then((r) => { setItems(r.notifications); setUnread(r.unreadCount); setLoadError(false); })
    .catch(() => setLoadError(true));
  // 탭이 백그라운드에 있는 동안에는 주기 요청을 멈추고, 다시 보이면 바로 한 번 갱신합니다. (불필요한 요청 감소)
  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 30000);
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  // PATCH /notifications/read-all — 모두 읽음, DELETE /notifications — 모두 지우기(목록에서 숨김)
  const readAll = async () => {
    try { await api.patch("/notifications/read-all"); load(); } catch { toast.error("알림을 읽음 처리하지 못했어요. 잠시 후 다시 시도해 주세요."); }
  };
  const clearAll = async () => {
    if (!(await confirm({ title: "알림을 모두 지울까요?", description: "목록에서 모든 알림이 사라지고 되돌릴 수 없어요.", confirmLabel: "모두 지우기", tone: "danger" }))) return;
    try { await api.del("/notifications"); setItems([]); setUnread(0); } catch { toast.error("알림을 지우지 못했어요. 잠시 후 다시 시도해 주세요."); }
  };
  const tone = { LATE: "bg-amber-500", QR: "bg-brand-500", SUMMARY: "bg-mint-500" } as const;

  return (
    <div className="relative" ref={ref}>
      <motion.button whileTap={{ scale: 0.92 }} onClick={() => { setOpen((o) => !o); load(); }} aria-haspopup="dialog" aria-expanded={open}
        className="focus-ring relative grid h-10 w-10 place-items-center rounded-xl text-ink-600 ring-1 ring-ink-200 hover:bg-white" aria-label={unread ? `알림, 읽지 않은 알림 ${unread}개` : "알림"}>
        <Bell className="h-[18px] w-[18px]" />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10.5px] font-bold text-white ring-2 ring-ink-50">
              {unread > 9 ? "9+" : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }} transition={{ type: "spring", stiffness: 420, damping: 30 }}
            role="dialog" aria-label="알림 목록"
            className="fixed inset-x-3 top-[68px] z-40 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-ink-200 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[380px] sm:origin-top-right">
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
              <div className="font-bold">알림{unread > 0 && <span className="ml-1.5 text-[12px] font-semibold text-rose-500">새 알림 {unread}</span>}</div>
              <div className="flex items-center gap-1">
                <button onClick={readAll} disabled={unread === 0}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12.5px] font-semibold text-brand-600 hover:bg-brand-50 disabled:cursor-default disabled:text-ink-300 disabled:hover:bg-transparent">
                  <CheckCheck className="h-3.5 w-3.5" />모두 읽음
                </button>
                <button onClick={clearAll} disabled={items.length === 0}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12.5px] font-semibold text-rose-600 hover:bg-rose-50 disabled:cursor-default disabled:text-ink-300 disabled:hover:bg-transparent">
                  <Trash2 className="h-3.5 w-3.5" />모두 지우기
                </button>
              </div>
            </div>
            <div className="scrollbar-thin max-h-[420px] overflow-y-auto">
              {loadError ? (
                <div className="px-4 py-10 text-center text-[13.5px] text-ink-500">알림을 불러오지 못했어요.
                  <button onClick={load} className="ml-1 font-semibold text-brand-600 hover:underline">다시 시도</button></div>
              ) : items.length === 0 ? (
                <div className="px-4 py-10 text-center text-[13.5px] text-ink-500">새로운 알림이 없습니다.</div>
              ) : items.map((n) => (
                <button key={n.notiId} type="button" onClick={() => !n.readAt && api.patch(`/notifications/${n.notiId}/read`).then(load).catch(() => undefined)}
                  aria-label={`${n.readAt ? "" : "읽지 않음, "}${n.title}`}
                  className={clsx("focus-ring flex w-full gap-3 border-b border-ink-100 px-4 py-3 text-left last:border-0 hover:bg-ink-50", !n.readAt && "bg-brand-50/40")}>
                  <span aria-hidden className={clsx("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-ink-300" : tone[n.type])} />
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-semibold text-ink-900">{n.title}</span>
                    {n.body && <span className="mt-0.5 block text-[12.5px] leading-5 text-ink-500">{n.body}</span>}
                    <span className="mt-1 block text-[11.5px] text-ink-500">{relativeTime(n.sentAt)}</span>
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {dialog}
    </div>
  );
}

function ProfileMenu() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  if (!profile) return null;
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={`${profile.name} 계정 메뉴`} className="focus-ring flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-2 hover:bg-white">
        <Avatar src={profile.profileImageUrl} name={profile.name} size={34} />
        <div className="hidden text-left leading-tight sm:block">
          <div className="text-[13.5px] font-bold">{profile.name}</div>
          <div className="text-[11.5px] text-ink-500">{ROLE_LABEL[profile.role]}</div>
        </div>
        <ChevronDown className={clsx("h-4 w-4 text-ink-400 transition", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="menu" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="absolute right-0 z-40 mt-2 w-52 overflow-hidden rounded-2xl bg-white p-1.5 shadow-2xl ring-1 ring-ink-200">
            <button role="menuitem" onClick={() => { setOpen(false); navigate("/profile"); }} className="focus-ring flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[13.5px] font-medium hover:bg-ink-50"><UserRound className="h-4 w-4" /> 내 정보</button>
            <button role="menuitem" onClick={async () => { await logout(); navigate("/", { replace: true }); }} className="focus-ring flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-rose-600 hover:bg-rose-50"><LogOut className="h-4 w-4" /> 로그아웃</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// 학교 구독 상태를 함께 불러와 메뉴 잠금 표시·기능 잠금 화면에 씁니다. (모든 역할 — 구독은 학교 단위)
export default function AppShell() {
  const { profile } = useAuth();
  return <SubscriptionProvider enabled={!!profile}><Shell /></SubscriptionProvider>;
}

// 구독 없이 쓰는 메뉴 (내 정보·요금제)
const OPEN_PATHS = new Set(["/profile", "/admin/billing", "/admin/subscription"]);

const GPS_PATHS = new Set(["/admin/layout", "/admin/subject-spaces"]);

function Shell() {
  const { profile } = useAuth();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { loading: subLoading, subscription } = useSubscription();
  // 화면을 옮기면 '더보기' 시트를 닫고, Esc로도 닫을 수 있게 합니다.
  useEffect(() => { setMoreOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMoreOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [moreOpen]);
  if (!profile) return null;
  // 구독 전 메뉴 옆 자물쇠 (내 정보·요금제 제외)
  const locked = (to: string) => !subLoading && !OPEN_PATHS.has(to) && !canUse(subscription, GPS_PATHS.has(to));
  const hasHomeroom = !!profile.schoolClass?.isActive;
  const nav = NAV[profile.role].filter((item) => (profile.active || !item.activeOnly) && !(item.noHomeroomOnly && hasHomeroom));
  // 모바일 하단 바는 4개 + '더보기'(나머지 메뉴 시트)로 모든 메뉴에 접근할 수 있게 합니다.
  const overflow = nav.length > 5;
  const mobileNav = overflow ? nav.slice(0, 4) : nav;
  const moreNav = overflow ? nav.slice(4) : [];
  const moreActive = moreNav.some((item) => location.pathname === item.to || (!item.end && location.pathname.startsWith(`${item.to}/`)));

  return (
    <div className="min-h-screen bg-ink-50">
      <a href="#main" className="sr-only z-50 rounded-lg bg-white px-4 py-2 font-semibold text-brand-700 shadow-lg focus:not-sr-only focus:fixed focus:left-3 focus:top-3">본문으로 건너뛰기</a>
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-ink-200/70 bg-white/80 px-4 py-5 backdrop-blur-xl lg:flex">
        <Logo className="px-2" />
        <div className="mt-6 rounded-2xl bg-gradient-to-br from-brand-50 to-white p-3.5 ring-1 ring-brand-100">
          <div className="text-[11.5px] font-semibold text-brand-600">{profile.school.name}</div>
          <div className="mt-0.5 text-[13.5px] font-bold text-ink-900">
            {profile.schoolClass ? profile.schoolClass.label : ROLE_LABEL[profile.role]}
          </div>
          {!profile.active && <div className="mt-1.5 text-[11.5px] font-semibold text-rose-500">비활성 계정 · 출결 보관 기능만 사용 가능</div>}
        </div>
        <nav aria-label="주 메뉴" className="scrollbar-thin -mx-1 mt-5 flex flex-1 flex-col gap-1 overflow-y-auto px-1">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="focus-ring relative rounded-xl">
              {({ isActive }) => (
                <div className={clsx("relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold transition-colors", isActive ? "text-brand-700" : "text-ink-600 hover:bg-ink-100 hover:text-ink-900")}>
                  {isActive && <motion.div layoutId="nav-active" className="absolute inset-0 rounded-xl bg-brand-50 ring-1 ring-brand-100" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                  <span className="relative">{item.icon}</span>
                  <span className="relative">{item.label}</span>
                  {locked(item.to) && <><Lock className="relative ml-auto h-3.5 w-3.5 text-ink-400" aria-hidden /><span className="sr-only">(구독 필요)</span></>}
                </div>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-ink-200/60 bg-ink-50/80 px-4 backdrop-blur-xl sm:px-8">
          <Logo className="lg:hidden" />
          <div className="hidden text-[13.5px] font-medium text-ink-500 lg:block">{profile.school.name}</div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <ProfileMenu />
          </div>
        </header>
        {/* 화면 전환은 이전 화면이 사라지기를 기다리지 않고 바로 새 화면을 띄웁니다. (exit 대기 제거로 이동이 빨라짐)
            화면 코드를 내려받는 동안에도 메뉴·머리글은 그대로 두고 본문 자리만 스켈레톤으로 채웁니다. */}
        <main id="main" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-[1240px] px-4 pb-28 pt-6 outline-none sm:px-8 lg:pb-12">
          <motion.div key={location.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: "easeOut" }}>
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </motion.div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav aria-label="주 메뉴" className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 flex justify-around rounded-2xl bg-white/95 p-1.5 shadow-2xl ring-1 ring-ink-200 backdrop-blur-xl lg:hidden">
        {mobileNav.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className="focus-ring relative min-w-0 flex-1 rounded-xl">
            {({ isActive }) => (
              <div className={clsx("relative flex flex-col items-center gap-0.5 rounded-xl px-0.5 py-2 text-[10.5px] font-semibold", isActive ? "text-brand-600" : "text-ink-500")}>
                {isActive && <motion.div layoutId="mnav-active" className="absolute inset-0 rounded-xl bg-brand-50" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                <span className="relative">{item.icon}</span>
                <span className="relative w-full truncate text-center">{item.label}</span>
              </div>
            )}
          </NavLink>
        ))}
        {overflow && (
          <button onClick={() => setMoreOpen((v) => !v)} className="focus-ring relative min-w-0 flex-1 rounded-xl" aria-expanded={moreOpen} aria-label="메뉴 더보기">
            <div className={clsx("relative flex flex-col items-center gap-0.5 rounded-xl py-2 text-[10.5px] font-semibold", moreActive || moreOpen ? "text-brand-600" : "text-ink-500")}>
              {moreActive && !moreOpen && <motion.div layoutId="mnav-active" className="absolute inset-0 rounded-xl bg-brand-50" />}
              <span className="relative"><Menu className="h-[18px] w-[18px]" /></span>
              <span className="relative">더보기</span>
            </div>
          </button>
        )}
      </nav>
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div className="fixed inset-0 z-30 bg-ink-900/20 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMoreOpen(false)} />
            <motion.div role="dialog" aria-label="전체 메뉴" className="fixed inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+72px)] z-40 grid grid-cols-3 gap-1.5 rounded-2xl bg-white p-2 shadow-2xl ring-1 ring-ink-200 lg:hidden"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
              {moreNav.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMoreOpen(false)}
                  className={({ isActive }) => clsx("focus-ring flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-center text-[11.5px] font-semibold", isActive ? "bg-brand-50 text-brand-600" : "text-ink-600 hover:bg-ink-50")}>
                  {item.icon}<span className="flex items-center gap-0.5">{item.label}{locked(item.to) && <Lock className="h-3 w-3 text-ink-400" aria-label="구독 필요" />}</span>
                </NavLink>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// 화면 코드를 내려받는 동안 본문 자리에 보이는 뼈대 (제목 + 요약 카드 + 본문)
function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="화면을 불러오는 중" className="space-y-4">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-4 w-72 max-w-full" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      <Skeleton className="h-80" />
    </div>
  );
}
