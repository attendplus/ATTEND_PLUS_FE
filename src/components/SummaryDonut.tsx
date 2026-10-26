import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { Summary } from "@/api/types";
import { CountUp } from "@/components/ui";

// 출결 요약 도넛 (attendance.tsx의 SummaryDonut이 지연 로딩합니다)
const DONUT = [
  { key: "present", label: "출석", color: "#12B886" },
  { key: "late", label: "지각", color: "#F59F00" },
  { key: "absent", label: "결석", color: "#F03E3E" },
  { key: "earlyLeave", label: "조퇴", color: "#228BE6" },
  { key: "pending", label: "보류", color: "#9CA3AF" },
] as const;

export default function SummaryDonut({ summary }: { summary: Summary }) {
  const data = DONUT.map((d) => ({ name: d.label, value: summary[d.key], color: d.color })).filter((d) => d.value > 0);
  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <div className="relative h-40 w-40 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data.length ? data : [{ name: "없음", value: 1, color: "#E5E7EB" }]} dataKey="value" innerRadius={52} outerRadius={72} paddingAngle={data.length > 1 ? 3 : 0} stroke="none" animationDuration={900}>
              {(data.length ? data : [{ color: "#E5E7EB" }]).map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            {data.length > 0 && <Tooltip formatter={(v: number, n: string) => [`${v}건`, n]} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(0,0,0,.12)" }} />}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div><div className="text-[24px] font-extrabold"><CountUp value={summary.rate} decimals={1} suffix="%" /></div><div className="text-[11px] font-semibold text-ink-400">출석률</div></div>
        </div>
      </div>
      <div className="grid min-w-[220px] flex-1 grid-cols-2 gap-x-4 gap-y-2">
        {DONUT.map((d) => (
          <div key={d.key} className="flex items-center justify-between text-[13px]">
            <span className="flex items-center gap-1.5 whitespace-nowrap text-ink-500"><span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />{d.label}</span>
            <span className="font-bold tabular-nums">{summary[d.key]}</span>
          </div>
        ))}
        <div className="col-span-2 mt-1 flex items-center justify-between border-t border-ink-100 pt-2 text-[12.5px] text-ink-500">
          <span>GPS {summary.gps} · QR {summary.qr} · 수동 {summary.manual}</span>
          <span>확인 {summary.confirmed}/{summary.total}</span>
        </div>
      </div>
    </div>
  );
}

