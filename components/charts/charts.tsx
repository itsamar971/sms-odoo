"use client";
import { Bar, BarChart, CartesianGrid, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney, formatMoneyCompact } from "@/lib/money";

// Reference categorical palette, slots 1-2 (validated order); single hue for magnitude-only bars.
const SERIES_1 = "#2a78d6";
const SERIES_2 = "#eb6834";
const GRID = "#e5e7eb";
const AXIS = { fontSize: 11, fill: "#6b7280" };

const monthLabel = (m: string) => new Date(m + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });

function MoneyTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold">{label && /^\d{4}-\d{2}$/.test(label) ? monthLabel(label) : label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-medium tabular">{formatMoney(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function RevenueTrendChart({ data }: { data: { month: string; invoiced: number; collected: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="month" tickFormatter={monthLabel} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => formatMoneyCompact(v)} tick={AXIS} axisLine={false} tickLine={false} width={64} />
        <Tooltip content={<MoneyTooltip />} cursor={{ stroke: "#9ca3af", strokeDasharray: "3 3" }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "#374151" }} />
        <Line type="monotone" dataKey="invoiced" name="Invoiced" stroke={SERIES_1} strokeWidth={2} isAnimationActive={false} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} />
        <Line type="monotone" dataKey="collected" name="Collected" stroke={SERIES_2} strokeWidth={2} isAnimationActive={false} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function StatusBarChart({ data }: { data: { status: string; count: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: d.status.charAt(0) + d.status.slice(1).toLowerCase() }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 0 }} barCategoryGap={6}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" tick={AXIS} axisLine={false} tickLine={false} width={80} />
        <Tooltip cursor={{ fill: "#f3f4f6" }} formatter={(v: number) => [v.toLocaleString("en-IN"), "Subscriptions"]} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
        <Bar dataKey="count" isAnimationActive={false} fill={SERIES_1} radius={[0, 4, 4, 0]}>
          <LabelList dataKey="count" position="right" formatter={(v: number) => v.toLocaleString("en-IN")} style={{ fontSize: 11, fill: "#374151" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AgingChart({ data }: { data: { bucket: string; amount: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 16, right: 8, left: 8, bottom: 0 }}>
        <XAxis dataKey="bucket" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(b) => `${b} days`} />
        <YAxis hide />
        <Tooltip cursor={{ fill: "#f3f4f6" }} formatter={(v: number) => [formatMoney(v), "Overdue"]} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
        <Bar dataKey="amount" isAnimationActive={false} fill={SERIES_1} radius={[4, 4, 0, 0]}>
          <LabelList dataKey="amount" position="top" formatter={(v: number) => formatMoneyCompact(v)} style={{ fontSize: 11, fill: "#374151" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
