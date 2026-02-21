"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MetricCard, BarChartCard, PieChartCard, LineChartCard } from "@/components/charts";
import { Badge } from "@/components/ui/badge";

interface CostData {
  grand_total_usd: number;
  by_department: { department: string; total_cost: number; total_tokens: number; request_count: number }[];
  by_model: { model: string; provider: string; total_cost: number; total_tokens: number; request_count: number }[];
  daily_trend: { date: string; total_cost: number; request_count: number }[];
  chargeback: { department: string; cost: number; share_pct: number }[];
}

interface ForecastData {
  avg_daily_cost: number;
  forecast: {
    "30_day": { blended: number };
    "60_day": { blended: number };
    "90_day": { blended: number };
  };
  monthly_budget_usd: number;
  mtd_cost_usd: number;
  budget_alerts: { level: string; message: string }[];
  daily_history: { date: string; cost: number; tokens: number }[];
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

export default function GovernanceDashboard() {
  const costs = useQuery<CostData>({
    queryKey: ["governance", "costs"],
    queryFn: () => apiFetch("/governance/costs"),
  });

  const forecast = useQuery<ForecastData>({
    queryKey: ["governance", "forecast"],
    queryFn: () => apiFetch("/governance/forecast"),
  });

  if (costs.isLoading || forecast.isLoading) return <Spinner />;
  if (costs.isError) return <ErrorBox message={`Failed to load cost data: ${(costs.error as Error).message}`} />;
  if (forecast.isError) return <ErrorBox message={`Failed to load forecast data: ${(forecast.error as Error).message}`} />;

  const c = costs.data!;
  const f = forecast.data!;

  const budgetPct = f.monthly_budget_usd > 0
    ? Math.round((f.mtd_cost_usd / f.monthly_budget_usd) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-text-primary">Cost Dashboard</h1>
        <p className="text-sm text-text-secondary mt-1">AI governance spend overview and forecasting</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Spend"
          value={`$${c.grand_total_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub="Current period"
          color="text-gong-purple"
        />
        <MetricCard
          label="Budget Used"
          value={`${budgetPct}%`}
          sub={`$${f.mtd_cost_usd.toLocaleString(undefined, { maximumFractionDigits: 2 })} / $${f.monthly_budget_usd.toLocaleString()}`}
          color={budgetPct > 80 ? "text-gong-danger" : "text-gong-success"}
        />
        <MetricCard
          label="Avg Cost / Day"
          value={`$${f.avg_daily_cost.toFixed(2)}`}
          sub="Across all departments"
          color="text-gong-accent"
        />
        <MetricCard
          label="30-Day Forecast"
          value={`$${f.forecast["30_day"].blended.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          sub={`60d: $${f.forecast["60_day"].blended.toLocaleString(undefined, { maximumFractionDigits: 0 })} | 90d: $${f.forecast["90_day"].blended.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          color="text-gong-warning"
        />
      </div>

      {/* Budget Alerts */}
      {f.budget_alerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {f.budget_alerts.map((alert, i) => (
            <Badge key={i} variant={alert.level === "critical" ? "red" : "yellow"}>
              {alert.message}
            </Badge>
          ))}
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Spend by Department</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChartCard
              data={c.by_department.map((d) => ({ name: d.department, spend: d.total_cost }))}
              dataKey="spend"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spend by Model</CardTitle>
          </CardHeader>
          <CardContent>
            <PieChartCard
              data={c.by_model.map((m) => ({ name: m.model, spend: m.total_cost }))}
              dataKey="spend"
            />
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Daily Spend Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChartCard
              data={c.daily_trend.map((d) => ({ name: d.date, spend: d.total_cost }))}
              lines={[{ key: "spend", color: "#235FF6" }]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Forecast Projection</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChartCard
              data={f.daily_history.map((d) => ({ name: d.date, actual: d.cost, forecast: f.avg_daily_cost }))}
              lines={[
                { key: "actual", color: "#235FF6" },
                { key: "forecast", color: "#06B6D4" },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
