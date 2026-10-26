import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { AlertTriangle, Check, ExternalLink, FileText, Layers, Loader2, MapPinned, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/api/client";
import LayoutViewer, { type PdrLayout, type SpaceEditor } from "@/components/LayoutViewer";
import { useConfirm } from "@/components/ConfirmDialog";
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, StatCard } from "@/components/ui";
import { formatDate, formatTime } from "@/lib/format";
import { useAsync } from "@/lib/hooks";

interface Job {
  slId: number; status: "PROCESSING" | "READY" | "FAILED"; step: string; stepLabel: string; error: string | null; originalName: string; fileUrl: string;
  floorCount: number | null; spaceCount: number | null; alignmentRmse: number | null; imageUrls: string[]; createdAt: string | null; finishedAt: string | null;
}
interface AdminLayout {
  latest: Job | null; current: Job | null; steps: { key: string; label: string }[];
  classrooms: { clrId: number; name: string; floorNo: number | null; hasArea: boolean; homeroomOf: string | null }[];
}

function Progress({ job, steps }: { job: Job; steps: AdminLayout["steps"] }) {
  const index = steps.findIndex((s) => s.key === job.step);
  return (
    <Card initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-5 overflow-hidden p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="relative grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
        <div>
          <div className="font-bold">배치도를 분석하고 있어요</div>
          <div className="text-[13px] text-ink-500">{job.originalName} · 보통 30초 이내에 끝납니다. 이 화면을 벗어나도 계속 진행돼요.</div>
        </div>
      </div>
      <ol className="grid gap-2 sm:grid-cols-5">
        {steps.filter((s) => s.key !== "UPLOADED" && s.key !== "DONE").map((s, i) => {
          const pos = i + 1;
          const done = index > pos, now = index === pos;
          return (
            <li key={s.key} className={clsx("relative overflow-hidden rounded-xl p-3 ring-1 transition", done ? "bg-mint-50 ring-mint-500/20" : now ? "bg-brand-50 ring-brand-200" : "bg-white ring-ink-200")}>
              {now && <motion.div className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-500" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 8, ease: "easeOut" }} style={{ originX: 0 }} />}
              <div className={clsx("mb-1 grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold", done ? "bg-mint-500 text-white" : now ? "bg-brand-500 text-white" : "bg-ink-100 text-ink-400")}>
                {done ? <Check className="h-3.5 w-3.5" /> : now ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : pos}
              </div>
              <div className={clsx("text-[12.5px] font-semibold", done || now ? "text-ink-900" : "text-ink-400")}>{s.label}</div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

export default function AdminLayout() {
  const { data, loading, error, reload } = useAsync(() => api.get<AdminLayout>("/admin/layout"), []);
  const layout = useAsync(() => api.get<{ layout: PdrLayout; version: string }>("/layout").catch(() => null), [data?.current?.slId]);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const processing = data?.latest?.status === "PROCESSING";
  const { confirm, dialog } = useConfirm();

  // 분석 중에는 2초마다 상태를 갱신합니다.
  useEffect(() => {
    if (!processing) return;
    const t = setInterval(async () => {
      const r = await reload(true);
      if (r?.latest?.status === "READY") toast.success("배치도 분석이 완료되었습니다. 교실 영역이 갱신되었어요.");
      if (r?.latest?.status === "FAILED") toast.error(r.latest.error ?? "배치도 분석에 실패했습니다.");
    }, 2000);
    return () => clearInterval(t);
  }, [processing, reload]);

  const upload = async (file?: File) => {
    if (!file) return;
    // 한글(HWP/HWPX) 배치도는 서버가 읽을 수 없어 PDF로 변환해서 올리도록 안내합니다.
    if (/\.(hwpx?|hwt)$/i.test(file.name)) {
      toast.error("한글(HWP·HWPX) 파일은 PDF로 변환한 뒤 올려주세요.", {
        description: "위쪽 안내의 'HWPX → PDF 변환' 링크에서 변환할 수 있어요.", duration: 8000,
      });
      return;
    }
    // 파일 이름·확장자와 상관없이 서버가 내용(PDF 시그니처)으로 확인합니다.
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      await api.upload("/admin/layout", form);
      toast.info("업로드 완료! 배치도 분석을 시작합니다.");
      await reload(true);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "배치도를 업로드하지 못했습니다.");
    } finally { setUploading(false); }
  };

  // 자동 정합 결과에 공간을 직접 추가/삭제합니다. 등록하면 같은 이름의 교실 영역(GPS 판정용)도 바로 만들어집니다.
  const editor: SpaceEditor = {
    onCreate: async (floor, name, polygon) => {
      try {
        const saved = await api.post<{ replaced: number }>("/admin/layout/spaces", { floor, name, polygon });
        toast.success(saved.replaced
          ? `${floor}층 ${name} 공간을 새 좌표로 덮어썼어요. 교실 영역도 함께 바꿨습니다.`
          : `${floor}층 ${name} 공간을 등록했어요. 교실 영역도 함께 만들었습니다.`);
        await Promise.all([reload(true), layout.reload(true)]);
        return true;
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "공간을 등록하지 못했습니다.");
        return false;
      }
    },
    onDelete: async (floor, space) => {
      if (!(await confirm({ title: `${floor}층 '${space.name}' 공간을 삭제할까요?`, description: "이 교실의 GPS 출석 영역도 함께 해제되고 되돌릴 수 없어요.", confirmLabel: "삭제", tone: "danger" }))) return false;
      try {
        await api.del(`/admin/layout/spaces/${floor}/${space.id}`);
        toast.success(`${space.name} 공간을 삭제했어요.`);
        await Promise.all([reload(true), layout.reload(true)]);
        return true;
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "공간을 삭제하지 못했습니다.");
        return false;
      }
    },
  };

  const homerooms = useMemo(() => Object.fromEntries((data?.classrooms ?? []).filter((c) => c.homeroomOf).map((c) => [c.name, c.homeroomOf!])), [data]);
  const byFloor = useMemo(() => {
    const groups: Record<string, AdminLayout["classrooms"]> = {};
    (data?.classrooms ?? []).forEach((c) => { (groups[c.floorNo ?? 0] ??= []).push(c); });
    return Object.entries(groups).sort((a, b) => Number(b[0]) - Number(a[0]));
  }, [data]);
  const current = data?.current;
  const failed = data?.latest?.status === "FAILED" ? data.latest : null;

  return (
    <>
      <PageHeader title="교실 배치도" description="학교 배치도 PDF만 올리면 층·교실을 인식하고, 실제 건물 외곽(VWorld)에 맞춰 층마다 공간·벽·복도를 정합합니다. 학생 앱은 정합된 층 데이터로 PDR과 GPS 출석을 판정해요."
        actions={<>
          <input ref={inputRef} type="file" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
          <Button icon={<UploadCloud className="h-4 w-4" />} loading={uploading} disabled={processing} onClick={() => inputRef.current?.click()}>{current ? "배치도 다시 올리기" : "배치도 업로드"}</Button>
        </>} />

      <HwpxGuide />
      {loading ? <Skeleton className="h-96" /> : error && !data ? <Card><ErrorState error={error} title="배치도 정보를 불러오지 못했어요" onRetry={() => reload()} /></Card> : (
        <>
          <AnimatePresence>
            {processing && data?.latest && <Progress job={data.latest} steps={data.steps} />}
            {failed && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0 }} className="mb-5 flex items-start gap-3 rounded-2xl bg-rose-50 p-4 text-[13.5px] text-rose-600 ring-1 ring-rose-500/20">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div><div className="font-bold">배치도 분석에 실패했어요 ({failed.originalName})</div><div className="mt-0.5">{failed.error}</div>
                  {current && <div className="mt-1 text-rose-500/80">이전 배치도({current.originalName})를 계속 사용합니다.</div>}</div>
              </motion.div>
            )}
          </AnimatePresence>

          {!current ? (
            !processing && (
              <Card className="p-2">
                <motion.div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files[0]); }}
                  onClick={() => inputRef.current?.click()} animate={{ scale: drag ? 1.01 : 1 }}
                  role="button" tabIndex={0} aria-label="교실 배치도 PDF 파일 선택"
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
                  className={clsx("focus-ring grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed px-6 py-16 text-center transition", drag ? "border-brand-400 bg-brand-50" : "border-ink-300 hover:border-brand-300 hover:bg-ink-50")}>
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-500"><MapPinned className="h-8 w-8" /></div>
                  <div className="mt-4 text-[17px] font-bold">교실 배치도 PDF를 끌어다 놓으세요</div>
                  <div className="mt-1 max-w-md text-[13px] text-ink-500">모든 층(1층, 2층 …)이 한 장에 모여 있는 교실 배치도 PDF를 올리세요. 분석 후 빠진 공간은 도면에서 직접 그려 추가할 수 있어요.</div>
                </motion.div>
              </Card>
            )
          ) : (
            <>
              <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="층" value={current.floorCount ?? 0} icon={<Layers className="h-4 w-4" />} />
                <StatCard label="인식한 공간" value={current.spaceCount ?? 0} icon={<MapPinned className="h-4 w-4" />} tone="mint" delay={0.05} />
                <StatCard label="담임 교실 연결" value={Object.keys(homerooms).length} icon={<Check className="h-4 w-4" />} tone="sky" delay={0.1} />
                <Card initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="p-5">
                  <div className="text-[13px] font-semibold text-ink-500">현재 배치도</div>
                  <div className="mt-2 truncate font-bold">{current.originalName}</div>
                  <div className="text-[12px] text-ink-500">{current.finishedAt && `${formatDate(current.finishedAt, false)} ${formatTime(current.finishedAt)} 분석`}</div>
                  <div className="mt-2 flex gap-3 text-[12.5px] font-semibold">
                    <a href={current.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand-600 hover:underline"><FileText className="h-3.5 w-3.5" />원본</a>
                  </div>
                </Card>
              </div>
              <Card className="mb-5 p-5">
                {layout.loading ? <Skeleton className="h-80" /> : layout.data ? (
                  <LayoutViewer layout={layout.data.layout} highlight={selected} homerooms={homerooms} onSelect={setSelected} editor={processing ? undefined : editor} />
                ) : <EmptyState title="도면 데이터를 불러오지 못했어요" description="잠시 후 다시 시도해 주세요. 계속되면 배치도를 다시 올려 보세요." action={<Button variant="secondary" onClick={() => layout.reload()}>다시 시도</Button>} />}
              </Card>
              <div>
                <Card className="max-h-[640px] overflow-hidden">
                  <div className="border-b border-ink-100 px-5 py-3.5 font-bold">교실 <span className="text-ink-400">{data?.classrooms.length}</span></div>
                  <div className="scrollbar-thin max-h-[580px] overflow-y-auto p-3">
                    {byFloor.map(([floor, rooms]) => (
                      <div key={floor} className="mb-3">
                        <div className="mb-1.5 px-2 text-[12px] font-bold text-ink-400">{floor === "0" ? "층 정보 없음" : `${floor}층`}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {rooms.map((r) => (
                            <button key={r.clrId} type="button" onMouseEnter={() => setSelected(r.name)} onMouseLeave={() => setSelected(null)} onFocus={() => setSelected(r.name)} onBlur={() => setSelected(null)}
                              className={clsx("focus-ring chip px-2.5 py-1 ring-1 transition", r.homeroomOf ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-white text-ink-600 ring-ink-200", !r.hasArea && "opacity-50")}>
                              {r.name}{r.homeroomOf && <Badge className="ml-1 bg-brand-500 px-1.5 py-0 text-[10px] text-white ring-0">{r.homeroomOf.replace("학년 ", "-").replace("반", "")}</Badge>}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </>
          )}
        </>
      )}
      {dialog}
    </>
  );
}

// HWPX 배치도 변환 안내 (외부 무료 변환 사이트, 새 탭으로 열림)
const HWPX_CONVERT_URL = "https://www.polarisofficetools.com/hwpx/convert/pdf";
function HwpxGuide() {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-sky-50 px-4 py-3 text-[13px] text-sky-800 ring-1 ring-sky-500/20">
      <FileText className="h-4 w-4 shrink-0 text-sky-500" />
      <span className="min-w-0 flex-1">배치도는 <b>PDF</b>만 올릴 수 있어요. 한글(<b>HWPX</b>) 파일이라면 먼저 PDF로 변환해서 올려주세요.</span>
      <a href={HWPX_CONVERT_URL} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 font-semibold text-sky-700 ring-1 ring-sky-500/30 hover:bg-sky-100">
        HWPX → PDF 변환<ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
