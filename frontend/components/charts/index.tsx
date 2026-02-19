"use client";

import {
  BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart as RePieChart, Pie, Cell,
  LineChart as ReLineChart, Line,
  AreaChart as ReAreaChart, Area,
} from "recharts";

const COLORS = ["#7C3AED", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#14B8A6"];

interface ChartProps {
  data: any[];
  height?: number;
}

export function BarChartCard({ data, dataKey, nameKey = "name", height = 300 }: ChartProps & { dataKey: string; nameKey?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis dataKey={nameKey} tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey={dataKey} fill="#7C3AED" radius={[4, 4, 0, 0]} />
      </ReBarChart>
    </ResponsiveContainer>
  );
}

export function PieChartCard({ data, dataKey, nameKey = "name", height = 300 }: ChartProps & { dataKey: string; nameKey?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RePieChart>
        <Pie data={data} cx="50%" cy="50%" outerRadius={100} dataKey={dataKey} nameKey={nameKey} label>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </RePieChart>
    </ResponsiveContainer>
  );
}

export function LineChartCard({ data, lines, height = 300 }: ChartProps & { lines: { key: string; color?: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReLineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        {lines.map((l, i) => (
          <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color || COLORS[i]} strokeWidth={2} dot={false} />
        ))}
      </ReLineChart>
    </ResponsiveContainer>
  );
}

export function AreaChartCard({ data, dataKey, height = 300, color = "#7C3AED" }: ChartProps & { dataKey: string; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReAreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Area type="monotone" dataKey={dataKey} stroke={color} fill={color} fillOpacity={0.1} />
      </ReAreaChart>
    </ResponsiveContainer>
  );
}

export function MetricCard({ label, value, sub, color = "text-gong-slate" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border p-5">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}
