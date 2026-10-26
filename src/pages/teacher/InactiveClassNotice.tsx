import { Archive, RotateCcw } from "lucide-react";
import { useState } from "react";
import { api } from "@/api/client";
import type { Homeroom } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui";
import { useAction } from "@/lib/hooks";

// *
// 내 담임 학급이 비활성화됐을 때 안내 + 재활성화 (교사)
// PATCH /teacher/class/activate — 담임 본인만, 학생 소속·출결 기록은 비활성화 전 그대로 (서버가 권한·중복을 다시 확인)
// *
export default function InactiveClassNotice({ label, deactivatedAt, studentCount, onActivated }: {
  label: string; deactivatedAt?: string | null; studentCount?: number; onActivated?: (h: Homeroom) => void;
}) {
  const { profile, refresh } = useAuth();
  const { run, pending } = useAction();
  const [asking, setAsking] = useState(false);
  const activate = async () => {
    const r = await run(() => api.patch<Homeroom>("/teacher/class/activate"), `${label}을(를) 재활성화했어요.`);
    setAsking(false);
    if (r) { await refresh(); onActivated?.(r); }
  };
  const when = deactivatedAt ? new Date(deactivatedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }) : null;
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-white p-5 ring-1 ring-rose-200">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-600"><Archive className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <div className="text-[16px] font-extrabold text-ink-950">{label}은(는) 비활성화된 학급이에요</div>
        <p className="mt-0.5 text-[13px] leading-5 text-ink-500">
          {when && `${when}에 비활성화됐어요. `}학생 소속{studentCount != null ? `(${studentCount}명)` : ""}·출결 기록은 그대로 보관돼 있어요.
          지금은 출결 통계만 볼 수 있고, 재활성화하면 출석·QR·학생 관리를 바로 다시 쓸 수 있어요.
        </p>
      </div>
      <Button icon={<RotateCcw className="h-4 w-4" />} disabled={!profile?.active} onClick={() => setAsking(true)}>재활성화</Button>
      <ConfirmDialog open={asking} loading={pending} title={`${label}을(를) 재활성화할까요?`} onCancel={() => setAsking(false)} onConfirm={activate}
        description="비활성화 전의 학생 소속·출결 기록 그대로 다시 열려요." />
    </div>
  );
}
