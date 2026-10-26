import { AnimatePresence, motion } from "framer-motion";
import { MousePointerClick, Plus, Trash2, Undo2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Button, Segmented } from "@/components/ui";

type LonLat = [number, number];
interface Space { id: number | null; name: string; type?: string; polygon: LonLat[]; representative_point?: LonLat; source?: string }
interface Segment { a: LonLat; b: LonLat }
// 층별 정합 결과 (study/pdr_pipeline.py 의 floors/floor_N.json, format = chakseok_pdr_floor)
export interface PdrFloor {
  floor: number;
  spaces: Space[];
  wall_network: Segment[];
  exterior_wall?: Segment[];
  wfs_reference?: { polygon: LonLat[] };
  corridor?: { geometry: LonLat[][]; area_m2?: number };
  statistics?: { corridor_area_m2?: number; final_wall_segments?: number };
}
export interface PdrLayout { floors: PdrFloor[] }

export interface SpaceEditor {
  onCreate: (floor: number, name: string, polygon: LonLat[]) => Promise<boolean>;
  onDelete: (floor: number, space: Space) => Promise<boolean>;
}

const M_PER_DEG_LAT = 110_574;
const GRID_M = 10;
const ROOM_COLORS = ["#F9C5C5", "#FDDCB5", "#FBEFA8", "#CDEBB8", "#B9E4DD", "#BCD8F5", "#CFC8F5", "#EBC6EC", "#F5CFDC", "#D9E3B0"];

// *
// 정합된 층 데이터(EPSG:4326)를 건물 기준 로컬 미터 좌표(X 동쪽, Y 북쪽)로 그립니다.
// 배치도 원본 방향이 아니라 실제 건물 방향 그대로이며, WFS 건물 외곽은 점선 기준선으로만 표시합니다.
// *
function useLocalFrame(floors: PdrFloor[]) {
  return useMemo(() => {
    const all = floors.flatMap((f) => [...(f.wfs_reference?.polygon ?? []), ...f.spaces.flatMap((s) => s.polygon)]);
    const lngs = all.map((p) => p[0]), lats = all.map((p) => p[1]);
    const lng0 = (Math.min(...lngs) + Math.max(...lngs)) / 2, lat0 = (Math.min(...lats) + Math.max(...lats)) / 2;
    const mPerDegLng = M_PER_DEG_LAT * Math.cos((lat0 * Math.PI) / 180);
    const toLocal = ([lng, lat]: LonLat): [number, number] => [(lng - lng0) * mPerDegLng, (lat - lat0) * M_PER_DEG_LAT];
    const toLonLat = (x: number, y: number): LonLat => [x / mPerDegLng + lng0, y / M_PER_DEG_LAT + lat0];
    const local = all.map(toLocal);
    const xs = local.map((p) => p[0]), ys = local.map((p) => p[1]);
    const pad = 6;
    const minX = Math.floor((Math.min(...xs) - pad) / GRID_M) * GRID_M, maxX = Math.ceil((Math.max(...xs) + pad) / GRID_M) * GRID_M;
    const minY = Math.floor((Math.min(...ys) - pad) / GRID_M) * GRID_M, maxY = Math.ceil((Math.max(...ys) + pad) / GRID_M) * GRID_M;
    return { toLocal, toLonLat, minX, maxX, minY, maxY };
  }, [floors]);
}

function colorOf(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ROOM_COLORS[h % ROOM_COLORS.length];
}

// onFloorChange: 선택한 층을 부모에게 알려 그 층의 정합 결과 이미지를 옆에 보여 줄 수 있게 합니다. (내부 처리 파일은 노출하지 않음)
export default function LayoutViewer({ layout, highlight, homerooms = {}, onSelect, editor, onFloorChange }: {
  layout: PdrLayout; highlight?: string | null; homerooms?: Record<string, string>; onSelect?: (name: string | null) => void; editor?: SpaceEditor;
  onFloorChange?: (floor: number) => void;
}) {
  const floors = layout.floors.map((f) => f.floor);
  const [floor, setFloor] = useState(floors[0] ?? 1);
  useEffect(() => { onFloorChange?.(floor); }, [floor, onFloorChange]);
  const [hover, setHover] = useState<string | null>(null);
  const [picked, setPicked] = useState<Space | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<LonLat[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const { toLocal, toLonLat, minX, maxX, minY, maxY } = useLocalFrame(layout.floors);

  // SVG 좌표는 Y가 아래로 증가하므로 북쪽이 위로 오도록 뒤집습니다. 왼쪽·아래에 축 눈금 여백을 둡니다.
  const AXIS = 7;
  const pt = (p: LonLat) => { const [x, y] = toLocal(p); return [x, -y] as const; };
  const ring = (poly: LonLat[]) => poly.map((p, i) => `${i ? "L" : "M"}${pt(p).join(",")}`).join(" ") + "Z";
  const view = `${minX - AXIS} ${-maxY} ${maxX - minX + AXIS + 2} ${maxY - minY + AXIS}`;

  const current = layout.floors.find((f) => f.floor === floor);
  const active = hover ?? picked?.name ?? highlight ?? null;
  const gridX = Array.from({ length: (maxX - minX) / GRID_M + 1 }, (_, i) => minX + i * GRID_M);
  const gridY = Array.from({ length: (maxY - minY) / GRID_M + 1 }, (_, i) => minY + i * GRID_M);
  const corridorArea = current?.corridor?.area_m2 ?? current?.statistics?.corridor_area_m2;

  const normalized = (v: string) => v.replace(/[‐-―−–—]/g, "-").replace(/\s+/g, "");
  const duplicate = !!name.trim() && !!current?.spaces.some((s) => normalized(s.name) === normalized(name));

  const resetDraft = () => { setDraft([]); setName(""); setDrawing(false); };
  const switchFloor = (v: string) => { setFloor(Number(v)); setPicked(null); resetDraft(); };

  // 클릭한 화면 위치 → SVG 좌표(로컬 미터) → 경도·위도. 0.1m 단위로 맞춰 꼭짓점을 찍습니다.
  const addVertex = (e: MouseEvent<SVGSVGElement>) => {
    if (!drawing || !svgRef.current) return;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const x = Math.round(p.x * 10) / 10, y = Math.round(-p.y * 10) / 10;
    setDraft((d) => [...d, toLonLat(x, y)]);
  };

  const editVertex = (i: number, axis: 0 | 1, value: string) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    setDraft((d) => d.map((p, j) => (j === i ? (axis === 0 ? [n, p[1]] : [p[0], n]) : p)));
  };

  const save = async () => {
    if (!editor || busy) return;
    setBusy(true);
    try { if (await editor.onCreate(floor, name.trim(), draft)) resetDraft(); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!editor || !picked || busy) return;
    setBusy(true);
    try { if (await editor.onDelete(floor, picked)) setPicked(null); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Segmented value={String(floor)} onChange={switchFloor} options={floors.map((f) => ({ value: String(f), label: `${f}층` }))} />
        <div className="flex items-center gap-2">
          <div className="truncate text-[13px] font-semibold text-ink-500">
            {drawing ? "도면을 클릭해 꼭짓점을 차례로 찍으세요" : active ? `${active}${homerooms[active] ? ` · ${homerooms[active]}` : ""}` : "교실에 마우스를 올려보세요"}
          </div>
          {editor && !drawing && (
            <Button size="sm" variant="soft" icon={<Plus className="h-4 w-4" />} onClick={() => { setPicked(null); setDrawing(true); }}>공간 추가</Button>
          )}
        </div>
      </div>
      <div className={`overflow-hidden rounded-2xl bg-white ring-1 ${drawing ? "ring-2 ring-brand-400" : "ring-ink-200"}`}>
        <AnimatePresence mode="wait">
          <motion.svg ref={svgRef} key={floor} viewBox={view} className={`block h-auto w-full ${drawing ? "cursor-crosshair" : ""}`} onClick={addVertex}
            initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            {gridX.map((x) => <line key={`gx${x}`} x1={x} x2={x} y1={-maxY} y2={-minY} stroke="#EEF0F3" strokeWidth={0.15} />)}
            {gridY.map((y) => <line key={`gy${y}`} x1={minX} x2={maxX} y1={-y} y2={-y} stroke="#EEF0F3" strokeWidth={0.15} />)}
            {gridX.filter((x) => x % (GRID_M * 2) === 0).map((x) => <text key={`lx${x}`} x={x} y={-minY + 3} fontSize={2} textAnchor="middle" fill="#9CA3AF">{x}</text>)}
            {gridY.filter((y) => y % (GRID_M * 2) === 0).map((y) => <text key={`ly${y}`} x={minX - 1} y={-y} fontSize={2} textAnchor="end" dominantBaseline="middle" fill="#9CA3AF">{y}</text>)}
            <text x={maxX} y={-minY + 6} fontSize={2} textAnchor="end" fill="#9CA3AF">X (m, 동쪽)</text>
            <text x={minX + 0.5} y={-maxY + 2.5} fontSize={2} fill="#9CA3AF">Y (m, 북쪽)</text>

            {current?.corridor && (
              <path d={current.corridor.geometry.map(ring).join(" ")} fillRule="evenodd" fill="#DBEAFE" stroke="#93C5FD" strokeWidth={0.12} />
            )}
            {current?.spaces.map((s, i) => {
              const on = active === s.name;
              const isHome = !!homerooms[s.name];
              return (
                <motion.path key={`${s.id}-${i}`} d={ring(s.polygon)}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.01, 0.4) }}
                  fill={on ? "#2B5793" : colorOf(s.name)} fillOpacity={on ? 1 : 0.85}
                  stroke={on ? "#3E37B5" : isHome ? "#4338CA" : s.source === "manual" ? "#0F766E" : "#6B7280"}
                  strokeWidth={on || isHome ? 0.4 : 0.15} strokeDasharray={s.source === "manual" ? "0.8 0.4" : undefined}
                  className={drawing ? "pointer-events-none" : "cursor-pointer transition-colors"}
                  onMouseEnter={() => setHover(s.name)} onMouseLeave={() => setHover(null)}
                  onClick={() => { setPicked(s); onSelect?.(s.name); }} />
              );
            })}
            {current?.wall_network.map((w, i) => {
              const [a, b] = [pt(w.a), pt(w.b)];
              return <line key={`w${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#1F2937" strokeWidth={0.22} strokeLinecap="round" pointerEvents="none" />;
            })}
            {current?.exterior_wall?.map((w, i) => {
              const [a, b] = [pt(w.a), pt(w.b)];
              return <line key={`e${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#111827" strokeWidth={0.45} strokeLinecap="round" pointerEvents="none" />;
            })}
            {current?.wfs_reference && (
              <path d={ring(current.wfs_reference.polygon)} fill="none" stroke="#EF4444" strokeWidth={0.3} strokeDasharray="1.2 0.8" pointerEvents="none" />
            )}
            {current?.spaces.map((s, i) => {
              const pts = s.polygon.map(pt);
              const [cx, cy] = s.representative_point ? pt(s.representative_point)
                : [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
              const w = Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]));
              const size = Math.max(0.8, Math.min(1.8, (w / Math.max(s.name.length, 2)) * 1.1));
              return <text key={`t${i}`} x={cx} y={cy} fontSize={size} textAnchor="middle" dominantBaseline="middle" pointerEvents="none"
                fontWeight={homerooms[s.name] ? 800 : 600} fill={active === s.name ? "#FFFFFF" : "#1F2937"}>{s.name}</text>;
            })}
            {draft.length > 0 && (
              <g pointerEvents="none">
                <path d={draft.map((p, i) => `${i ? "L" : "M"}${pt(p).join(",")}`).join(" ") + (draft.length > 2 ? "Z" : "")}
                  fill="#14B8A6" fillOpacity={0.25} stroke="#0F766E" strokeWidth={0.3} />
                {draft.map((p, i) => <circle key={i} cx={pt(p)[0]} cy={pt(p)[1]} r={0.5} fill="#0F766E" />)}
              </g>
            )}
          </motion.svg>
        </AnimatePresence>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11.5px] text-ink-500">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-[#FDDCB5] ring-1 ring-ink-400" />공간 {current?.spaces.length ?? 0}</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded ring-2 ring-brand-700" />담임 교실</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded border border-dashed border-teal-700" />직접 등록</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-blue-100 ring-1 ring-blue-300" />복도 (PDR 이동 영역){corridorArea ? ` ${Math.round(corridorArea).toLocaleString()}㎡` : ""}</span>
        <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-ink-900" />벽</span>
        <span className="flex items-center gap-1"><span className="w-3 border-t-2 border-dashed border-rose-500" />WFS 건물 외곽 (기준)</span>
        <span className="ml-auto text-ink-400">격자 {GRID_M}m · 정합 좌표 (EPSG:4326 → 로컬 미터)</span>
      </div>

      {editor && picked && !drawing && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-ink-50 px-4 py-3 ring-1 ring-ink-200">
          <div className="text-[13px]">
            <span className="font-bold">{picked.name}</span>
            <span className="ml-2 text-ink-500">{floor}층 · 공간 #{picked.id} · {picked.source === "manual" ? "직접 등록" : "자동 정합"}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" icon={<X className="h-4 w-4" />} onClick={() => setPicked(null)}>닫기</Button>
            <Button size="sm" variant="danger" loading={busy} icon={<Trash2 className="h-4 w-4" />} onClick={remove}>공간 삭제</Button>
          </div>
        </div>
      )}

      {editor && drawing && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-2xl bg-teal-50/60 p-4 ring-1 ring-teal-600/20">
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <label className="flex-1 text-[12.5px] font-semibold text-ink-600">
              공간 이름 ({floor}층)
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 3-9, 진로상담실"
                className="mt-1 h-10 w-full rounded-xl bg-white px-3 text-[14px] ring-1 ring-ink-200 focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </label>
            <Button size="sm" variant="secondary" icon={<Undo2 className="h-4 w-4" />} disabled={!draft.length} onClick={() => setDraft((d) => d.slice(0, -1))}>되돌리기</Button>
            <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} disabled={!draft.length} onClick={() => setDraft((d) => [...d, d[d.length - 1]])}>꼭짓점 추가</Button>
            <Button size="sm" variant="ghost" onClick={resetDraft}>취소</Button>
            <Button size="sm" loading={busy} disabled={draft.length < 3 || !name.trim()} onClick={save}>{duplicate ? "덮어쓰기" : "등록"}</Button>
          </div>
          {duplicate && (
            <div className="mb-3 text-[12.5px] font-semibold text-amber-700">{floor}층에 '{name.trim()}' 공간이 이미 있어요. 등록하면 새 좌표로 덮어씁니다.</div>
          )}
          {draft.length === 0 ? (
            <div className="flex items-center gap-2 text-[12.5px] text-ink-500"><MousePointerClick className="h-4 w-4" />도면에서 공간의 모서리를 순서대로 클릭하세요. 찍은 좌표는 아래에서 직접 고칠 수 있어요.</div>
          ) : (
            <div className="grid gap-1.5">
              <div className="grid grid-cols-[28px_1fr_1fr_72px_32px] gap-2 px-1 text-[11px] font-semibold text-ink-400"><span>#</span><span>경도</span><span>위도</span><span className="text-right">X, Y (m)</span><span /></div>
              {draft.map((p, i) => {
                const [x, y] = toLocal(p);
                return (
                  <div key={i} className="grid grid-cols-[28px_1fr_1fr_72px_32px] items-center gap-2">
                    <span className="text-center text-[12px] font-bold text-teal-700">{i + 1}</span>
                    {([0, 1] as const).map((axis) => (
                      <input key={axis} type="number" step="0.0000001" value={p[axis].toFixed(8)} onChange={(e) => editVertex(i, axis, e.target.value)}
                        className="h-8 rounded-lg bg-white px-2 font-mono text-[12px] ring-1 ring-ink-200 focus:outline-none focus:ring-2 focus:ring-brand-400" />
                    ))}
                    <span className="text-right font-mono text-[11px] text-ink-500">{x.toFixed(1)}, {y.toFixed(1)}</span>
                    <button aria-label={`${i + 1}번 꼭짓점 삭제`} onClick={() => setDraft((d) => d.filter((_, j) => j !== i))} className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-white hover:text-rose-500"><X className="h-4 w-4" /></button>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
