"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricCard, LineChartCard } from "@/components/charts";

interface SLAData {
  total_requests: number;
  error_count: number;
  latency: { p50_ms: number | null; p95_ms: number | null; p99_ms: number | null };
  error_rate_pct: number;
  uptime_pct: number;
  by_model: {
    model: string;
    request_count: number;
    error_count: number;
    error_rate_pct: number;
    avg_latency_ms: number;
  }[];
  hourly_trend: {
    hour: string;
    request_count: number;
    avg_latency_ms: number;
    error_count: number;
  }[];
  alerts: { type: string; value: number; threshold: number }[];
  thresholds: Record<string, number>;
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gong-purple border-t-transparent" />
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

function LatencyGauge({ label, value, threshold }: { label: string; value: number | null; threshold: number }) {
  const v = value ?? 0;
  const pct = Math.min((v / threshold) * 100, 100);
  const color = pct > 90 ? "bg-gong-danger" : pct > 70 ? "bg-gong-warning" : "bg-gong-success";

  return (
    <div className="bg-surface-2/60 rounded-xl border border-border p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">{label}</p>
        <p className="text-xs text-text-muted">Target: {threshold}ms</p>
      </div>
      <p className="text-3xl font-bold text-text-primary">{v.toFixed(0)}ms</p>
      <div className="w-full bg-surface-3 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function SLADashboard() {
  const [modelFilter, setModelFilter] = useState<string>("all");

  const { data, isLoading, isError, error } = useQuery<SLAData>({
    queryKey: ["governance", "sla"],
    queryFn: () => apiFetch("/governance/sla"),
    refetchInterval: 15_000,
  });

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorBox message={`Failed to load SLA data: ${(error as Error).message}`} />;

  const d = data!;
  const models = d.by_model.map((m) => m.model);
  const filteredModels = modelFilter === "all" ? d.by_model : d.by_model.filter((m) => m.model === modelFilter);

  const alertMessages: { type: string; message: string; severity: string }[] = d.alerts.map((a) => ({
    type: a.type,
    message: `${a.type.replace(/_/g, " ").toUpperCase()}: ${a.value.toFixed(1)} exceeds threshold of ${a.threshold}`,
    severity: a.type.includes("p99") || a.type === "error_rate" ? "critical" : "warning",
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-text-primary">SLA Monitor</h1>
          <p className="text-sm text-text-secondary mt-1">Real-time latency, error rates, and uptime tracking</p>
        </div>
        <select
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
          className="rounded-lg bg-surface-3 border border-border text-text-primary px-3 py-2 text-sm focus:outline-none focus:border-gong-purple focus:ring-1 focus:ring-gong-purple/30"
        >
          <option value="all">All Models</option>
          {models.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* Global Latency Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <LatencyGauge label="P50 Latency" value={d.latency.p50_ms} threshold={500} />
        <LatencyGauge label="P95 Latency" value={d.latency.p95_ms} threshold={d.thresholds.p95_latency_ms} />
        <LatencyGauge label="P99 Latency" value={d.latency.p99_ms} threshold={d.thresholds.p99_latency_ms} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MetricCard
          label="Error Rate"
          value={`${d.error_rate_pct.toFixed(2)}%`}
          sub={`${d.error_count} errors / ${d.total_requests.toLocaleString()} requests`}
          color={d.error_rate_pct > 1 ? "text-gong-danger" : "text-gong-success"}
        />
        <MetricCard
          label="Uptime"
          value={`${d.uptime_pct.toFixed(2)}%`}
          sub="Rolling period"
          color={d.uptime_pct >= 99.0 ? "text-gong-success" : "text-gong-warning"}
        />
      </div>

      {/* Alerts */}
      {alertMessages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Alerts
              <Badge variant="red">{alertMessages.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alertMessages.map((alert, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between rounded-lg border p-3 text-sm ${
                    alert.severity === "critical"
                      ? "border-gong-danger/20 bg-gong-danger/10"
                      : "border-gong-warning/20 bg-gong-warning/10"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={alert.severity === "critical" ? "red" : "yellow"}>
                      {alert.severity}
                    </Badge>
                    <span className="text-text-primary">{alert.message}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hourly Trend */}
      {d.hourly_trend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Latency & Error Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChartCard
              data={d.hourly_trend.map((h) => ({
                name: h.hour.slice(11) || h.hour,
                latency: h.avg_latency_ms,
                errors: h.error_count,
              }))}
              lines={[
                { key: "latency", color: "#235FF6" },
                { key: "errors", color: "#EF4444" },
              ]}
            />
          </CardContent>
        </Card>
      )}

      {/* Per-Model Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredModels.map((model) => (
          <Card key={model.model}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {model.model}
                <Badge variant={model.error_rate_pct > 1 ? "red" : "green"}>
                  {model.error_rate_pct.toFixed(2)}% errors
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-xs text-text-secondary">Requests</p>
                  <p className="text-lg font-semibold text-text-primary">{model.request_count}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-text-secondary">Avg Latency</p>
                  <p className="text-lg font-semibold text-text-primary">{model.avg_latency_ms.toFixed(0)}ms</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-text-secondary">Errors</p>
                  <p className="text-lg font-semibold text-gong-danger">{model.error_count}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
