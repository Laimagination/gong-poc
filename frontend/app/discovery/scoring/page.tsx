"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { SlidersHorizontal, ArrowUp, ArrowDown, Minus, Save, RotateCcw } from "lucide-react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  ZAxis,
  Cell,
} from "recharts";
import { apiFetch } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/* ---------- types ---------- */
interface WorkflowScores {
  revenue_impact: number;
  headcount_pressure: number;
  implementation_complexity: number;
  self_service_potential: number;
  composite: number;
}

interface ScoredWorkflow {
  id: string;
  name: string;
  department: string;
  description: string;
  scores: WorkflowScores;
  annual_cost_savings_usd: number;
  estimated_build_hours: number;
  jim_principles: string[];
  rank: number;
}

interface WorkflowsResponse {
  workflows: ScoredWorkflow[];
  weights: Weights;
  total_annual_savings_usd: number;
}

interface Weights {
  revenue_impact: number;
  headcount_pressure: number;
  implementation_complexity: number;
  self_service_potential: number;
}

const DEFAULT_WEIGHTS: Weights = {
  revenue_impact: 0.30,
  headcount_pressure: 0.20,
  implementation_complexity: 0.25,
  self_service_potential: 0.25,
};

const WEIGHT_LABELS: Record<keyof Weights, string> = {
  revenue_impact: "Revenue Impact",
  headcount_pressure: "Headcount Pressure",
  implementation_complexity: "Implementation Complexity",
  self_service_potential: "Self-Service Potential",
};

const WEIGHT_DESCRIPTIONS: Record<keyof Weights, string> = {
  revenue_impact: "Revenue growth or cost reduction potential",
  headcount_pressure: "Open roles and hiring difficulty in the department",
  implementation_complexity: "Ease of implementation (higher = simpler)",
  self_service_potential: "Potential for employee self-service adoption",
};

const COLORS = ["#235FF6", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#14B8A6"];

function getDeptColor(dept: string, allDepts: string[]): string {
  const idx = allDepts.indexOf(dept);
  return COLORS[idx % COLORS.length];
}

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

const ACRONYMS = new Set(["it", "hr", "qa"]);
function deptLabel(id: string): string {
  if (ACRONYMS.has(id.toLowerCase())) return id.toUpperCase();
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function effortFromHours(hours: number): string {
  if (hours <= 40) return "S";
  if (hours <= 70) return "M";
  if (hours <= 100) return "L";
  return "XL";
}

/* ---------- component ---------- */
export default function ScoringExplorerPage() {
  const queryClient = useQueryClient();
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [prevRanking, setPrevRanking] = useState<Map<string, number>>(new Map());
  const isInitialLoad = useRef(true);

  const { data, isLoading, error } = useQuery<WorkflowsResponse>({
    queryKey: ["discovery-workflows"],
    queryFn: () => apiFetch("/discovery/workflows"),
  });

  const workflows = data?.workflows ?? [];

  // Track previous ranking for movement indicators
  useEffect(() => {
    if (workflows.length > 0 && isInitialLoad.current) {
      const ranking = new Map<string, number>();
      workflows.forEach((o, i) => ranking.set(o.id, i));
      setPrevRanking(ranking);
      isInitialLoad.current = false;
    }
  }, [workflows]);

  // Initialize weights from backend
  useEffect(() => {
    if (data?.weights) {
      setWeights(data.weights);
    }
  }, [data?.weights]);

  // Client-side re-ranking: recompute composite scores and re-sort whenever weights change
  const rankedWorkflows = useMemo(() => {
    if (!workflows.length) return [];
    return workflows
      .map((wf) => {
        const composite = parseFloat(
          (
            weights.revenue_impact * wf.scores.revenue_impact +
            weights.headcount_pressure * wf.scores.headcount_pressure +
            weights.implementation_complexity * wf.scores.implementation_complexity +
            weights.self_service_potential * wf.scores.self_service_potential
          ).toFixed(2)
        );
        return { ...wf, scores: { ...wf.scores, composite } };
      })
      .sort((a, b) => b.scores.composite - a.scores.composite);
  }, [workflows, weights]);

  const saveMutation = useMutation({
    mutationFn: (w: Weights) =>
      apiFetch("/discovery/score-weights", {
        method: "PUT",
        body: JSON.stringify(w),
      }),
    onSuccess: () => {
      // Snapshot current live ranking as the baseline for movement arrows
      const ranking = new Map<string, number>();
      rankedWorkflows.forEach((o, i) => ranking.set(o.id, i));
      setPrevRanking(ranking);
      queryClient.invalidateQueries({ queryKey: ["discovery-workflows"] });
      queryClient.invalidateQueries({ queryKey: ["discovery-backlog"] });
    },
  });

  const handleWeightChange = useCallback(
    (key: keyof Weights, value: number) => {
      setWeights((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleReset = useCallback(() => {
    const ranking = new Map<string, number>();
    rankedWorkflows.forEach((o, i) => ranking.set(o.id, i));
    setPrevRanking(ranking);
    setWeights(DEFAULT_WEIGHTS);
  }, [rankedWorkflows]);

  const totalWeight = Object.values(weights).reduce((s, v) => s + v, 0);

  const allDepts = useMemo(() => {
    return [...new Set(workflows.map((o) => o.department))].sort();
  }, [workflows]);

  const scatterData = useMemo(() => {
    return rankedWorkflows.map((o) => ({
      x: o.scores.composite,
      y: o.annual_cost_savings_usd,
      name: o.name,
      department: o.department,
      z: 80,
    }));
  }, [rankedWorkflows]);

  if (isLoading && !workflows.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gong-purple" />
      </div>
    );
  }

  if (error && !workflows.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 font-medium mb-1">Failed to load scoring data</p>
          <p className="text-sm text-text-muted">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="opacity-0 animate-fade-up">
        <h1 className="text-2xl font-bold font-display text-text-primary flex items-center gap-2">
          <SlidersHorizontal size={24} className="text-gong-purple" />
          Scoring Explorer
        </h1>
        <p className="text-text-secondary mt-1">
          Adjust scoring weights and see real-time re-ranking of automation opportunities
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 opacity-0 animate-fade-up stagger-1">
        {/* Left: weight sliders */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                Scoring Weights
                <span className="text-xs font-normal text-text-muted">
                  Total: {(totalWeight * 100).toFixed(0)}%
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {(Object.keys(weights) as Array<keyof Weights>).map((key) => (
                <WeightSlider
                  key={key}
                  label={WEIGHT_LABELS[key]}
                  description={WEIGHT_DESCRIPTIONS[key]}
                  value={weights[key]}
                  onChange={(v) => handleWeightChange(key, v)}
                />
              ))}

              {Math.abs(totalWeight - 1) > 0.01 && (
                <div className="text-xs text-amber-600 bg-amber-500/10 rounded-lg p-2">
                  Weights sum to {(totalWeight * 100).toFixed(0)}%. Consider adjusting to total 100%.
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => saveMutation.mutate(weights)}
                  disabled={saveMutation.isPending || Math.abs(totalWeight - 1) > 0.01}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-gong-purple rounded-lg hover:bg-gong-purple-dark transition-colors disabled:opacity-50"
                >
                  <Save size={14} />
                  {saveMutation.isPending ? "Saving..." : "Save & Re-rank"}
                </button>
                <button
                  onClick={handleReset}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-text-secondary bg-surface-3 border border-border rounded-lg hover:text-text-primary hover:border-border-strong transition-colors"
                >
                  <RotateCcw size={14} />
                  Reset
                </button>
              </div>

              {saveMutation.isSuccess && (
                <p className="text-xs text-green-600">Weights saved and rankings updated</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Department Legend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {allDepts.map((dept) => (
                  <div key={dept} className="flex items-center gap-2 text-sm">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getDeptColor(dept, allDepts) }}
                    />
                    <span className="text-text-secondary">{deptLabel(dept)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: results */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Score vs. ROI</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name="Score"
                    tick={{ fontSize: 12, fill: "#94A3B8" }}
                    stroke="rgba(0,0,0,0.06)"
                    label={{ value: "Composite Score", position: "bottom", fontSize: 12, fill: "#94A3B8" }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="ROI"
                    tick={{ fontSize: 12, fill: "#94A3B8" }}
                    stroke="rgba(0,0,0,0.06)"
                    tickFormatter={(v: number) => formatCurrency(v)}
                    label={{ value: "Est. ROI", angle: -90, position: "insideLeft", fontSize: 12, fill: "#94A3B8" }}
                  />
                  <ZAxis type="number" dataKey="z" range={[40, 120]} />
                  <ReTooltip
                    content={({ payload }) => {
                      if (!payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-surface-3 border border-border rounded-lg p-2 shadow-lg text-xs">
                          <p className="font-semibold text-text-primary">{d.name}</p>
                          <p className="text-text-muted">{deptLabel(d.department)}</p>
                          <p className="text-text-secondary">Score: {d.x?.toFixed(2)}</p>
                          <p className="text-text-secondary">ROI: {formatCurrency(d.y)}</p>
                        </div>
                      );
                    }}
                  />
                  <Scatter data={scatterData}>
                    {scatterData.map((entry, i) => (
                      <Cell key={`cell-${i}`} fill={getDeptColor(entry.department, allDepts)} fillOpacity={0.75} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Live Ranking
                <span className="text-xs font-normal text-text-muted ml-2">
                  {rankedWorkflows.length} opportunities
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {rankedWorkflows.map((wf, idx) => {
                  const prevIdx = prevRanking.get(wf.id);
                  const movement = prevIdx !== undefined ? prevIdx - idx : 0;
                  const effort = effortFromHours(wf.estimated_build_hours);

                  return (
                    <div
                      key={wf.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-surface-2/60 hover:bg-surface-3 border border-border hover:border-border-strong transition-all"
                    >
                      <div className="w-8 text-center">
                        <span className="text-sm font-bold text-text-muted">#{idx + 1}</span>
                      </div>

                      <div className="w-6 flex justify-center">
                        {movement > 0 ? (
                          <span className="flex items-center text-green-600">
                            <ArrowUp size={14} />
                            <span className="text-[10px] font-semibold">{movement}</span>
                          </span>
                        ) : movement < 0 ? (
                          <span className="flex items-center text-red-600">
                            <ArrowDown size={14} />
                            <span className="text-[10px] font-semibold">{Math.abs(movement)}</span>
                          </span>
                        ) : (
                          <Minus size={14} className="text-text-muted" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{wf.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge
                            variant={
                              ({
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
                              } as Record<string, "purple" | "cyan" | "green" | "yellow" | "red">)[wf.department] ?? "default"
                            }
                          >
                            {deptLabel(wf.department)}
                          </Badge>
                          <span className="text-[10px] text-text-muted">{effort} effort</span>
                        </div>
                      </div>

                      {/* Score breakdown mini bars */}
                      <div className="hidden sm:flex gap-1 items-end h-8">
                        {[
                          { val: wf.scores.revenue_impact / 10, label: "Rev" },
                          { val: wf.scores.headcount_pressure / 10, label: "HC" },
                          { val: wf.scores.implementation_complexity / 10, label: "Cplx" },
                          { val: wf.scores.self_service_potential / 10, label: "Self" },
                        ].map((b) => (
                          <div key={b.label} className="flex flex-col items-center gap-0.5">
                            <div
                              className="w-3 bg-gong-purple/70 rounded-sm transition-all"
                              style={{ height: `${b.val * 32}px` }}
                            />
                            <span className="text-[8px] text-text-muted">{b.label}</span>
                          </div>
                        ))}
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold text-gong-purple">{wf.scores.composite.toFixed(2)}</p>
                        <p className="text-[10px] text-gong-success font-medium">
                          {formatCurrency(wf.annual_cost_savings_usd)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ---------- WeightSlider ---------- */
function WeightSlider({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-text-secondary">{label}</label>
        <span className="text-sm font-semibold text-gong-purple">
          {(value * 100).toFixed(0)}%
        </span>
      </div>
      <p className="text-[11px] text-text-muted mb-2">{description}</p>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-surface-3 rounded-lg appearance-none cursor-pointer accent-gong-purple"
      />
      <div className="flex justify-between text-[10px] text-text-muted mt-0.5">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  );
}
