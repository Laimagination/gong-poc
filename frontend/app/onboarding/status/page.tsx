"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  AlertCircle,
  ClipboardList,
  Activity,
  Users,
  ArrowRight,
  Bot,
} from "lucide-react";

/* ---------- types ---------- */

interface Step {
  name: string;
  status: string;
  agent: string;
  started_at: string | null;
  completed_at: string | null;
  details: string | null;
}

interface OnboardingStatus {
  id: number;
  new_hire_name: string;
  department: string;
  role: string;
  start_date: string;
  status: string;
  progress_pct: number;
  steps: Step[];
  current_step: string | null;
  messages: string[];
  result: unknown;
  created_at: string | null;
  updated_at: string | null;
}

interface OnboardingListItem {
  id: number;
  new_hire_name: string;
  department: string;
  role: string;
  status: string;
  progress_pct: number;
  created_at: string;
}

interface OnboardingListResponse {
  total: number;
  workflows: OnboardingListItem[];
}

interface WsMessage {
  type?: string;
  step?: string;
  status?: string;
  agent?: string;
  message?: string;
  details?: string;
  timestamp?: string;
}

/* ---------- helpers ---------- */

function stepStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle2 size={18} className="text-gong-success" />;
    case "running":
    case "in_progress":
      return <Loader2 size={18} className="text-gong-purple animate-spin" />;
    case "failed":
      return <XCircle size={18} className="text-gong-danger" />;
    default:
      return <Circle size={18} className="text-text-muted" />;
  }
}

function stepBadgeVariant(status: string) {
  switch (status) {
    case "completed":
      return "green" as const;
    case "running":
    case "in_progress":
      return "purple" as const;
    case "failed":
      return "red" as const;
    default:
      return "default" as const;
  }
}

function formatTimestamp(ts: string | null) {
  if (!ts) return "--";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/* ---------- sub-components ---------- */

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-3 rounded-full bg-surface-4 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700 ease-out",
            pct >= 100 ? "bg-gong-success" : "bg-gradient-gong"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-semibold text-text-primary w-12 text-right">
        {pct}%
      </span>
    </div>
  );
}

function StepChecklist({ steps }: { steps: Step[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList size={20} className="text-gong-purple" />
          Step Checklist
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {steps.map((step, i) => (
            <div key={step.name}>
              <div
                className={cn(
                  "flex items-start gap-3 py-3 px-3 rounded-lg transition-colors",
                  step.status === "running" || step.status === "in_progress"
                    ? "bg-purple-500/10"
                    : ""
                )}
              >
                <div className="mt-0.5">{stepStatusIcon(step.status)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-text-primary">
                      {step.name}
                    </span>
                    <Badge variant={stepBadgeVariant(step.status)}>
                      {step.status}
                    </Badge>
                    <span className="text-xs text-text-muted ml-auto">
                      {step.agent}
                    </span>
                  </div>
                  {step.details && (
                    <p className="text-xs text-text-secondary mt-1">{step.details}</p>
                  )}
                  <div className="flex gap-4 text-[11px] text-text-muted mt-1">
                    {step.started_at && (
                      <span>Started: {formatTimestamp(step.started_at)}</span>
                    )}
                    {step.completed_at && (
                      <span>Completed: {formatTimestamp(step.completed_at)}</span>
                    )}
                  </div>
                </div>
              </div>
              {i < steps.length - 1 && (
                <div className="ml-[21px] h-4 w-px bg-border" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AgentDecisionLog({ messages }: { messages: WsMessage[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot size={20} className="text-gong-purple" />
          Agent Decision Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        {messages.length === 0 ? (
          <div className="text-center py-8 text-text-muted">
            <Activity size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">
              Waiting for agent activity...
            </p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-3 rounded-lg border p-3 text-sm transition-colors",
                  msg.status === "failed"
                    ? "border-red-500/20 bg-red-500/10"
                    : msg.status === "completed"
                    ? "border-green-500/20 bg-green-500/10"
                    : "border-border bg-surface-3"
                )}
              >
                <div className="shrink-0 mt-0.5">
                  {msg.status === "completed" ? (
                    <CheckCircle2 size={14} className="text-gong-success" />
                  ) : msg.status === "failed" ? (
                    <XCircle size={14} className="text-gong-danger" />
                  ) : (
                    <ArrowRight size={14} className="text-gong-purple" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {msg.agent && (
                      <span className="font-medium text-text-primary">
                        {msg.agent}
                      </span>
                    )}
                    {msg.step && (
                      <span className="text-xs text-text-muted">{msg.step}</span>
                    )}
                    {msg.timestamp && (
                      <span className="text-[11px] text-text-muted ml-auto">
                        {formatTimestamp(msg.timestamp)}
                      </span>
                    )}
                  </div>
                  {msg.message && (
                    <p className="text-xs text-text-secondary mt-0.5">{msg.message}</p>
                  )}
                  {msg.details && (
                    <p className="text-xs text-text-muted mt-0.5">{msg.details}</p>
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OnboardingListView() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["onboarding-list"],
    queryFn: () => apiFetch<OnboardingListResponse>("/onboarding/list"),
    refetchInterval: 10_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-text-primary">
          Onboarding Status Tracker
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Select an onboarding to track its live status
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users size={20} className="text-gong-purple" />
            All Onboardings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gong-purple border-t-transparent" />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
              <AlertCircle size={16} />
              Failed to load onboardings.
            </div>
          )}

          {data?.workflows && data.workflows.length === 0 && (
            <div className="text-center py-12 text-text-muted">
              <Users size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No onboardings found.</p>
              <Link
                href="/onboarding/new"
                className="text-sm text-gong-purple underline"
              >
                Trigger a new hire
              </Link>
            </div>
          )}

          {data?.workflows && data.workflows.length > 0 && (
            <div className="grid gap-3">
              {data.workflows.map((item) => (
                <Link
                  key={item.id}
                  href={`/onboarding/status?id=${item.id}`}
                  className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-surface-3 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-500/10 text-gong-purple font-semibold text-sm">
                      {item.new_hire_name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-text-primary group-hover:text-gong-purple transition-colors">
                        {item.new_hire_name}
                      </p>
                      <p className="text-xs text-text-muted">
                        {item.department} &middot; {item.role}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={stepBadgeVariant(item.status)}>
                      {item.status}
                    </Badge>
                    <div className="flex items-center gap-2 w-32">
                      <div className="flex-1 h-2 rounded-full bg-surface-4 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-gong transition-all"
                          style={{ width: `${item.progress_pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-text-muted w-8 text-right">
                        {item.progress_pct}%
                      </span>
                    </div>
                    <ArrowRight
                      size={16}
                      className="text-text-muted group-hover:text-gong-purple transition-colors"
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- detail view ---------- */

function StatusDetailView({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [wsMessages, setWsMessages] = useState<WsMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["onboarding-status", id],
    queryFn: () => apiFetch<OnboardingStatus>(`/onboarding/status/${id}`),
    refetchInterval: 5_000,
  });

  // WebSocket connection for live updates
  useEffect(() => {
    const wsBase =
      process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/api";
    const ws = new WebSocket(`${wsBase}/onboarding/ws/${id}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        setWsMessages((prev) => [...prev, msg]);
        // Invalidate query to refresh HTTP data alongside ws updates
        queryClient.invalidateQueries({ queryKey: ["onboarding-status", id] });
      } catch {
        // ignore non-JSON messages
      }
    };

    ws.onerror = () => {
      // silent - we fall back to polling via react-query
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [id, queryClient]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="h-10 w-10 mx-auto animate-spin rounded-full border-4 border-gong-purple border-t-transparent" />
          <p className="text-sm text-text-muted mt-4">Loading onboarding status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-text-primary">
            Onboarding Status
          </h1>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
          <AlertCircle size={16} />
          Failed to load onboarding status for ID: {id}. Check that the backend
          is running and the ID is valid.
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-text-muted mb-1">
          <Link href="/onboarding" className="hover:text-gong-purple transition-colors">
            Onboarding
          </Link>
          <ArrowRight size={12} />
          <span>Status</span>
        </div>
        <h1 className="text-2xl font-display font-bold text-text-primary">{data.new_hire_name}</h1>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-sm text-text-secondary">{data.department}</span>
          <span className="text-text-muted">&middot;</span>
          <span className="text-sm text-text-secondary">{data.role}</span>
          <Badge variant={stepBadgeVariant(data.status)}>{data.status}</Badge>
        </div>
      </div>

      {/* Progress bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-text-primary">
              Overall Progress
            </span>
            <span className="text-sm text-text-secondary">
              {data.steps.filter((s) => s.status === "completed").length} /{" "}
              {data.steps.length} steps completed
            </span>
          </div>
          <ProgressBar pct={data.progress_pct} />
        </CardContent>
      </Card>

      {/* Steps + Log side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StepChecklist steps={data.steps} />
        <AgentDecisionLog messages={wsMessages} />
      </div>
    </div>
  );
}

/* ---------- page ---------- */

function StatusPageInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  if (!id) {
    return <OnboardingListView />;
  }

  return <StatusDetailView id={id} />;
}

export default function StatusPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gong-purple border-t-transparent" />
        </div>
      }
    >
      <StatusPageInner />
    </Suspense>
  );
}
