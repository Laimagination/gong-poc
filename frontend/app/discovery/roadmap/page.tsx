"use client";

import { useQuery } from "@tanstack/react-query";
import { Map, Calendar, TrendingUp, Sparkles, Clock, Zap, Target } from "lucide-react";
import { apiFetch } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/charts";

/* ---------- types (matching backend) ---------- */
interface RoadmapItem {
  backlog_id: string;
  workflow_id: string;
  title: string;
  department: string;
  effort: string;
  composite_score: number;
  estimated_roi_usd: number;
  jim_principles: string[];
}

interface RoadmapPhase {
  phase: number;
  name: string;
  weeks: string;
  description: string;
  items: RoadmapItem[];
  total_roi_usd: number;
  total_build_hours: number;
}

interface RoadmapData {
  phases: RoadmapPhase[];
  total_roi_usd: number;
  total_items: number;
}

/* ---------- helpers ---------- */
const DEPT_COLORS: Record<string, "purple" | "cyan" | "green" | "yellow" | "red"> = {
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

const EFFORT_COLORS: Record<string, "green" | "yellow" | "red" | "purple"> = {
  S: "green",
  M: "yellow",
  L: "red",
  XL: "purple",
};

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

function deptLabel(id: string): string {
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface PhaseConfig {
  icon: typeof Zap;
  color: string;
  bgColor: string;
  borderColor: string;
  headerBg: string;
  barColor: string;
}

const PHASE_CONFIGS: PhaseConfig[] = [
  {
    icon: Zap,
    color: "text-green-400",
    bgColor: "bg-green-500/5",
    borderColor: "border-green-500/20",
    headerBg: "bg-green-500/10",
    barColor: "bg-green-500",
  },
  {
    icon: Target,
    color: "text-blue-400",
    bgColor: "bg-blue-500/5",
    borderColor: "border-blue-500/20",
    headerBg: "bg-blue-500/10",
    barColor: "bg-blue-500",
  },
  {
    icon: Clock,
    color: "text-purple-400",
    bgColor: "bg-purple-500/5",
    borderColor: "border-purple-500/20",
    headerBg: "bg-purple-500/10",
    barColor: "bg-purple-500",
  },
];

/* ---------- component ---------- */
export default function RoadmapPage() {
  const { data: roadmap, isLoading, error } = useQuery<RoadmapData>({
    queryKey: ["discovery-roadmap"],
    queryFn: () => apiFetch("/discovery/roadmap"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gong-purple" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-400 font-medium mb-1">Failed to load roadmap</p>
          <p className="text-sm text-text-muted">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  if (!roadmap) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="opacity-0 animate-fade-up">
        <h1 className="text-2xl font-bold font-display text-text-primary flex items-center gap-2">
          <Map size={24} className="text-gong-purple" />
          90-Day Automation Roadmap
        </h1>
        <p className="text-text-secondary mt-1">
          Phased implementation plan aligned to Jim Gearhart&apos;s IT philosophy
        </p>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 opacity-0 animate-fade-up stagger-1">
        <MetricCard
          label="Total Projected Savings"
          value={formatCurrency(roadmap.total_roi_usd)}
          sub={`${roadmap.total_items} items across 3 phases`}
          color="text-gong-success"
        />
        {roadmap.phases.map((phase, i) => {
          const colors = ["text-green-400", "text-blue-400", "text-purple-400"];
          return (
            <MetricCard
              key={phase.phase}
              label={`${phase.name} ROI`}
              value={formatCurrency(phase.total_roi_usd)}
              sub={`${phase.items.length} items | Weeks ${phase.weeks}`}
              color={colors[i]}
            />
          );
        })}
      </div>

      {/* Progress overview */}
      <Card className="opacity-0 animate-fade-up stagger-2">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <Calendar size={16} className="text-text-muted" />
            <span className="text-sm font-medium text-text-secondary">Phase Distribution</span>
            <span className="text-xs text-text-muted ml-auto">{roadmap.total_items} total items</span>
          </div>
          <div className="flex h-3 rounded-full overflow-hidden bg-surface-3">
            {roadmap.phases.map((phase, i) => {
              const pct = roadmap.total_items > 0 ? (phase.items.length / roadmap.total_items) * 100 : 0;
              return (
                <div
                  key={phase.phase}
                  className={`${PHASE_CONFIGS[i].barColor} transition-all`}
                  style={{ width: `${pct}%` }}
                  title={`${phase.name}: ${phase.items.length} items (${pct.toFixed(0)}%)`}
                />
              );
            })}
          </div>
          <div className="flex gap-4 mt-2">
            {roadmap.phases.map((phase, i) => (
              <div key={phase.phase} className="flex items-center gap-1.5 text-xs text-text-muted">
                <div className={`w-2 h-2 rounded-full ${PHASE_CONFIGS[i].barColor}`} />
                {phase.name} ({phase.items.length})
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 opacity-0 animate-fade-up stagger-3">
        {roadmap.phases.map((phase, phaseIdx) => {
          const cfg = PHASE_CONFIGS[phaseIdx];
          const Icon = cfg.icon;

          return (
            <div key={phase.phase} className="flex flex-col">
              <div className={`rounded-t-xl ${cfg.headerBg} ${cfg.borderColor} border-2 border-b-0 p-4`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={18} className={cfg.color} />
                  <h2 className={`font-bold font-display ${cfg.color}`}>{phase.name}</h2>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Weeks {phase.weeks}</span>
                  <span className="text-xs font-medium text-text-secondary">{phase.items.length} items</span>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp size={12} className={cfg.color} />
                  <span className={`text-sm font-bold ${cfg.color}`}>{formatCurrency(phase.total_roi_usd)}</span>
                  <span className="text-[10px] text-text-muted">projected ROI</span>
                </div>
              </div>

              <div className={`flex-1 rounded-b-xl ${cfg.bgColor} ${cfg.borderColor} border-2 border-t-0 p-3 space-y-3 min-h-[200px]`}>
                {phase.items.map((item) => (
                  <RoadmapCard key={item.backlog_id} item={item} />
                ))}
                {phase.items.length === 0 && (
                  <div className="flex items-center justify-center h-24 text-sm text-text-muted">
                    No items in this phase
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- RoadmapCard ---------- */
function RoadmapCard({ item }: { item: RoadmapItem }) {
  const deptVariant = DEPT_COLORS[item.department] ?? "default";
  const effortVariant = EFFORT_COLORS[item.effort] ?? "default";

  return (
    <div className="bg-surface-2/60 rounded-lg border border-border hover:border-border-strong shadow-sm p-3 hover:shadow-md transition-all">
      <h3 className="text-sm font-medium text-text-primary leading-tight mb-2 line-clamp-2">
        {item.title}
      </h3>
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <Badge variant={deptVariant}>{deptLabel(item.department)}</Badge>
        <Badge variant={effortVariant}>{item.effort}</Badge>
      </div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-text-muted">Score:</span>
          <span className="text-sm font-bold text-gong-purple">{item.composite_score.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-1">
          <TrendingUp size={12} className="text-gong-success" />
          <span className="text-sm font-semibold text-gong-success">{formatCurrency(item.estimated_roi_usd)}</span>
        </div>
      </div>
      {item.jim_principles.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.jim_principles.map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-0.5 text-[9px] rounded px-1.5 py-0.5 bg-amber-500/10 text-amber-400"
            >
              <Sparkles size={8} />
              {p.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
