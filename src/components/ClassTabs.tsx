import clsx from "clsx";
import { DoorOpen, Home } from "lucide-react";
import type { ReactNode } from "react";

export interface ClassTab { key: string; kind: "HOMEROOM" | "MOVING"; label: string; sub: ReactNode; badge?: ReactNode }

// *
// 반 선택 탭 (담임반 + 이동수업 반) — 이동수업 출결·QR 출석에서 같이 씁니다.
// 2·3열로 맞춰지는 (모바일 2열, 아이콘 생략) 같은 크기의 카드 격자라 탭이 잘리거나 높이가 들쭉날쭉하지 않습니다.
// *
export default function ClassTabs({ tabs, value, onChange, label }: { tabs: ClassTab[]; value: string; onChange: (key: string) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="mb-5 grid grid-cols-2 gap-2 sm:gap-2.5 xl:grid-cols-3">
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button key={t.key} type="button" role="tab" aria-selected={active} onClick={() => onChange(t.key)}
            className={clsx("flex min-h-[60px] items-center gap-3 rounded-2xl px-3 py-2.5 text-left ring-1 transition sm:px-3.5 sm:py-3",
              active ? "bg-brand-500 text-white ring-brand-500" : "bg-white text-ink-900 ring-ink-200 hover:bg-ink-50 hover:ring-brand-200")}>
            <span className={clsx("hidden h-9 w-9 shrink-0 place-items-center rounded-xl sm:grid",
              active ? "bg-white/15 text-white" : t.kind === "HOMEROOM" ? "bg-brand-50 text-brand-500" : "bg-teal-50 text-teal-600")}>
              {t.kind === "HOMEROOM" ? <Home className="h-4 w-4" /> : <DoorOpen className="h-4 w-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[14px] font-bold leading-5">{t.label}</span>
                {t.badge}
              </span>
              <span className={clsx("block truncate text-[12px] leading-4", active ? "text-white/75" : "text-ink-500")}>{t.sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
