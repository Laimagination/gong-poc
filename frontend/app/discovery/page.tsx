"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Search, ArrowUpDown, Filter, TrendingUp, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/charts";

/* ---------- types ---------- */
interface BacklogItem {
  id: string;
  workflow_id: string;
  title: string;
  user_story: string;
  acceptance_criteria: string[];
  effort: string;
  estimated_roi_usd: number;
  composite_score: number;
  jim_principles: string[];
  department: string;
  rank: number;
}

interface BacklogResponse {
  items: BacklogItem[];
  total_items: number;
  total_estimated_roi_usd: number;
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

type SortField = "score" | "roi" | "department";

/* ---------- component ---------- */
export default function DiscoveryBacklogPage() {
  const [sortBy, setSortBy] = useState<SortField>("score");
  const [filterDept, setFilterDept] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading, error } = useQuery<BacklogResponse>({
    queryKey: ["discovery-backlog"],
    queryFn: () => apiFetch("/discovery/backlog"),
  });

  const items = data?.items ?? [];

  const deptNames = useMemo(() => {
    return [...new Set(items.map((d) => d.department))].sort();
  }, [items]);

  const filtered = useMemo(() => {
    let list = [...items];

    if (filterDept !== "all") {
      list = list.filter((o) => o.department === filterDept);
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (o) =>
          o.title.toLowerCase().includes(q) ||
          o.department.toLowerCase().includes(q) ||
          o.jim_principles.some((p) => p.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      if (sortBy === "score") return b.composite_score - a.composite_score;
      if (sortBy === "roi") return b.estimated_roi_usd - a.estimated_roi_usd;
      return a.department.localeCompare(b.department);
    });

    return list;
  }, [items, filterDept, searchTerm, sortBy]);

  const totalROI = data?.total_estimated_roi_usd ?? 0;
  const deptsCovered = new Set(items.map((o) => o.department)).size;

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
          <p className="text-red-600 font-medium mb-1">Failed to load backlog</p>
          <p className="text-sm text-text-muted">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="opacity-0 animate-fade-up">
        <h1 className="text-2xl font-bold font-display text-text-primary">Automation Backlog</h1>
        <p className="text-text-secondary mt-1">Scored AI opportunities across every Gong department</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 opacity-0 animate-fade-up stagger-1">
        <MetricCard
          label="Total Opportunities"
          value={String(items.length)}
          sub="Across all departments"
          color="text-gong-purple"
        />
        <MetricCard
          label="Total Projected ROI"
          value={formatCurrency(totalROI)}
          sub="Estimated annual savings"
          color="text-gong-success"
        />
        <MetricCard
          label="Departments Covered"
          value={String(deptsCovered)}
          sub="Enterprise-wide scan"
          color="text-gong-accent"
        />
      </div>

      {/* Controls */}
      <Card className="opacity-0 animate-fade-up stagger-2">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search workflows, departments, principles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-surface-3 border border-border text-text-primary placeholder:text-text-muted rounded-lg focus:outline-none focus:ring-1 focus:ring-gong-purple/30 focus:border-gong-purple"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-text-muted" />
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="text-sm bg-surface-3 border border-border text-text-primary rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gong-purple/30 focus:border-gong-purple"
              >
                <option value="all">All Departments</option>
                {deptNames.map((d) => (
                  <option key={d} value={d}>{deptLabel(d)}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <ArrowUpDown size={16} className="text-text-muted" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortField)}
                className="text-sm bg-surface-3 border border-border text-text-primary rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gong-purple/30 focus:border-gong-purple"
              >
                <option value="score">Sort by Score</option>
                <option value="roi">Sort by ROI</option>
                <option value="department">Sort by Department</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-sm text-text-muted">
        Showing {filtered.length} of {items.length} opportunities
      </p>

      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((opp, i) => (
          <OpportunityCard key={opp.id} opp={opp} index={i} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-text-muted">No opportunities match your filters</div>
      )}
    </div>
  );
}

function OpportunityCard({ opp, index }: { opp: BacklogItem; index: number }) {
  const deptVariant = DEPT_COLORS[opp.department] ?? "default";
  const effortVariant = EFFORT_COLORS[opp.effort] ?? "default";

  return (
    <Card className={`hover:border-border-strong transition-all opacity-0 animate-fade-up stagger-${Math.min(index % 6, 5)}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm leading-tight line-clamp-2">{opp.title}</CardTitle>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant={deptVariant}>{deptLabel(opp.department)}</Badge>
              <Badge variant={effortVariant}>Effort: {opp.effort}</Badge>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold text-gong-purple">{opp.composite_score.toFixed(1)}</div>
            <div className="text-[10px] text-text-muted uppercase tracking-wide">Score</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-1.5 text-sm">
          <TrendingUp size={14} className="text-gong-success" />
          <span className="font-semibold text-gong-success">{formatCurrency(opp.estimated_roi_usd)}</span>
          <span className="text-text-muted text-xs">est. annual ROI</span>
        </div>
        {opp.jim_principles.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {opp.jim_principles.map((p) => (
              <span key={p} className="inline-flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-600 rounded px-1.5 py-0.5">
                <Sparkles size={10} />
                {p.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-text-muted line-clamp-2 italic">&ldquo;{opp.user_story}&rdquo;</p>
      </CardContent>
    </Card>
  );
}
