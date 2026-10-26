import { AnimatePresence, motion, useMotionValue, useSpring, useTransform, type HTMLMotionProps } from "framer-motion";
import clsx from "clsx";
import { AlertCircle, Check, Eye, EyeOff, Inbox, Loader2, Lock, RefreshCw, WifiOff, X } from "lucide-react";
import { ApiError } from "@/api/client";
import { forwardRef, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { Link, type LinkProps } from "react-router-dom";

/* ───────── Button ───────── */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "soft";
// 버튼 위계: primary(화면당 핵심 동작 1개) > secondary(보조) > soft/ghost(가벼운 동작), danger는 되돌리기 어려운 동작에만 씁니다.
const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-500 text-white shadow-sm hover:bg-brand-600 active:bg-brand-700",
  secondary: "bg-white text-ink-900 ring-1 ring-inset ring-ink-200 hover:bg-ink-50 hover:ring-ink-300",
  ghost: "text-ink-700 hover:bg-ink-100",
  danger: "bg-rose-600 text-white shadow-sm hover:bg-rose-700",
  soft: "bg-brand-50 text-brand-700 hover:bg-brand-100",
};

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: Variant; size?: "sm" | "md" | "lg"; loading?: boolean; icon?: ReactNode; children?: ReactNode;
}

// sm도 클릭 영역이 36px 이상이 되도록 맞춥니다.
const SIZES = { sm: "h-9 px-3 text-[13px] rounded-lg", md: "h-11 px-4 text-[14px] rounded-xl", lg: "h-[52px] px-6 text-[15px] rounded-xl" };
const BUTTON_BASE = "focus-ring inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors";

// 다른 화면으로 이동하는 버튼 모양 링크 — <Link><Button/></Link>처럼 링크 안에 버튼을 넣으면 탭 이동이 두 번 걸리고
// 화면 낭독기에 '링크 안의 버튼'으로 읽혀서, 링크 하나로 버튼 모양만 냅니다.
export function ButtonLink({ variant = "primary", size = "md", icon, children, className, ...rest }: LinkProps & { variant?: Variant; size?: "sm" | "md" | "lg"; icon?: ReactNode }) {
  return <Link className={clsx(BUTTON_BASE, VARIANTS[variant], SIZES[size], className)} {...rest}>{icon}{children}</Link>;
}

// 기본 type은 "button" — 폼 안에 놓여도 의도치 않게 제출되지 않습니다. (제출 버튼은 type="submit"을 명시)
export function Button({ variant = "primary", size = "md", loading, icon, children, className, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <motion.button
      type={type}
      whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={clsx(BUTTON_BASE, "disabled:cursor-not-allowed disabled:opacity-50", VARIANTS[variant], SIZES[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </motion.button>
  );
}

// 아이콘만 있는 버튼: 화면 낭독기용 이름(label)을 반드시 받고, 마우스를 올리면 같은 문구를 툴팁으로 보여줍니다.
export function IconButton({ label, children, tone = "default", className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; tone?: "default" | "danger" }) {
  return (
    <button type="button" aria-label={label} title={label}
      className={clsx("focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-400 transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        tone === "danger" ? "hover:bg-rose-50 hover:text-rose-600" : "hover:bg-ink-100 hover:text-ink-700", className)}
      {...rest}>
      {children}
    </button>
  );
}

/* ───────── Form fields ───────── */
interface FieldProps { label?: string; hint?: ReactNode; error?: string | null; required?: boolean }

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps & { right?: ReactNode }>(
  ({ label, hint, error, required, right, className, ...rest }, ref) => {
    const id = useId();
    return (
      <div className={className}>
        {label && <label htmlFor={id} className="label">{label}{required && <span className="ml-0.5 text-brand-500">*</span>}</label>}
        <div className="relative">
          <input id={id} ref={ref} aria-invalid={!!error || undefined} aria-describedby={error || hint ? `${id}-msg` : undefined} aria-label={label ? undefined : rest.placeholder}
            className={clsx("field", right && "pr-11", error && "border-rose-500 focus:shadow-none")} {...rest} />
          {right && <div className="absolute inset-y-0 right-2 flex items-center">{right}</div>}
        </div>
        <FieldMessage id={`${id}-msg`} hint={hint} error={error} />
      </div>
    );
  },
);

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement> & FieldProps) {
  const [show, setShow] = useState(false);
  return (
    <Input
      {...props}
      type={show ? "text" : "password"}
      right={
        <button type="button" onClick={() => setShow((s) => !s)} className="focus-ring rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700" aria-label={show ? "비밀번호 숨기기" : "비밀번호 보기"} aria-pressed={show}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      }
    />
  );
}

export function Textarea({ label, hint, error, required, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps) {
  const id = useId();
  return (
    <div className={className}>
      {label && <label htmlFor={id} className="label">{label}{required && <span className="ml-0.5 text-brand-500">*</span>}</label>}
      <textarea id={id} aria-invalid={!!error || undefined} aria-describedby={error || hint ? `${id}-msg` : undefined} className={clsx("field min-h-[88px] resize-y", error && "border-rose-500")} {...rest} />
      <FieldMessage id={`${id}-msg`} hint={hint} error={error} />
    </div>
  );
}

export function Select({ label, hint, error, required, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & FieldProps) {
  const id = useId();
  return (
    <div className={className}>
      {label && <label htmlFor={id} className="label">{label}{required && <span className="ml-0.5 text-brand-500">*</span>}</label>}
      <select id={id} aria-invalid={!!error || undefined} aria-describedby={error || hint ? `${id}-msg` : undefined} className={clsx("field appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 fill=%22none%22 stroke=%22%239CA3AF%22 stroke-width=%222%22><path d=%22m4 6 4 4 4-4%22/></svg>')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10")} {...rest}>
        {children}
      </select>
      <FieldMessage id={`${id}-msg`} hint={hint} error={error} />
    </div>
  );
}

function FieldMessage({ id, hint, error }: { id?: string; hint?: ReactNode; error?: string | null }) {
  return (
    <AnimatePresence initial={false} mode="wait">
      {error ? (
        <motion.p key="e" id={id} role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-1.5 text-[12.5px] font-medium text-rose-500">{error}</motion.p>
      ) : hint ? (
        <motion.p key="h" id={id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-1.5 text-[12.5px] text-ink-500">{hint}</motion.p>
      ) : null}
    </AnimatePresence>
  );
}

export function Checkbox({ checked, onChange, children, className }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; className?: string }) {
  return (
    <label className={clsx("group flex cursor-pointer items-start gap-2.5 text-[14px] text-ink-700", className)}>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={clsx("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md ring-1 transition peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500", checked ? "bg-brand-500 ring-brand-500" : "bg-white ring-ink-300 group-hover:ring-brand-400")}>
        <AnimatePresence>
          {checked && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 600, damping: 25 }}>
              <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <span className="leading-6">{children}</span>
    </label>
  );
}

export function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} title={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={clsx("focus-ring relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50", checked ? "bg-brand-500" : "bg-ink-300")}
    >
      <motion.span layout transition={{ type: "spring", stiffness: 700, damping: 35 }} className={clsx("absolute top-1 h-5 w-5 rounded-full bg-white shadow", checked ? "right-1" : "left-1")} />
    </button>
  );
}

/* ───────── Segmented control ───────── */
export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  const id = useId();
  return (
    // 좁은 화면에서 선택지가 많으면 페이지 전체가 아니라 이 컨트롤 안에서만 가로로 넘깁니다.
    <div role="group" className={clsx("scrollbar-none inline-flex max-w-full overflow-x-auto rounded-xl bg-ink-100 p-1", className)}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)} className={clsx("focus-ring relative shrink-0 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors", value === o.value ? "text-ink-900" : "text-ink-500 hover:text-ink-700")}>
          {value === o.value && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-lg bg-white shadow-sm" transition={{ type: "spring", stiffness: 500, damping: 35 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ───────── Surfaces ───────── */
export function Card({ className, children, ...rest }: HTMLMotionProps<"div">) {
  return <motion.div className={clsx("card", className)} {...rest}>{children}</motion.div>;
}

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={clsx("chip shrink-0 whitespace-nowrap ring-1 ring-inset", className ?? "bg-ink-100 text-ink-700 ring-ink-200")}>{children}</span>;
}

export function Avatar({ src, name, size = 40, className }: { src?: string | null; name?: string; size?: number; className?: string }) {
  return src ? (
    <img src={src} alt={name ?? ""} style={{ width: size, height: size }} className={clsx("shrink-0 rounded-full object-cover ring-2 ring-white", className)} />
  ) : (
    <div style={{ width: size, height: size }} className={clsx("grid shrink-0 place-items-center rounded-full bg-brand-100 font-bold text-brand-700", className)}>{name?.[0]}</div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    // 제목·설명은 왼쪽(최대 폭 제한), 버튼은 오른쪽 한 줄로 정렬합니다. 좁은 화면에서는 버튼이 제목 아래로 내려갑니다.
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 lg:max-w-[min(680px,60%)]">
        {eyebrow && <div className="mb-1 text-[13px] font-semibold text-brand-600">{eyebrow}</div>}
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-ink-950">{title}</h1>
        {description && <p className="mt-1.5 text-[14px] leading-6 text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">{actions}</div>}
    </motion.div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-ink-100 text-ink-500">{icon ?? <Inbox className="h-6 w-6" />}</div>
      <div className="text-[15.5px] font-bold text-ink-900">{title}</div>
      {description && <p className="mt-1 max-w-sm text-[13.5px] leading-6 text-ink-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

/* ───────── Error state ───────── */
// 오류를 '무슨 일이 생겼는지(원인)'와 '어떻게 하면 되는지(해결 방법)'로 나눠 안내합니다.
// 서버 메시지(업무 규칙 오류)는 그대로 원인으로 보여주고, 연결·권한·서버 오류는 상태 코드로 해결 방법을 고릅니다.
export type ErrorKind = "network" | "auth" | "payment" | "forbidden" | "notfound" | "server" | "other";
export function describeError(e: unknown): { kind: ErrorKind; title: string; cause: string; fix: string } {
  const err = e instanceof ApiError ? e : new ApiError("UNKNOWN", e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.", -1);
  const s = err.status;
  if (s === 0) return { kind: "network", title: "서버에 연결하지 못했어요", cause: "", fix: "인터넷 연결을 확인한 뒤 다시 시도해 주세요. 계속되면 잠시 후 다시 접속해 주세요." };
  if (s === 401) return { kind: "auth", title: "로그인이 만료됐어요", cause: err.message, fix: "다시 로그인하면 이어서 쓸 수 있어요." };
  if (s === 402) return { kind: "payment", title: "학교 구독이 필요한 기능이에요", cause: err.message, fix: "학교 관리자 계정의 '구독 관리'에서 구독 상태를 확인해 주세요." };
  if (s === 403) return { kind: "forbidden", title: "이 기능을 쓸 권한이 없어요", cause: err.message, fix: "계정 역할과 담당 학급을 확인하거나 학교 관리자에게 문의해 주세요." };
  if (s === 404) return { kind: "notfound", title: "요청한 정보를 찾을 수 없어요", cause: err.message, fix: "삭제되었거나 바뀌었을 수 있어요. 목록에서 다시 선택해 주세요." };
  if (s >= 500) return { kind: "server", title: "서버에서 문제가 생겼어요", cause: err.message, fix: "잠시 후 다시 시도해 주세요. 계속되면 서비스 관리자에게 문의해 주세요." };
  return { kind: "other", title: err.message, cause: "", fix: "입력한 내용이나 현재 상태를 확인한 뒤 다시 시도해 주세요." };
}

export function ErrorState({ error, onRetry, title, action }: { error: unknown; onRetry?: () => void; title?: string; action?: ReactNode }) {
  const d = describeError(error);
  const heading = title ?? d.title;
  // 제목을 따로 준 경우 서버가 알려준 내용(업무 오류 메시지 또는 원인)을 그 아래에 보여줍니다.
  const detail = title && d.kind === "other" ? d.title : d.cause;
  const [retrying, setRetrying] = useState(false);
  const retry = onRetry && (async () => { setRetrying(true); try { await onRetry(); } finally { setRetrying(false); } });
  const icon = d.kind === "network" ? <WifiOff className="h-6 w-6" /> : d.kind === "forbidden" || d.kind === "payment" || d.kind === "auth" ? <Lock className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />;
  return (
    <div role="alert" className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-600">{icon}</div>
      <div className="text-[15.5px] font-bold text-ink-900">{heading}</div>
      {detail && detail !== heading && <p className="mt-1 max-w-md text-[13.5px] leading-6 text-ink-600">{detail}</p>}
      <p className="mt-1 max-w-md text-[13px] leading-6 text-ink-500">{d.fix}</p>
      {(retry || action) && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {retry && <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} loading={retrying} onClick={retry}>다시 시도</Button>}
          {action}
        </div>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={clsx("relative overflow-hidden rounded-xl bg-ink-100", className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent" />
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx("h-5 w-5 animate-spin text-brand-500", className)} />;
}

/* ───────── Animated number ───────── */
export function CountUp({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 90, damping: 20 });
  const text = useTransform(spring, (v) => `${v.toFixed(decimals)}${suffix}`);
  useEffect(() => { mv.set(value); }, [mv, value]);
  return <motion.span>{text}</motion.span>;
}

export function StatCard({ label, value, suffix, icon, tone = "brand", delay = 0, sub }: { label: string; value: number; suffix?: string; icon: ReactNode; tone?: "brand" | "mint" | "amber" | "rose" | "sky"; delay?: number; sub?: ReactNode }) {
  const tones = { brand: "bg-brand-50 text-brand-600", mint: "bg-mint-50 text-mint-600", amber: "bg-amber-50 text-amber-600", rose: "bg-rose-50 text-rose-600", sky: "bg-sky-50 text-sky-500" };
  return (
    <Card initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className="p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-ink-500">{label}</span>
        <span aria-hidden className={clsx("grid h-9 w-9 place-items-center rounded-xl", tones[tone])}>{icon}</span>
      </div>
      <div className="mt-3 text-[24px] font-extrabold tabular-nums tracking-tight text-ink-950 sm:text-[28px]">
        <CountUp value={value} decimals={suffix === "%" ? 1 : 0} suffix={suffix} />
      </div>
      {sub && <div className="mt-1 text-[12.5px] text-ink-500">{sub}</div>}
    </Card>
  );
}

/* ───────── Modal ───────── */
// 여러 창이 겹쳐 열려도(예: 수정 창 위 확인 창) 마지막 창이 닫힐 때만 배경 스크롤을 되돌립니다.
let openModals = 0;
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, title, description, children, footer, size = "md" }: { open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  // onClose는 매 렌더 새 함수로 오는 경우가 많아 ref로 들고, 열림 상태가 바뀔 때만 효과를 다시 겁니다. (포커스가 렌더마다 튀지 않게)
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const restore = document.activeElement as HTMLElement | null;
    openModals += 1;
    document.body.style.overflow = "hidden";
    // 창 안에 autoFocus 요소가 없으면 창 자체에 포커스를 둬서 키보드·화면 낭독기가 창 안에서 시작하게 합니다.
    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (panel && !panel.contains(document.activeElement)) panel.focus();
    }, 0);
    const onKey = (e: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      // 겹친 창에서는 가장 위의 창만 키 입력을 처리합니다.
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs[dialogs.length - 1] !== panel) return;
      if (e.key === "Escape") { e.stopPropagation(); closeRef.current(); return; }
      if (e.key !== "Tab") return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) { e.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      openModals -= 1;
      if (openModals === 0) document.body.style.overflow = "";
      if (restore && document.contains(restore)) restore.focus({ preventScroll: true });
    };
  }, [open]);

  const widths = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div aria-hidden className="absolute inset-0 bg-ink-950/40" onClick={() => closeRef.current()} />
          <motion.div
            ref={panelRef} tabIndex={-1}
            role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descId : undefined}
            initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
            className={clsx("relative flex max-h-[92vh] max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl outline-none sm:rounded-3xl", widths[size])}
          >
            <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 pb-4 pt-5 sm:px-6">
              <div className="min-w-0">
                <h2 id={titleId} className="text-[18px] font-bold leading-snug text-ink-950">{title}</h2>
                {description && <p id={descId} className="mt-1 text-[13.5px] leading-6 text-ink-500">{description}</p>}
              </div>
              <IconButton label="닫기" onClick={() => closeRef.current()} className="-mr-1.5 -mt-0.5"><X className="h-5 w-5" /></IconButton>
            </div>
            <div className="scrollbar-thin overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">{children}</div>
            {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-ink-100 bg-ink-50/60 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ───────── Motion helpers ───────── */
export const stagger = { animate: { transition: { staggerChildren: 0.05 } } };
export const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 28 } } };

export function ErrorBanner({ message }: { message?: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
          <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-[13.5px] font-medium leading-5 text-rose-700 ring-1 ring-rose-500/20"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{message}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
