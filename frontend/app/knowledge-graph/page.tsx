"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";
import { cn } from "@/lib/utils";
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

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Nodes"
          value={stats ? stats.total_nodes.toLocaleString() : "--"}
          sub="Total graph nodes"
        />
        <MetricCard
          label="Relationships"
          value={stats ? stats.total_relationships.toLocaleString() : "--"}
          sub="Total graph edges"
        />
        <MetricCard
          label="Departments"
          value={stats?.nodes?.Department?.toString() || "--"}
          sub="Organizational units"
          color="text-gong-purple-light"
        />
        <MetricCard
          label="AI Projects"
          value={stats?.nodes?.AIProject?.toString() || "--"}
          sub="Tracked in AIMS"
          color="text-emerald-600"
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
