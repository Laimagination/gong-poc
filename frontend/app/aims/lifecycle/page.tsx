"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { X, ChevronRight, Clock, User, Shield } from "lucide-react";
import { apiFetch } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/* ---------- types ---------- */
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

interface EventOut {
  id: number;
  project_id: number;
  timestamp: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  actor: string;
  detail: string | null;
}

interface ProjectDetail {
  id: number;
  workflow_id: string;
  name: string;
  department: string;
  status: string;
  risk_level: string;
  impact_stakeholder: number;
  impact_ethical: number;
  impact_legal: number;
  impact_operational: number;
  risk_score: number;
  benefit_score: number;
  approved_by: string[];
  approval_date: string | null;
  owner: string;
  review_due: string | null;
  last_reviewed: string | null;
  controls: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
  events: EventOut[];
}

/* ---------- constants ---------- */
const PIPELINE_STATUSES = [
  "proposed",
  "impact_assessed",
  "approved",
  "in_development",
  "deployed",
  "monitoring",
  "under_review",
  "on_hold",
  "retired",
];

const STATUS_COLORS: Record<string, string> = {
  proposed: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  impact_assessed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  approved: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  in_development: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  deployed: "bg-green-500/20 text-green-400 border-green-500/30",
  monitoring: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  under_review: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  on_hold: "bg-red-500/20 text-red-400 border-red-500/30",
  retired: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const RISK_BADGE: Record<string, "green" | "yellow" | "red" | "purple"> = {
  low: "green",
  medium: "yellow",
  high: "red",
  critical: "purple",
};

const DEPT_BADGE: Record<string, "purple" | "cyan" | "green" | "yellow" | "red" | "default"> = {
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

function statusLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function deptLabel(id: string): string {
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Returns the next valid status in the pipeline, or null if at the end / terminal. */
function nextStatus(current: string): string | null {
  const idx = PIPELINE_STATUSES.indexOf(current);
  if (idx === -1 || idx >= PIPELINE_STATUSES.length - 1) return null;
  // Skip "on_hold" and "retired" as automatic next steps
  const next = PIPELINE_STATUSES[idx + 1];
  if (next === "on_hold" || next === "retired") return null;
  return next;
}

/* ---------- component ---------- */
export default function LifecyclePipelinePage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const {
    data: projects,
    isLoading,
    isError,
    error,
  } = useQuery<ProjectSummary[]>({
    queryKey: ["aims", "projects"],
    queryFn: () => apiFetch("/aims/projects"),
  });

  const {
    data: detail,
    isLoading: detailLoading,
    isError: detailError,
  } = useQuery<ProjectDetail>({
    queryKey: ["aims", "projects", selectedId],
    queryFn: () => apiFetch(`/aims/projects/${selectedId}`),
    enabled: selectedId !== null,
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, to_status }: { id: number; to_status: string }) =>
      apiFetch<ProjectDetail>(`/aims/projects/${id}/transition`, {
        method: "POST",
        body: JSON.stringify({ to_status, actor: "David Lai" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aims", "projects"] });
      if (selectedId !== null) {
        queryClient.invalidateQueries({ queryKey: ["aims", "projects", selectedId] });
      }
    },
  });

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
          <p className="text-red-400 font-medium mb-1">Failed to load projects</p>
          <p className="text-sm text-text-muted">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  const projectsByStatus: Record<string, ProjectSummary[]> = {};
  for (const s of PIPELINE_STATUSES) projectsByStatus[s] = [];
  for (const p of projects ?? []) {
    if (projectsByStatus[p.status]) {
      projectsByStatus[p.status].push(p);
    }
  }

  const advanceStatus = detail ? nextStatus(detail.status) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-text-primary">Lifecycle Pipeline</h1>
        <p className="text-sm text-text-secondary mt-1">
          ISO 42005 Steps 4-10 &mdash; Full lifecycle view
        </p>
      </div>

      {/* Kanban board */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-max">
          {PIPELINE_STATUSES.map((status) => {
            const items = projectsByStatus[status];
            return (
              <div
                key={status}
                className="w-56 shrink-0 flex flex-col rounded-xl border border-border bg-surface-2/40 backdrop-blur-sm"
              >
                {/* Column header */}
                <div className="p-3 border-b border-border">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${STATUS_COLORS[status] || "bg-white/5 text-text-secondary border-border"}`}
                    >
                      {statusLabel(status)}
                    </span>
                    <span className="text-xs font-semibold text-text-muted bg-surface-3 rounded-full px-2 py-0.5">
                      {items.length}
                    </span>
                  </div>
                </div>

                {/* Scrollable card area */}
                <div className="flex-1 overflow-y-auto max-h-[calc(100vh-280px)] p-2 space-y-2">
                  {items.length === 0 && (
                    <p className="text-xs text-text-muted text-center py-4">No projects</p>
                  )}
                  {items.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => setSelectedId(project.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-all duration-200 hover:border-border-strong hover:shadow-card cursor-pointer ${
                        selectedId === project.id
                          ? "border-gong-purple/50 bg-gong-purple/5 shadow-sm shadow-gong-purple-glow"
                          : "border-border bg-surface-2/60"
                      }`}
                    >
                      <p className="text-sm font-medium text-text-primary truncate" title={project.name}>
                        {project.name}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge variant={DEPT_BADGE[project.department] ?? "default"}>
                          {deptLabel(project.department)}
                        </Badge>
                        <Badge variant={RISK_BADGE[project.risk_level] ?? "default"}>
                          {project.risk_level}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-text-muted mt-1.5 flex items-center gap-1">
                        <User size={10} />
                        {project.owner}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail drawer / right panel */}
      {selectedId !== null && (
        <>
          {/* Overlay for mobile */}
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none md:pointer-events-none"
            onClick={() => setSelectedId(null)}
          />

          <div className="fixed top-0 right-0 z-50 h-screen w-full max-w-lg bg-surface-1 border-l border-border shadow-2xl overflow-y-auto">
            {/* Close button */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-surface-1/95 backdrop-blur-sm border-b border-border">
              <h2 className="text-lg font-bold font-display text-text-primary truncate pr-4">
                {detailLoading ? "Loading..." : detail?.name ?? "Project Detail"}
              </h2>
              <button
                onClick={() => setSelectedId(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
                aria-label="Close panel"
              >
                <X size={18} />
              </button>
            </div>

            {detailLoading && (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gong-purple" />
              </div>
            )}

            {detailError && (
              <div className="p-4">
                <div className="rounded-lg border border-gong-danger/20 bg-gong-danger/10 p-4 text-sm text-gong-danger">
                  Failed to load project detail
                </div>
              </div>
            )}

            {detail && !detailLoading && (
              <div className="p-4 space-y-5">
                {/* Basic info */}
                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium border ${STATUS_COLORS[detail.status] || "bg-white/5 text-text-secondary border-border"}`}
                    >
                      {statusLabel(detail.status)}
                    </span>
                    <Badge variant={RISK_BADGE[detail.risk_level] ?? "default"}>
                      {detail.risk_level} risk
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-text-muted text-xs">Department</p>
                      <p className="text-text-primary">{deptLabel(detail.department)}</p>
                    </div>
                    <div>
                      <p className="text-text-muted text-xs">Workflow ID</p>
                      <p className="text-text-primary font-mono text-xs">{detail.workflow_id}</p>
                    </div>
                    <div>
                      <p className="text-text-muted text-xs">Owner</p>
                      <p className="text-text-primary">{detail.owner}</p>
                    </div>
                    <div>
                      <p className="text-text-muted text-xs">Review Due</p>
                      <p className="text-text-primary">
                        {detail.review_due
                          ? new Date(detail.review_due).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Impact Assessment */}
                <Card className="p-4">
                  <h3 className="text-sm font-semibold text-text-primary mb-3">Impact Assessment</h3>
                  <div className="space-y-3">
                    {[
                      { label: "Stakeholder", value: detail.impact_stakeholder },
                      { label: "Ethical", value: detail.impact_ethical },
                      { label: "Legal", value: detail.impact_legal },
                      { label: "Operational", value: detail.impact_operational },
                    ].map((item) => (
                      <div key={item.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-text-secondary">{item.label}</span>
                          <span className="text-xs font-semibold text-text-primary">
                            {item.value}/10
                          </span>
                        </div>
                        <div className="w-full h-2 bg-surface-3 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${(item.value / 10) * 100}%`,
                              backgroundColor:
                                item.value <= 3
                                  ? "#10B981"
                                  : item.value <= 6
                                    ? "#F59E0B"
                                    : "#EF4444",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Risk & Benefit Scores */}
                <div className="grid grid-cols-2 gap-3">
                  <Card className="p-4 text-center">
                    <p className="text-[11px] uppercase tracking-wider text-text-muted font-semibold mb-1">
                      Risk Score
                    </p>
                    <p className="text-2xl font-bold font-display text-gong-danger">
                      {detail.risk_score.toFixed(1)}
                    </p>
                  </Card>
                  <Card className="p-4 text-center">
                    <p className="text-[11px] uppercase tracking-wider text-text-muted font-semibold mb-1">
                      Benefit Score
                    </p>
                    <p className="text-2xl font-bold font-display text-gong-success">
                      {detail.benefit_score.toFixed(1)}
                    </p>
                  </Card>
                </div>

                {/* Approval Status */}
                <Card className="p-4">
                  <h3 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-1.5">
                    <Shield size={14} />
                    Approval Status
                  </h3>
                  {detail.approved_by.length > 0 ? (
                    <div className="space-y-1.5">
                      {detail.approved_by.map((approver, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-text-secondary">
                          <div className="w-5 h-5 rounded-full bg-gong-success/20 flex items-center justify-center">
                            <span className="text-[10px] text-gong-success">&#10003;</span>
                          </div>
                          {approver}
                        </div>
                      ))}
                      {detail.approval_date && (
                        <p className="text-xs text-text-muted mt-1">
                          Approved on {new Date(detail.approval_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-text-muted">Not yet approved</p>
                  )}
                </Card>

                {/* Controls */}
                <Card className="p-4">
                  <h3 className="text-sm font-semibold text-text-primary mb-2">Controls</h3>
                  {detail.controls.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {detail.controls.map((ctrl) => (
                        <Badge key={ctrl} variant="default">
                          {ctrl}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-text-muted">No controls assigned</p>
                  )}
                </Card>

                {/* Event Timeline */}
                <Card className="p-4">
                  <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-1.5">
                    <Clock size={14} />
                    Event Timeline
                  </h3>
                  {detail.events.length > 0 ? (
                    <div className="relative space-y-0">
                      {detail.events
                        .slice()
                        .sort(
                          (a, b) =>
                            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                        )
                        .map((event, idx) => (
                          <div key={event.id} className="flex gap-3 pb-4 last:pb-0">
                            {/* Timeline line & dot */}
                            <div className="flex flex-col items-center">
                              <div className="w-2 h-2 rounded-full bg-gong-purple mt-1.5 shrink-0" />
                              {idx < detail.events.length - 1 && (
                                <div className="w-px flex-1 bg-border mt-1" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-medium text-text-primary">
                                  {event.event_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                                </span>
                                {event.from_status && event.to_status && (
                                  <span className="text-[10px] text-text-muted flex items-center gap-1">
                                    {statusLabel(event.from_status)}
                                    <ChevronRight size={10} />
                                    {statusLabel(event.to_status)}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-text-muted mt-0.5">
                                {event.actor} &middot;{" "}
                                {new Date(event.timestamp).toLocaleString()}
                              </p>
                              {event.detail && (
                                <p className="text-xs text-text-secondary mt-1">{event.detail}</p>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-sm text-text-muted">No events recorded</p>
                  )}
                </Card>

                {/* Advance button */}
                {advanceStatus && (
                  <button
                    onClick={() =>
                      transitionMutation.mutate({
                        id: detail.id,
                        to_status: advanceStatus,
                      })
                    }
                    disabled={transitionMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gong-purple text-white text-sm font-medium hover:bg-gong-purple-dark disabled:opacity-50 transition-colors"
                  >
                    {transitionMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        Transitioning...
                      </>
                    ) : (
                      <>
                        Advance to {statusLabel(advanceStatus)}
                        <ChevronRight size={16} />
                      </>
                    )}
                  </button>
                )}

                {transitionMutation.isError && (
                  <div className="rounded-lg border border-gong-danger/20 bg-gong-danger/10 p-3 text-xs text-gong-danger">
                    Transition failed: {(transitionMutation.error as Error).message}
                  </div>
                )}

                {transitionMutation.isSuccess && (
                  <div className="rounded-lg border border-gong-success/20 bg-gong-success/10 p-3 text-xs text-gong-success">
                    Successfully transitioned to {statusLabel(advanceStatus ?? "")}
                  </div>
                )}

                {/* Notes */}
                {detail.notes && (
                  <Card className="p-4">
                    <h3 className="text-sm font-semibold text-text-primary mb-1">Notes</h3>
                    <p className="text-sm text-text-secondary">{detail.notes}</p>
                  </Card>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
