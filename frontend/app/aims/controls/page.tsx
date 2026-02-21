"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, Fragment } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { apiFetch } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/charts";

/* ---------- types ---------- */
interface ControlOut {
  id: string;
  name: string;
  category: string;
  description: string;
  project_count: number;
}

interface ProjectSummary {
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
}

/* ---------- constants ---------- */
const TOTAL_PROJECTS = 40;
const FULL_COVERAGE_THRESHOLD = 35;

const CATEGORY_BADGE: Record<string, "red" | "yellow" | "cyan" | "purple" | "green" | "default"> = {
  Risk: "red",
  Impact: "yellow",
  Data: "cyan",
  Transparency: "purple",
  Operations: "green",
};

type SortKey = "id" | "name" | "category" | "project_count" | "coverage";
type SortDir = "asc" | "desc";

function deptLabel(id: string): string {
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_COLORS: Record<string, string> = {
  proposed: "bg-slate-100 text-slate-700 border-slate-200",
  impact_assessed: "bg-blue-100 text-blue-700 border-blue-200",
  approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  in_development: "bg-amber-100 text-amber-700 border-amber-200",
  deployed: "bg-green-100 text-green-700 border-green-200",
  monitoring: "bg-cyan-100 text-cyan-700 border-cyan-200",
  under_review: "bg-orange-100 text-orange-700 border-orange-200",
  on_hold: "bg-red-100 text-red-700 border-red-200",
  retired: "bg-gray-100 text-gray-500 border-gray-200",
};

const RISK_BADGE: Record<string, "green" | "yellow" | "red" | "purple"> = {
  low: "green",
  medium: "yellow",
  high: "red",
  critical: "purple",
};

/* ---------- component ---------- */
export default function ControlsMappingPage() {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const {
    data: controls,
    isLoading: controlsLoading,
    isError: controlsError,
    error: controlsErr,
  } = useQuery<ControlOut[]>({
    queryKey: ["aims", "controls"],
    queryFn: () => apiFetch("/aims/controls"),
  });

  const {
    data: projects,
    isLoading: projectsLoading,
    isError: projectsError,
    error: projectsErr,
  } = useQuery<ProjectSummary[]>({
    queryKey: ["aims", "projects"],
    queryFn: () => apiFetch("/aims/projects"),
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const categories = useMemo(() => {
    if (!controls) return [];
    return [...new Set(controls.map((c) => c.category))].sort();
  }, [controls]);

  const filtered = useMemo(() => {
    if (!controls) return [];
    let list = controls;
    if (categoryFilter !== "all") {
      list = list.filter((c) => c.category === categoryFilter);
    }

    list = [...list].sort((a, b) => {
      let av: string | number;
      let bv: string | number;

      if (sortKey === "coverage") {
        av = a.project_count / TOTAL_PROJECTS;
        bv = b.project_count / TOTAL_PROJECTS;
      } else {
        av = a[sortKey as keyof ControlOut] as string | number;
        bv = b[sortKey as keyof ControlOut] as string | number;
      }

      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const sa = String(av);
      const sb = String(bv);
      return sortDir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });

    return list;
  }, [controls, categoryFilter, sortKey, sortDir]);

  const mappedProjects = useMemo(() => {
    if (!projects || !expandedId) return [];
    return projects.filter((p) => p.controls.includes(expandedId));
  }, [projects, expandedId]);

  // Summary stats
  const totalControls = controls?.length ?? 0;
  const avgProjectsPerControl =
    totalControls > 0
      ? (controls!.reduce((sum, c) => sum + c.project_count, 0) / totalControls).toFixed(1)
      : "0";
  const fullCoverageCount =
    controls?.filter((c) => c.project_count >= FULL_COVERAGE_THRESHOLD).length ?? 0;

  const isLoading = controlsLoading || projectsLoading;
  const isError = controlsError || projectsError;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gong-purple" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 font-medium mb-1">Failed to load data</p>
          <p className="text-sm text-text-muted">
            {(controlsErr as Error)?.message || (projectsErr as Error)?.message}
          </p>
        </div>
      </div>
    );
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <span className="text-text-muted ml-1">&#8597;</span>;
    return <span className="text-gong-purple ml-1">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-text-primary">ISO 42001 Controls</h1>
        <p className="text-sm text-text-secondary mt-1">
          Annex A control mapping across AI projects
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Total Controls"
          value={String(totalControls)}
          sub="Annex A controls tracked"
          color="text-gong-purple"
        />
        <MetricCard
          label="Avg Projects / Control"
          value={avgProjectsPerControl}
          sub={`Out of ${TOTAL_PROJECTS} total projects`}
          color="text-gong-accent"
        />
        <MetricCard
          label="Full Coverage"
          value={String(fullCoverageCount)}
          sub={`Controls with ${FULL_COVERAGE_THRESHOLD}+ projects mapped`}
          color="text-gong-success"
        />
      </div>

      {/* Category filter */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-3">
            <label className="text-sm text-text-secondary font-medium">Category:</label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setExpandedId(null);
              }}
              className="rounded-lg bg-surface-3 border border-border text-text-primary px-3 py-2 text-sm focus:outline-none focus:border-gong-purple focus:ring-1 focus:ring-gong-purple/30"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <span className="text-xs text-text-muted ml-auto">
              {filtered.length} control{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Controls table */}
      <Card>
        <CardContent className="pt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary bg-surface-2/40">
                {/* Expand/collapse icon column */}
                <th className="pb-3 pr-2 w-8" />
                {([
                  { key: "id" as SortKey, label: "Control ID" },
                  { key: "name" as SortKey, label: "Name" },
                  { key: "category" as SortKey, label: "Category" },
                  { key: "project_count" as SortKey, label: "Projects Mapped" },
                  { key: "coverage" as SortKey, label: "Coverage %" },
                ] as const).map((col) => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className="pb-3 pr-4 font-medium cursor-pointer hover:text-gong-purple select-none whitespace-nowrap"
                  >
                    {col.label}
                    <SortIcon col={col.key} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-text-muted">
                    No controls found
                  </td>
                </tr>
              ) : (
                filtered.map((ctrl) => {
                  const coverage = Math.round((ctrl.project_count / TOTAL_PROJECTS) * 100);
                  const isExpanded = expandedId === ctrl.id;

                  return (
                    <Fragment key={ctrl.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : ctrl.id)}
                        className="border-b border-border hover:bg-surface-2/60 transition-colors cursor-pointer"
                      >
                        <td className="py-3 pr-2">
                          {isExpanded ? (
                            <ChevronUp size={14} className="text-gong-purple" />
                          ) : (
                            <ChevronDown size={14} className="text-text-muted" />
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <code className="text-xs bg-surface-2 text-text-primary rounded px-1.5 py-0.5">
                            {ctrl.id}
                          </code>
                        </td>
                        <td className="py-3 pr-4 text-text-secondary">{ctrl.name}</td>
                        <td className="py-3 pr-4">
                          <Badge variant={CATEGORY_BADGE[ctrl.category] ?? "default"}>
                            {ctrl.category}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums text-text-secondary">
                          {ctrl.project_count}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-surface-3 rounded-full overflow-hidden max-w-[100px]">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(coverage, 100)}%`,
                                  backgroundColor:
                                    coverage >= 80
                                      ? "#10B981"
                                      : coverage >= 50
                                        ? "#F59E0B"
                                        : "#EF4444",
                                }}
                              />
                            </div>
                            <span className="text-xs tabular-nums text-text-secondary w-10 text-right">
                              {coverage}%
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded row */}
                      {isExpanded && (
                        <tr className="border-b border-border">
                          <td colSpan={6} className="p-0">
                            <div className="bg-surface-2/40 p-4 space-y-4">
                              {/* Description */}
                              <div>
                                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                                  Description
                                </h4>
                                <p className="text-sm text-text-secondary">{ctrl.description}</p>
                              </div>

                              {/* Mapped projects */}
                              <div>
                                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                                  Mapped Projects ({mappedProjects.length})
                                </h4>
                                {mappedProjects.length === 0 ? (
                                  <p className="text-sm text-text-muted">
                                    No projects with this control in their mapping.
                                  </p>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                                    {mappedProjects.map((p) => (
                                      <div
                                        key={p.id}
                                        className="flex items-center gap-2 p-2 rounded-lg bg-surface-2/60 border border-border"
                                      >
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-medium text-text-primary truncate">
                                            {p.name}
                                          </p>
                                          <div className="flex items-center gap-1.5 mt-1">
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
                                                } as Record<string, "purple" | "cyan" | "green" | "yellow" | "red">)[p.department] ?? "default"
                                              }
                                            >
                                              {deptLabel(p.department)}
                                            </Badge>
                                            <span
                                              className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium border ${STATUS_COLORS[p.status] || ""}`}
                                            >
                                              {p.status.replace(/_/g, " ")}
                                            </span>
                                          </div>
                                        </div>
                                        <Badge variant={RISK_BADGE[p.risk_level] ?? "default"}>
                                          {p.risk_level}
                                        </Badge>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

