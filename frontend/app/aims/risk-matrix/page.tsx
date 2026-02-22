"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  ZAxis,
} from "recharts";

/* ---------- types ---------- */
interface RiskMatrixItem {
  id: number;
  name: string;
  department: string;
  status: string;
  risk_score: number;
  benefit_score: number;
  risk_level: string;
}

interface ProjectDetail {
  id: number;
  workflow_id: string;
  name: string;
  department: string;
  status: string;
  risk_level: string;
  risk_score: number;
  benefit_score: number;
  owner: string;
  controls: string[];
  review_due: string | null;
  impact_stakeholder?: number;
  impact_ethical?: number;
  impact_legal?: number;
  impact_operational?: number;
}

/* ---------- constants ---------- */
const DEPT_COLORS: Record<string, string> = {
  sales: "#06B6D4",
  customer_success: "#10B981",
  marketing: "#F59E0B",
  support: "#8B5CF6",
  engineering: "#235FF6",
  product: "#EF4444",
  finance: "#14B8A6",
  legal: "#F97316",
  people_hr: "#EC4899",
  it: "#6366F1",
};

const tooltipStyle = {
  backgroundColor: "#FFFFFF",
  border: "1px solid rgba(0,0,0,0.1)",
  borderRadius: "8px",
  boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
  fontSize: "12px",
  color: "#0F172A",
};

const axisStyle = { fontSize: 11, fill: "#94A3B8" };

const RISK_BADGE_VARIANT: Record<string, "green" | "yellow" | "red" | "default"> = {
  low: "green",
  medium: "yellow",
  high: "red",
  critical: "red",
};

const STATUS_BADGE_VARIANT: Record<string, "purple" | "cyan" | "green" | "yellow" | "red" | "default"> = {
  proposed: "default",
  impact_assessed: "cyan",
  approved: "green",
  in_development: "yellow",
  deployed: "purple",
  monitoring: "cyan",
  under_review: "yellow",
  on_hold: "red",
  retired: "default",
};

const DEPT_BADGE_VARIANT: Record<string, "purple" | "cyan" | "green" | "yellow" | "red"> = {
  engineering: "purple",
  sales: "cyan",
  customer_success: "green",
  marketing: "yellow",
  finance: "red",
  people_hr: "purple",
  it: "cyan",
  support: "green",
  legal: "yellow",
  product: "red",
};

/* ---------- helpers ---------- */
const ACRONYMS = new Set(["it", "hr", "qa"]);
function deptLabel(id: string): string {
  if (ACRONYMS.has(id.toLowerCase())) return id.toUpperCase();
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

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

/* ---------- impact bar sub-component ---------- */
function ImpactBar({ label, value, max = 10 }: { label: string; value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const color =
    value < 4 ? "bg-gong-success" : value <= 6 ? "bg-gong-warning" : "bg-gong-danger";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-text-secondary">{label}</span>
        <span className="text-text-muted tabular-nums">{value.toFixed(1)}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-surface-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ---------- main component ---------- */
export default function RiskMatrixPage() {
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  /* fetch risk matrix */
  const {
    data: matrixData,
    isLoading,
    isError,
    error,
  } = useQuery<RiskMatrixItem[]>({
    queryKey: ["aims", "risk-matrix"],
    queryFn: () => apiFetch("/aims/risk-matrix"),
  });

  /* fetch selected project detail */
  const projectDetail = useQuery<ProjectDetail>({
    queryKey: ["aims", "project", selectedId],
    queryFn: () => apiFetch(`/aims/projects/${selectedId}`),
    enabled: selectedId !== null,
  });

  /* derived filter options */
  const departments = useMemo(() => {
    if (!matrixData) return [];
    return [...new Set(matrixData.map((p) => p.department))].sort();
  }, [matrixData]);

  const statuses = useMemo(() => {
    if (!matrixData) return [];
    return [...new Set(matrixData.map((p) => p.status))].sort();
  }, [matrixData]);

  const riskLevels = useMemo(() => {
    if (!matrixData) return [];
    return [...new Set(matrixData.map((p) => p.risk_level))].sort();
  }, [matrixData]);

  /* filtered scatter data */
  const filtered = useMemo(() => {
    if (!matrixData) return [];
    return matrixData.filter((p) => {
      if (deptFilter !== "all" && p.department !== deptFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (riskFilter !== "all" && p.risk_level !== riskFilter) return false;
      return true;
    });
  }, [matrixData, deptFilter, statusFilter, riskFilter]);

  const scatterData = useMemo(() => {
    return filtered.map((p) => ({
      x: p.risk_score,
      y: p.benefit_score,
      z: 100,
      id: p.id,
      name: p.name,
      department: p.department,
      risk_level: p.risk_level,
      status: p.status,
    }));
  }, [filtered]);

  const handleDotClick = useCallback((data: any) => {
    if (data && data.id) {
      setSelectedId(data.id);
    }
  }, []);

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorBox message={`Failed to load risk matrix: ${(error as Error).message}`} />;

  const detail = projectDetail.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-text-primary">Risk-Benefit Matrix</h1>
        <p className="text-sm text-text-secondary mt-1">
          ISO 42005 Step 5 &mdash; Risk-Benefit Analysis
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-wrap gap-3">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="rounded-lg bg-surface-3 border border-border text-text-primary px-3 py-2 text-sm focus:outline-none focus:border-gong-purple focus:ring-1 focus:ring-gong-purple/30"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {deptLabel(d)}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg bg-surface-3 border border-border text-text-primary px-3 py-2 text-sm focus:outline-none focus:border-gong-purple focus:ring-1 focus:ring-gong-purple/30"
            >
              <option value="all">All Statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="rounded-lg bg-surface-3 border border-border text-text-primary px-3 py-2 text-sm focus:outline-none focus:border-gong-purple focus:ring-1 focus:ring-gong-purple/30"
            >
              <option value="all">All Risk Levels</option>
              {riskLevels.map((r) => (
                <option key={r} value={r}>
                  {statusLabel(r)}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Main Content: Scatter + Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Scatter Chart */}
        <div className="lg:col-span-7">
          <Card>
            <CardHeader>
              <CardTitle>Risk vs. Benefit Scatter</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {/* Quadrant labels */}
                <div className="absolute top-2 left-14 text-[10px] font-semibold text-gong-success/60 z-10 pointer-events-none select-none">
                  Fast Track
                </div>
                <div className="absolute top-2 right-6 text-[10px] font-semibold text-gong-warning/60 z-10 pointer-events-none select-none">
                  Mitigate &amp; Proceed
                </div>
                <div className="absolute bottom-10 left-14 text-[10px] font-semibold text-text-muted/40 z-10 pointer-events-none select-none">
                  Deprioritize
                </div>
                <div className="absolute bottom-10 right-6 text-[10px] font-semibold text-gong-danger/60 z-10 pointer-events-none select-none">
                  Reject
                </div>

                <ResponsiveContainer width="100%" height={420}>
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 30, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis
                      type="number"
                      dataKey="x"
                      name="Risk Score"
                      domain={[0, 10]}
                      tick={axisStyle}
                      axisLine={false}
                      tickLine={false}
                      label={{
                        value: "Risk Score",
                        position: "bottom",
                        offset: 10,
                        fontSize: 12,
                        fill: "#94A3B8",
                      }}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      name="Benefit Score"
                      domain={[0, 10]}
                      tick={axisStyle}
                      axisLine={false}
                      tickLine={false}
                      label={{
                        value: "Benefit Score",
                        angle: -90,
                        position: "insideLeft",
                        offset: 0,
                        fontSize: 12,
                        fill: "#94A3B8",
                      }}
                    />
                    <ZAxis type="number" dataKey="z" range={[60, 160]} />

                    {/* Reference lines creating quadrants */}
                    <ReferenceLine
                      x={5}
                      stroke="rgba(0,0,0,0.08)"
                      strokeDasharray="6 4"
                    />
                    <ReferenceLine
                      y={5}
                      stroke="rgba(0,0,0,0.08)"
                      strokeDasharray="6 4"
                    />

                    <ReTooltip
                      content={({ payload }) => {
                        if (!payload?.length) return null;
                        const p = payload[0].payload;
                        return (
                          <div
                            style={tooltipStyle}
                            className="p-2.5"
                          >
                            <p className="font-semibold text-text-primary text-[13px]">{p.name}</p>
                            <p className="text-text-muted text-[11px] mt-0.5">{deptLabel(p.department)}</p>
                            <div className="flex gap-3 mt-1.5 text-[11px]">
                              <span>Risk: <span className="text-text-primary font-medium">{p.x?.toFixed(1)}</span></span>
                              <span>Benefit: <span className="text-text-primary font-medium">{p.y?.toFixed(1)}</span></span>
                            </div>
                          </div>
                        );
                      }}
                    />

                    <Scatter
                      data={scatterData}
                      onClick={(data) => handleDotClick(data)}
                      cursor="pointer"
                    >
                      {scatterData.map((entry, i) => (
                        <Cell
                          key={`cell-${i}`}
                          fill={DEPT_COLORS[entry.department] ?? "#235FF6"}
                          fillOpacity={selectedId === entry.id ? 1 : 0.7}
                          stroke={selectedId === entry.id ? "#FFFFFF" : "transparent"}
                          strokeWidth={selectedId === entry.id ? 2 : 0}
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              {/* Department legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4 pt-4 border-t border-border">
                {departments.map((dept) => (
                  <div key={dept} className="flex items-center gap-1.5 text-[11px]">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: DEPT_COLORS[dept] ?? "#235FF6" }}
                    />
                    <span className="text-text-muted">{deptLabel(dept)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-5">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Project Detail</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedId === null && (
                <div className="flex flex-col items-center justify-center h-80 text-center">
                  <div className="w-12 h-12 rounded-full bg-surface-3 flex items-center justify-center mb-3">
                    <svg
                      className="w-6 h-6 text-text-muted"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                      />
                    </svg>
                  </div>
                  <p className="text-sm text-text-secondary font-medium">Select a project</p>
                  <p className="text-xs text-text-muted mt-1">
                    Click on any dot in the scatter chart to view project details
                  </p>
                </div>
              )}

              {selectedId !== null && projectDetail.isLoading && (
                <div className="flex items-center justify-center h-80">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gong-purple" />
                </div>
              )}

              {selectedId !== null && projectDetail.isError && (
                <div className="rounded-lg border border-gong-danger/20 bg-gong-danger/10 p-3 text-sm text-gong-danger">
                  Failed to load project details
                </div>
              )}

              {selectedId !== null && detail && (
                <div className="space-y-5">
                  {/* Project name & badges */}
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary font-display">
                      {detail.name}
                    </h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant={DEPT_BADGE_VARIANT[detail.department] ?? "default"}>
                        {deptLabel(detail.department)}
                      </Badge>
                      <Badge variant={STATUS_BADGE_VARIANT[detail.status] ?? "default"}>
                        {statusLabel(detail.status)}
                      </Badge>
                      <Badge variant={RISK_BADGE_VARIANT[detail.risk_level] ?? "default"}>
                        {statusLabel(detail.risk_level)} Risk
                      </Badge>
                    </div>
                  </div>

                  {/* Scores */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-surface-3/60 p-3 text-center">
                      <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1">
                        Risk Score
                      </p>
                      <p className={`text-xl font-bold ${
                        detail.risk_score < 4
                          ? "text-gong-success"
                          : detail.risk_score <= 6
                            ? "text-gong-warning"
                            : "text-gong-danger"
                      }`}>
                        {detail.risk_score.toFixed(1)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-surface-3/60 p-3 text-center">
                      <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1">
                        Benefit Score
                      </p>
                      <p className="text-xl font-bold text-gong-accent">
                        {detail.benefit_score.toFixed(1)}
                      </p>
                    </div>
                  </div>

                  {/* Impact bars */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
                      Impact Assessment
                    </p>
                    <div className="space-y-3">
                      <ImpactBar
                        label="Stakeholder Impact"
                        value={detail.impact_stakeholder ?? detail.risk_score * 0.8}
                      />
                      <ImpactBar
                        label="Ethical Impact"
                        value={detail.impact_ethical ?? detail.risk_score * 0.6}
                      />
                      <ImpactBar
                        label="Legal Impact"
                        value={detail.impact_legal ?? detail.risk_score * 0.7}
                      />
                      <ImpactBar
                        label="Operational Impact"
                        value={detail.impact_operational ?? detail.risk_score * 0.9}
                      />
                    </div>
                  </div>

                  {/* Controls */}
                  {detail.controls && detail.controls.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                        Controls
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {detail.controls.map((ctrl, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center rounded-md bg-surface-3 border border-border px-2 py-1 text-[11px] text-text-secondary"
                          >
                            {ctrl}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Owner & Review */}
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">
                        Owner
                      </p>
                      <p className="text-sm text-text-primary mt-0.5">{detail.owner}</p>
                    </div>
                    {detail.review_due && (
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">
                          Review Due
                        </p>
                        <p className={`text-sm mt-0.5 ${
                          new Date(detail.review_due) < new Date()
                            ? "text-gong-danger"
                            : "text-text-secondary"
                        }`}>
                          {new Date(detail.review_due).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
