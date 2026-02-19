"use client";

import {
  BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart as RePieChart, Pie, Cell,
  LineChart as ReLineChart, Line,
  AreaChart as ReAreaChart, Area,
} from "recharts";

const COLORS = ["#7C3AED", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#14B8A6"];

const tooltipStyle = {
  backgroundColor: "#1A1F2E",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "8px",
  boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
  fontSize: "12px",
  color: "#F1F5F9",
};

const axisStyle = { fontSize: 11, fill: "#64748B" };

interface ChartProps {
  data: any[];
  height?: number;
}

export function BarChartCard({ data, dataKey, nameKey = "name", height = 280 }: ChartProps & { dataKey: string; nameKey?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis dataKey={nameKey} tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(124,58,237,0.06)" }} />
        <Bar dataKey={dataKey} fill="#7C3AED" radius={[4, 4, 0, 0]} />
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
          cy="50%"
          outerRadius={95}
          innerRadius={50}
          dataKey={dataKey}
          nameKey={nameKey}
          stroke="rgba(0,0,0,0.3)"
          strokeWidth={2}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend
          wrapperStyle={{ fontSize: "11px", color: "#94A3B8" }}
        />
      </RePieChart>
    </ResponsiveContainer>
  );
}

export function LineChartCard({ data, lines, height = 280 }: ChartProps & { lines: { key: string; color?: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReLineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: "11px", color: "#94A3B8" }} />
        {lines.map((l, i) => (
          <Line
            key={l.key}
            type="monotone"
            dataKey={l.key}
            stroke={l.color || COLORS[i]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: l.color || COLORS[i], stroke: "#0C1017", strokeWidth: 2 }}
          />
        ))}
      </ReLineChart>
    </ResponsiveContainer>
  );
}

export function AreaChartCard({ data, dataKey, height = 280, color = "#7C3AED" }: ChartProps & { dataKey: string; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReAreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
        <defs>
          <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
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
    <div className="rounded-xl border border-border bg-surface-2/60 backdrop-blur-sm p-5 transition-all duration-300 hover:border-border-strong hover:shadow-card group">
      <p className="text-[11px] uppercase tracking-wider text-text-muted font-semibold mb-2 font-body">{label}</p>
      <p className={`text-2xl font-bold font-display tracking-tight ${color}`}>{value}</p>
      {sub && <p className="text-xs text-text-muted mt-1.5">{sub}</p>}
    </div>
  );
}
