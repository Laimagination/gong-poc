"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/charts";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";

/* ---------- types ---------- */
interface DashboardResponse {
  total_projects: number;
  by_status: Record<string, number>;
  by_risk_level: Record<string, number>;
  by_department: Record<string, number>;
  overdue_reviews: number;
  avg_risk_score: number;
  avg_benefit_score: number;
}

interface TimelineEvent {
  id: number;
  project_id: number;
  project_name: string;
  timestamp: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  actor: string;
  detail: string | null;
}

/* ---------- constants ---------- */
const tooltipStyle = {
  backgroundColor: "#FFFFFF",
  border: "1px solid rgba(0,0,0,0.1)",
  borderRadius: "8px",
  boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
  fontSize: "12px",
  color: "#0F172A",
};

const axisStyle = { fontSize: 11, fill: "#94A3B8" };

const STATUS_COLORS: Record<string, string> = {
  proposed: "#64748B",
  impact_assessed: "#3B82F6",
  approved: "#10B981",
  in_development: "#F59E0B",
  deployed: "#22C55E",
  monitoring: "#06B6D4",
  under_review: "#F97316",
  on_hold: "#EF4444",
  retired: "#94A3B8",
};

const RISK_COLORS: Record<string, string> = {
  low: "#10B981",
  medium: "#F59E0B",
  high: "#F97316",
  critical: "#EF4444",
};

const EVENT_BADGE_VARIANT: Record<string, "purple" | "cyan" | "green" | "yellow" | "red" | "default"> = {
  status_change: "purple",
  assessment: "yellow",
  approval: "green",
  review: "cyan",
  incident: "red",
};

/* ---------- helpers ---------- */
function statusLabel(id: string): string {
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gong-purple" />
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-gong-danger/20 bg-gong-danger/10 p-4 text-sm text-gong-danger">
      {message}
    </div>
  );
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

/* ---------- component ---------- */
export default function AIMSDashboard() {
  const dashboard = useQuery<DashboardResponse>({
    queryKey: ["aims", "dashboard"],
    queryFn: () => apiFetch("/aims/dashboard"),
  });

  const timeline = useQuery<TimelineEvent[]>({
    queryKey: ["aims", "timeline"],
    queryFn: () => apiFetch("/aims/timeline?limit=10"),
  });

  /* derived chart data */
  const statusData = useMemo(() => {
    if (!dashboard.data) return [];
    return Object.entries(dashboard.data.by_status).map(([key, value]) => ({
      name: statusLabel(key),
      count: value,
      key,
    }));
  }, [dashboard.data]);

  const riskData = useMemo(() => {
    if (!dashboard.data) return [];
    return Object.entries(dashboard.data.by_risk_level).map(([key, value]) => ({
      name: statusLabel(key),
      count: value,
      key,
    }));
  }, [dashboard.data]);

  const deployedCount = useMemo(() => {
    if (!dashboard.data) return 0;
    return (dashboard.data.by_status["deployed"] ?? 0) +
      (dashboard.data.by_status["monitoring"] ?? 0);
  }, [dashboard.data]);

  if (dashboard.isLoading) return <Spinner />;
  if (dashboard.isError)
    return <ErrorBox message={`Failed to load dashboard: ${(dashboard.error as Error).message}`} />;

  const d = dashboard.data!;

  const riskColor =
    d.avg_risk_score < 4
      ? "text-gong-success"
      : d.avg_risk_score <= 6
        ? "text-gong-warning"
        : "text-gong-danger";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-text-primary">AIMS Dashboard</h1>
        <p className="text-sm text-text-secondary mt-1">
          AI Impact Assessment &amp; Lifecycle Management
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Projects"
          value={String(d.total_projects)}
          sub="Across 10 departments"
          color="text-gong-purple"
        />
        <MetricCard
          label="Deployed"
          value={String(deployedCount)}
          sub="Deployed + monitoring"
          color="text-gong-accent"
        />
        <MetricCard
          label="Avg Risk Score"
          value={d.avg_risk_score.toFixed(1)}
          sub={`Out of 10.0`}
          color={riskColor}
        />
        <MetricCard
          label="Overdue Reviews"
          value={String(d.overdue_reviews)}
          sub={d.overdue_reviews > 0 ? "Action required" : "All up to date"}
          color={d.overdue_reviews > 0 ? "text-gong-danger" : "text-gong-success"}
        />
      </div>

      {/* Overdue Alert Banner */}
      {d.overdue_reviews > 0 && (
        <div className="rounded-lg border border-gong-warning/30 bg-gong-warning/10 p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gong-warning/20 flex items-center justify-center shrink-0">
            <span className="text-gong-warning text-lg font-bold">!</span>
          </div>
          <div>
            <p className="text-sm font-medium text-gong-warning">
              {d.overdue_reviews} project{d.overdue_reviews !== 1 ? "s have" : " has"} overdue reviews
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              ISO 42001 requires periodic impact re-assessment. Please schedule reviews promptly.
            </p>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Projects by Status - Horizontal Bar */}
        <Card>
          <CardHeader>
            <CardTitle>Projects by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={statusData}
                layout="vertical"
                margin={{ top: 4, right: 20, bottom: 0, left: 10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(0,0,0,0.06)"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={axisStyle}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={axisStyle}
                  axisLine={false}
                  tickLine={false}
                  width={100}
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(35,95,246,0.04)" }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                  {statusData.map((entry, i) => (
                    <Cell
                      key={`status-${i}`}
                      fill={STATUS_COLORS[entry.key] ?? "#235FF6"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Risk Distribution - Pie */}
        <Card>
          <CardHeader>
            <CardTitle>Risk Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={riskData}
                  cx="50%"
                  cy="50%"
                  outerRadius={95}
                  innerRadius={50}
                  dataKey="count"
                  nameKey="name"
                  stroke="#FFFFFF"
                  strokeWidth={2}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {riskData.map((entry, i) => (
                    <Cell
                      key={`risk-${i}`}
                      fill={RISK_COLORS[entry.key] ?? "#235FF6"}
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend
                  wrapperStyle={{ fontSize: "11px", color: "#475569" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {timeline.isLoading && (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gong-purple" />
            </div>
          )}
          {timeline.isError && (
            <div className="rounded-lg border border-gong-danger/20 bg-gong-danger/10 p-3 text-sm text-gong-danger">
              Failed to load timeline
            </div>
          )}
          {timeline.data && timeline.data.length === 0 && (
            <p className="text-sm text-text-muted text-center py-8">No recent activity</p>
          )}
          {timeline.data && timeline.data.length > 0 && (
            <div className="relative">
              {/* vertical timeline line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

              <div className="space-y-4">
                {timeline.data.map((event) => (
                  <div key={event.id} className="relative flex gap-4 pl-6">
                    {/* dot */}
                    <div className="absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full border-2 border-border bg-surface-2 z-10" />

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-text-primary truncate">
                          {event.project_name}
                        </span>
                        <Badge variant={EVENT_BADGE_VARIANT[event.event_type] ?? "default"}>
                          {statusLabel(event.event_type)}
                        </Badge>
                      </div>

                      {event.detail && (
                        <p className="text-xs text-text-secondary mb-1">{event.detail}</p>
                      )}

                      {event.from_status && event.to_status && (
                        <p className="text-xs text-text-muted">
                          {statusLabel(event.from_status)} &rarr; {statusLabel(event.to_status)}
                        </p>
                      )}

                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[11px] text-text-muted">
                          {formatTimestamp(event.timestamp)}
                        </span>
                        <span className="text-[11px] text-text-muted">&middot;</span>
                        <span className="text-[11px] text-text-muted">{event.actor}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
