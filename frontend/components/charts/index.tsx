"use client";

import {
  BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart as RePieChart, Pie, Cell,
  LineChart as ReLineChart, Line,
  AreaChart as ReAreaChart, Area,
} from "recharts";

const COLORS = ["#235FF6", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#14B8A6"];

const tooltipStyle = {
  backgroundColor: "#FFFFFF",
  border: "1px solid rgba(0,0,0,0.1)",
  borderRadius: "8px",
  boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
  fontSize: "12px",
  color: "#0F172A",
};

const axisStyle = { fontSize: 11, fill: "#94A3B8" };

interface ChartProps {
  data: any[];
  height?: number;
}

export function BarChartCard({ data, dataKey, nameKey = "name", height = 280 }: ChartProps & { dataKey: string; nameKey?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart data={data} margin={{ top: 4, right: 4, bottom: 40, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
        <XAxis dataKey={nameKey} tick={axisStyle} axisLine={false} tickLine={false} interval={0} angle={-35} textAnchor="end" />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(35,95,246,0.04)" }} />
        <Bar dataKey={dataKey} fill="#235FF6" radius={[4, 4, 0, 0]} />
      </ReBarChart>
    </ResponsiveContainer>
  );
}

export function PieChartCard({ data, dataKey, nameKey = "name", height = 280 }: ChartProps & { dataKey: string; nameKey?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RePieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          outerRadius={75}
          innerRadius={40}
          dataKey={dataKey}
          nameKey={nameKey}
          stroke="#FFFFFF"
          strokeWidth={2}
          label={({ name, percent }) => {
            const short = name.length > 12 ? name.slice(0, 12) + "…" : name;
            return `${short} ${(percent * 100).toFixed(0)}%`;
          }}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend
          wrapperStyle={{ fontSize: "11px", color: "#475569" }}
        />
      </RePieChart>
    </ResponsiveContainer>
  );
}

export function LineChartCard({ data, lines, height = 280 }: ChartProps & { lines: { key: string; color?: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReLineChart data={data} margin={{ top: 4, right: 4, bottom: 30, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={axisStyle}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          angle={-35}
          textAnchor="end"
          tickFormatter={(v: string) => {
            const d = new Date(v + "T00:00:00");
            return isNaN(d.getTime()) ? v : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          }}
        />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: "11px", color: "#475569" }} />
        {lines.map((l, i) => (
          <Line
            key={l.key}
            type="monotone"
            dataKey={l.key}
            stroke={l.color || COLORS[i]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: l.color || COLORS[i], stroke: "#FFFFFF", strokeWidth: 2 }}
          />
        ))}
      </ReLineChart>
    </ResponsiveContainer>
  );
}

export function AreaChartCard({ data, dataKey, height = 280, color = "#235FF6" }: ChartProps & { dataKey: string; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReAreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
        <defs>
          <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.15} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
        <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#grad-${dataKey})`} />
      </ReAreaChart>
    </ResponsiveContainer>
  );
}

export function MetricCard({ label, value, sub, color = "text-text-primary" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-5 transition-all duration-300 hover:border-border-strong hover:shadow-card group">
      <p className="text-[11px] uppercase tracking-wider text-text-muted font-semibold mb-2 font-body">{label}</p>
      <p className={`text-2xl font-bold font-display tracking-tight ${color}`}>{value}</p>
      {sub && <p className="text-xs text-text-muted mt-1.5">{sub}</p>}
    </div>
  );
}
