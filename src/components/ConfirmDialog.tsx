import { AlertTriangle, HelpCircle } from "lucide-react";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { Button, Modal } from "@/components/ui";

// *
// 최종 확인 창 — 결제·구독 해지처럼 되돌리기 어려운 동작 바로 전에 띄웁니다.
// '취소'(또는 Esc·바깥 클릭)는 창만 닫고 아무것도 하지 않으며, '확인'을 눌렀을 때만 onConfirm을 실행합니다.
// 실수로 Enter를 눌러 진행되지 않도록 처음 포커스는 '취소'에 둡니다.
// *
export default function ConfirmDialog({ open, title, description, children, confirmLabel = "확인", cancelLabel = "취소", tone = "primary", loading, onConfirm, onCancel }: {
  open: boolean; title: string; description?: ReactNode; children?: ReactNode; confirmLabel?: string; cancelLabel?: string;
  tone?: "primary" | "danger"; loading?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const close = () => { if (!loading) onCancel(); };
  return (
    <Modal open={open} onClose={close} size="sm"
      title={<span className="flex items-center gap-2.5">
        <span aria-hidden className={tone === "danger" ? "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-600" : "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600"}>
          {tone === "danger" ? <AlertTriangle className="h-4 w-4" /> : <HelpCircle className="h-4 w-4" />}
        </span>{title}
      </span>}
      footer={<>
        <Button variant="secondary" className="min-w-[88px]" onClick={close} disabled={loading} autoFocus>{cancelLabel}</Button>
        <Button variant={tone === "danger" ? "danger" : "primary"} className="min-w-[88px]" loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
      </>}>
      {description && <div className="text-[14px] leading-6 text-ink-600">{description}</div>}
      {children && <div className={description ? "mt-4" : ""}>{children}</div>}
    </Modal>
  );
}

type ConfirmOptions = { title: string; description?: ReactNode; confirmLabel?: string; tone?: "primary" | "danger" };

// *
// 브라우저 기본 confirm() 대신 쓰는 확인 창 훅 — `if (!(await confirm({...}))) return;` 형태로 기존 흐름을 그대로 유지합니다.
// 반환한 dialog 요소를 화면에 한 번 렌더링해 두세요.
// *
export function useConfirm() {
  // 닫히는 애니메이션 동안 문구가 비지 않도록 열림 여부와 내용을 따로 둡니다.
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => {
    resolver.current?.(false);
    resolver.current = resolve;
    setOptions(o);
    setOpen(true);
  }), []);
  const settle = (ok: boolean) => { resolver.current?.(ok); resolver.current = null; setOpen(false); };
  const dialog = (
    <ConfirmDialog open={open} title={options?.title ?? ""} description={options?.description} confirmLabel={options?.confirmLabel}
      tone={options?.tone} onConfirm={() => settle(true)} onCancel={() => settle(false)} />
  );
  return { confirm, dialog };
}
