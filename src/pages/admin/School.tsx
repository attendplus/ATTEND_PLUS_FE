import { motion } from "framer-motion";
import { Copy, Eye, EyeOff, Globe, Phone, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { useConfirm } from "@/components/ConfirmDialog";
import { Button, Card, ErrorState, IconButton, Input, PageHeader, Skeleton, describeError } from "@/components/ui";
import { useAction, useAsync } from "@/lib/hooks";

interface School { name: string; enName: string | null; type: string | null; foundingType: string | null; coeduType: string | null; website: string | null; officeName: string | null; phoneNumber: string | null; zipCode: string | null; address: string | null; accessCodeMasked: string }
interface Period { perNo: number; start: string; end: string }

export default function AdminSchool() {
  const { data, loading, error, reload } = useAsync(() => api.get<School>("/admin/school"), []);
  const periodsQ = useAsync(() => api.get<{ periods: Period[] }>("/admin/school/periods"), []);
  const [code, setCode] = useState<string | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const { run, pending } = useAction();
  const { confirm, dialog } = useConfirm();
  useEffect(() => { if (periodsQ.data) setPeriods(periodsQ.data.periods.map((p) => ({ ...p, start: p.start.slice(0, 5), end: p.end.slice(0, 5) }))); }, [periodsQ.data]);

  const reveal = async () => {
    if (code) return setCode(null);
    try { setCode((await api.get<{ accessCode: string }>("/admin/school/access-code")).accessCode); }
    catch (e) { toast.error(describeError(e).title, { description: describeError(e).fix }); }
  };
  const regenerate = async () => {
    if (!(await confirm({ title: "학교 고유 인증 코드를 재발급할까요?", description: "기존 코드로는 더 이상 교사가 가입할 수 없어요. 새 코드를 교사들에게 다시 알려 주세요.", confirmLabel: "재발급", tone: "danger" }))) return;
    const r = await run(() => api.post<{ accessCode: string }>("/admin/school/access-code"), "새 인증 코드를 발급했습니다.");
    if (r) setCode(r.accessCode);
  };
  const savePeriods = async () => { const r = await run(() => api.put("/admin/school/periods", { periods }), "교시표를 저장했습니다."); if (r !== undefined) periodsQ.reload(true); };
  const update = (i: number, k: keyof Period, v: string) => setPeriods((ps) => ps.map((p, j) => (j === i ? { ...p, [k]: k === "perNo" ? Number(v) : v } : p)));

  return (
    <>
      <PageHeader title="학교 정보" description="나이스(NEIS)에서 가져온 학교 기본 정보와 교시표를 관리합니다." />
      {/* 좁은 화면에서 긴 웹사이트 주소·코드가 카드를 넓히지 않도록 min-w-0 + 줄바꿈 */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="min-w-0 p-5 sm:p-6">
          {/* 불러오기에 실패하면 스켈레톤을 계속 보여주지 않고 원인·재시도를 안내합니다. */}
          {error && !data ? <ErrorState error={error} title="학교 정보를 불러오지 못했어요" onRetry={() => reload()} /> : loading || !data ? <Skeleton className="h-64" /> : (
            <>
              <div className="text-[13px] font-semibold text-brand-600">{data.officeName}</div>
              <div className="text-[24px] font-extrabold">{data.name}</div>
              <div className="text-[13.5px] text-ink-500">{data.enName}</div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[["학교 유형", data.type], ["설립 구분", data.foundingType], ["남녀공학", data.coeduType], ["우편번호", data.zipCode]].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-ink-50 p-3"><div className="text-[12px] text-ink-500">{k}</div><div className="font-semibold">{v ?? "-"}</div></div>
                ))}
                <div className="rounded-xl bg-ink-50 p-3 sm:col-span-2"><div className="text-[12px] text-ink-500">주소</div><div className="font-semibold">{data.address ?? "-"}</div></div>
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-[13px] text-ink-600">
                {data.phoneNumber && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{data.phoneNumber}</span>}
                {data.website && <a href={data.website.startsWith("http") ? data.website : `http://${data.website}`} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1.5 break-all text-brand-600 hover:underline"><Globe className="h-3.5 w-3.5 shrink-0" />{data.website}</a>}
              </div>
              <div className="mt-6 rounded-2xl bg-gradient-to-r from-brand-50 to-white p-5 ring-1 ring-brand-100">
                <div className="text-[13px] font-semibold text-brand-600">학교 고유 인증 코드</div>
                <motion.div key={code ?? "masked"} initial={{ opacity: 0, filter: "blur(6px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} className="mt-1 break-all font-mono text-[22px] font-extrabold tracking-[0.15em] sm:text-[26px] sm:tracking-[0.2em]">{code ?? data.accessCodeMasked}</motion.div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" icon={code ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} onClick={reveal}>{code ? "숨기기" : "보기"}</Button>
                  {code && <Button size="sm" variant="secondary" icon={<Copy className="h-3.5 w-3.5" />} onClick={() => { navigator.clipboard?.writeText(code); toast.success("복사했습니다."); }}>복사</Button>}
                  <Button size="sm" variant="ghost" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={regenerate}>재발급</Button>
                </div>
              </div>
            </>
          )}
        </Card>
        <Card className="h-fit min-w-0 p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-[16px] font-bold">교시표</h2><Button size="sm" icon={<Save className="h-3.5 w-3.5" />} onClick={savePeriods} loading={pending} disabled={!periodsQ.data}>저장</Button></div>
          {periodsQ.error && !periodsQ.data ? <ErrorState error={periodsQ.error} title="교시표를 불러오지 못했어요" onRetry={() => periodsQ.reload()} /> : periodsQ.loading ? <Skeleton className="h-64" /> : (
            <div className="space-y-2">
              {periods.map((p, i) => (
                <motion.div key={i} layout initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="grid grid-cols-[48px_minmax(0,1fr)_minmax(0,1fr)_36px] items-center gap-1.5 sm:grid-cols-[56px_minmax(0,1fr)_minmax(0,1fr)_36px] sm:gap-2">
                  <Input value={p.perNo} inputMode="numeric" aria-label={`${i + 1}번째 교시 번호`} onChange={(e) => update(i, "perNo", e.target.value.replace(/\D/g, ""))} />
                  <Input type="time" value={p.start} aria-label={`${p.perNo}교시 시작 시각`} onChange={(e) => update(i, "start", e.target.value)} />
                  <Input type="time" value={p.end} aria-label={`${p.perNo}교시 끝 시각`} onChange={(e) => update(i, "end", e.target.value)} />
                  <IconButton label={`${p.perNo}교시 삭제`} tone="danger" onClick={() => setPeriods((ps) => ps.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></IconButton>
                </motion.div>
              ))}
              <Button size="sm" variant="soft" className="w-full" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setPeriods((ps) => [...ps, { perNo: (ps.at(-1)?.perNo ?? 0) + 1, start: "16:50", end: "17:40" }])}>교시 추가</Button>
            </div>
          )}
        </Card>
      </div>
      {dialog}
    </>
  );
}
