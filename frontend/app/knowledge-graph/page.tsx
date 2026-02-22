"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/charts";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

/* ---------- types ---------- */
interface GraphNode {
  id: string;
  label: string;
  name: string;
  properties: Record<string, unknown>;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface GraphStats {
  nodes: Record<string, number>;
  relationships: Record<string, number>;
  total_nodes: number;
  total_relationships: number;
}

interface GraphInsights {
  governance_coverage: {
    total_projects: number;
    governed_count: number;
    coverage_pct: number;
    ungoverned_projects: string[];
  };
  compliance_chain: {
    total_projects: number;
    fully_linked: number;
    completeness_pct: number;
  };
  department_risk: {
    department: string;
    total_projects: number;
    high_risk_count: number;
    breakdown: { risk_level: string; count: number }[];
  }[];
  tool_sprawl: {
    tool: string;
    workflow_count: number;
    department_count: number;
    departments: string[];
  }[];
  lifecycle_pipeline: {
    department: string;
    stages: { status: string; count: number }[];
  }[];
}

/* ---------- constants ---------- */
const NODE_COLORS: Record<string, string> = {
  Department: "#235FF6",
  Workflow: "#06B6D4",
  AIProject: "#10B981",
  Tool: "#F59E0B",
  Control: "#EF4444",
  Principle: "#D4A843",
  ControlFramework: "#F97316",
  WorkflowScore: "#8B5CF6",
  AIMSEvent: "#64748B",
};

const NODE_SIZES: Record<string, number> = {
  Department: 8,
  ControlFramework: 8,
  AIProject: 6,
  Workflow: 5,
  Control: 5,
  Principle: 6,
  Tool: 4,
  WorkflowScore: 3,
  AIMSEvent: 3,
};

const DEFAULT_HIDDEN = new Set(["AIMSEvent", "WorkflowScore"]);

/* ---------- helpers ---------- */
function getNodeId(node: string | GraphNode): string {
  return typeof node === "string" ? node : node.id;
}

/* ---------- component ---------- */
export default function KnowledgeGraphPage() {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set(DEFAULT_HIDDEN));
  const graphRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

  const { data: fullGraph, isLoading } = useQuery<GraphData>({
    queryKey: ["graph", "full"],
    queryFn: () => apiFetch("/graph/full"),
  });

  const { data: stats } = useQuery<GraphStats>({
    queryKey: ["graph", "stats"],
    queryFn: () => apiFetch("/graph/stats"),
  });

  const { data: insights } = useQuery<GraphInsights>({
    queryKey: ["graph", "insights"],
    queryFn: () => apiFetch("/graph/insights"),
  });

  const { data: deptGraph } = useQuery<GraphData>({
    queryKey: ["graph", "department", departmentFilter],
    queryFn: () => apiFetch(`/graph/department/${departmentFilter}`),
    enabled: !!departmentFilter,
  });

  // Derive departments for the filter dropdown
  const departments = useMemo(() => {
    if (!fullGraph) return [];
    return fullGraph.nodes
      .filter((n) => n.label === "Department")
      .map((n) => ({
        id: n.properties.dept_id as string,
        name: n.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [fullGraph]);

  // Determine which graph data to show
  const activeGraph = useMemo((): GraphData => {
    const source = departmentFilter && deptGraph ? deptGraph : fullGraph;
    if (!source) return { nodes: [], links: [] };

    const visibleNodes = source.nodes.filter((n) => !hiddenTypes.has(n.label));
    const visibleIds = new Set(visibleNodes.map((n) => n.id));
    const visibleLinks = source.links.filter(
      (l) => visibleIds.has(getNodeId(l.source)) && visibleIds.has(getNodeId(l.target))
    );

    return { nodes: visibleNodes, links: visibleLinks };
  }, [fullGraph, deptGraph, departmentFilter, hiddenTypes]);

  const toggleType = useCallback((type: string) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const label = node.label as string;
      const color = NODE_COLORS[label] || "#64748B";
      const size = NODE_SIZES[label] || 4;
      const x = node.x as number;
      const y = node.y as number;

      // Draw node circle
      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      // Draw border if selected
      if (selectedNode && selectedNode.id === node.id) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw label when zoomed in enough
      if (globalScale > 1.2) {
        const displayName = (node.name as string) || "";
        const fontSize = Math.max(10 / globalScale, 2);
        ctx.font = `${fontSize}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
        ctx.fillText(displayName, x, y + size + 2);
      }
    },
    [selectedNode]
  );

  const handleNodeClick = useCallback((node: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    setSelectedNode(node as GraphNode);
  }, []);

  const allTypes = Object.keys(NODE_COLORS);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-text-primary">
          Knowledge Graph
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Cross-Module Compliance Lineage
        </p>
      </div>

      {/* Insight Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Governance Coverage"
          value={insights ? `${insights.governance_coverage.coverage_pct}%` : "--"}
          sub={insights ? `${insights.governance_coverage.governed_count} of ${insights.governance_coverage.total_projects} projects governed` : undefined}
          color={
            insights
              ? insights.governance_coverage.coverage_pct >= 80
                ? "text-emerald-600"
                : insights.governance_coverage.coverage_pct >= 60
                  ? "text-amber-500"
                  : "text-red-500"
              : "text-text-primary"
          }
        />
        <MetricCard
          label="Compliance Chain"
          value={insights ? `${insights.compliance_chain.completeness_pct}%` : "--"}
          sub="Linked to ISO 42001"
          color={
            insights
              ? insights.compliance_chain.completeness_pct >= 80
                ? "text-emerald-600"
                : insights.compliance_chain.completeness_pct >= 60
                  ? "text-amber-500"
                  : "text-red-500"
              : "text-text-primary"
          }
        />
        <MetricCard
          label="High-Risk Projects"
          value={insights ? insights.department_risk.reduce((sum, d) => sum + d.high_risk_count, 0).toString() : "--"}
          sub={insights ? `Across ${insights.department_risk.filter(d => d.high_risk_count > 0).length} departments` : undefined}
          color={
            insights
              ? insights.department_risk.reduce((sum, d) => sum + d.high_risk_count, 0) > 5
                ? "text-red-500"
                : insights.department_risk.reduce((sum, d) => sum + d.high_risk_count, 0) > 2
                  ? "text-amber-500"
                  : "text-emerald-600"
              : "text-text-primary"
          }
        />
        <MetricCard
          label="Shared Tools"
          value={insights ? insights.tool_sprawl.filter(t => t.department_count >= 3).length.toString() : "--"}
          sub="Used across 3+ departments"
          color="text-gong-purple-light"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="rounded-lg border border-border bg-surface-2 text-text-primary text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gong-purple"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap gap-1.5">
          {allTypes.map((type) => {
            const hidden = hiddenTypes.has(type);
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-md border transition-all duration-200 font-medium",
                  hidden
                    ? "border-border bg-transparent text-text-muted opacity-50"
                    : "border-transparent text-white"
                )}
                style={
                  hidden
                    ? undefined
                    : { backgroundColor: NODE_COLORS[type] + "CC" }
                }
              >
                {type}
              </button>
            );
          })}
        </div>
      </div>

      {/* Graph Canvas */}
      <Card>
        <CardContent className="p-0 overflow-hidden rounded-xl">
          <div
            className="w-full bg-[#F8FAFC]"
            style={{ height: 600 }}
          >
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-text-muted text-sm">
                Loading graph...
              </div>
            ) : (
              <ForceGraph2D
                ref={graphRef}
                graphData={activeGraph}
                nodeId="id"
                nodeCanvasObject={nodeCanvasObject}
                nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                  const size = NODE_SIZES[node.label as string] || 4;
                  ctx.beginPath();
                  ctx.arc(node.x as number, node.y as number, size + 2, 0, 2 * Math.PI);
                  ctx.fillStyle = color;
                  ctx.fill();
                }}
                linkColor={() => "rgba(0,0,0,0.1)"}
                linkWidth={0.5}
                linkDirectionalArrowLength={3}
                linkDirectionalArrowRelPos={1}
                onNodeClick={handleNodeClick}
                backgroundColor="#F8FAFC"
                width={typeof window !== "undefined" ? window.innerWidth - 320 : 900}
                height={600}
                cooldownTicks={100}
                d3AlphaDecay={0.02}
                d3VelocityDecay={0.3}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 px-1">
        {allTypes
          .filter((t) => !hiddenTypes.has(t))
          .map((type) => (
            <div key={type} className="flex items-center gap-1.5 text-xs text-text-muted">
              <span
                className="w-3 h-3 rounded-full inline-block"
                style={{ backgroundColor: NODE_COLORS[type] }}
              />
              {type}
            </div>
          ))}
      </div>

      {/* Insights Section */}
      {insights && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Risk Concentration by Department */}
          <Card>
            <CardHeader>
              <CardTitle>Risk Concentration by Department</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <ReBarChart
                  data={insights.department_risk.filter(d => d.high_risk_count > 0).sort((a, b) => b.high_risk_count - a.high_risk_count)}
                  layout="vertical"
                  margin={{ top: 4, right: 20, bottom: 4, left: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="department" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={120} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "8px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", fontSize: "12px", color: "#0F172A" }}
                    cursor={{ fill: "rgba(239,68,68,0.04)" }}
                  />
                  <Bar dataKey="high_risk_count" name="High-Risk Projects" radius={[0, 4, 4, 0]}>
                    {insights.department_risk.filter(d => d.high_risk_count > 0).sort((a, b) => b.high_risk_count - a.high_risk_count).map((_, i) => (
                      <Cell key={i} fill={i === 0 ? "#EF4444" : i < 3 ? "#F97316" : "#F59E0B"} />
                    ))}
                  </Bar>
                </ReBarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Shared Tools */}
          <Card>
            <CardHeader>
              <CardTitle>Top Shared Tools</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[280px] overflow-y-auto">
                {insights.tool_sprawl.slice(0, 8).map((tool) => (
                  <div key={tool.tool} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary truncate">{tool.tool}</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {tool.departments.map((dept) => (
                          <span
                            key={dept}
                            className="inline-block w-2 h-2 rounded-full"
                            title={dept}
                            style={{ backgroundColor: NODE_COLORS.Department }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-4 text-xs text-text-muted shrink-0 ml-3">
                      <span>{tool.workflow_count} workflows</span>
                      <span className="font-medium text-text-primary">{tool.department_count} depts</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Lifecycle Pipeline — full width */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Lifecycle Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const allStatuses = Array.from(
                  new Set(insights.lifecycle_pipeline.flatMap(d => d.stages.map(s => s.status)))
                ).sort();
                const STATUS_COLORS: Record<string, string> = {
                  active: "#10B981",
                  "in_review": "#06B6D4",
                  planning: "#235FF6",
                  completed: "#8B5CF6",
                  on_hold: "#F59E0B",
                  retired: "#64748B",
                };
                const chartData = insights.lifecycle_pipeline.map(d => {
                  const row: Record<string, string | number> = { department: d.department };
                  for (const s of d.stages) row[s.status] = s.count;
                  return row;
                });
                return (
                  <ResponsiveContainer width="100%" height={280}>
                    <ReBarChart
                      data={chartData}
                      layout="vertical"
                      margin={{ top: 4, right: 20, bottom: 4, left: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="department" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={120} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "8px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", fontSize: "12px", color: "#0F172A" }}
                        cursor={{ fill: "rgba(35,95,246,0.04)" }}
                      />
                      {allStatuses.map((status, i) => (
                        <Bar
                          key={status}
                          dataKey={status}
                          name={status.replace(/_/g, " ")}
                          stackId="pipeline"
                          fill={STATUS_COLORS[status] || ["#235FF6", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"][i % 6]}
                          radius={i === allStatuses.length - 1 ? [0, 4, 4, 0] : undefined}
                        />
                      ))}
                    </ReBarChart>
                  </ResponsiveContainer>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Selected Node Detail */}
      {selectedNode && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: NODE_COLORS[selectedNode.label] || "#64748B" }}
                />
                <CardTitle className="text-base">{selectedNode.name}</CardTitle>
                <span className="text-xs text-text-muted bg-surface-2 px-2 py-0.5 rounded-md">
                  {selectedNode.label}
                </span>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-text-muted hover:text-text-primary text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(selectedNode.properties)
                .filter(([key]) => key !== "graph_id")
                .map(([key, value]) => (
                  <div key={key} className="text-sm">
                    <span className="text-text-muted">{key}: </span>
                    <span className="text-text-primary font-medium">
                      {typeof value === "object" ? JSON.stringify(value) : String(value ?? "--")}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
