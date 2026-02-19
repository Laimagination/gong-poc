"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch, cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  UserPlus,
  KeyRound,
  Monitor,
  Package,
  CheckCircle2,
  ArrowRight,
  Users,
  Clock,
  AlertCircle,
} from "lucide-react";

/* ---------- types ---------- */

interface OnboardingItem {
  id: number;
  new_hire_name: string;
  department: string;
  role: string;
  start_date: string;
  status: string;
  progress_pct: number;
  current_step: string | null;
  created_at: string;
  updated_at: string;
}

interface OnboardingListResponse {
  total: number;
  workflows: OnboardingItem[];
}

/* ---------- workflow node definitions ---------- */

const WORKFLOW_NODES = [
  {
    id: "receive",
    label: "Receive Hire",
    agent: "Intake Agent",
    icon: UserPlus,
    description: "Validates new hire data and initiates the onboarding pipeline",
  },
  {
    id: "identity",
    label: "Provision Identity",
    agent: "Identity Agent",
    icon: KeyRound,
    description: "Creates accounts in Okta, Google Workspace, and internal SSO",
  },
  {
    id: "workspace",
    label: "Setup Workspace",
    agent: "Workspace Agent",
    icon: Monitor,
    description: "Provisions Slack channels, GitHub repos, and Jira projects",
  },
  {
    id: "equipment",
    label: "Order Equipment",
    agent: "Equipment Agent",
    icon: Package,
    description: "Orders laptop, peripherals, and ships to employee address",
  },
  {
    id: "complete",
    label: "Track Completion",
    agent: "Completion Agent",
    icon: CheckCircle2,
    description: "Verifies all steps, sends welcome email, and closes ticket",
  },
];

/* ---------- helpers ---------- */

function getNodeStatus(
  workflowStatus: string | null,
  currentStep: string | null,
  nodeIndex: number
): "completed" | "active" | "pending" {
  if (!workflowStatus || !currentStep) return "pending";
  const currentIndex = WORKFLOW_NODES.findIndex((n) => n.id === currentStep);
  if (currentIndex < 0) return "pending";
  if (nodeIndex < currentIndex) return "completed";
  if (nodeIndex === currentIndex) return "active";
  return "pending";
}

function statusBadgeVariant(status: string) {
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

/* ---------- components ---------- */

function WorkflowNode({
  node,
  status,
}: {
  node: (typeof WORKFLOW_NODES)[number];
  status: "completed" | "active" | "pending";
}) {
  const Icon = node.icon;
  return (
    <div
      className={cn(
        "relative flex flex-col items-center rounded-xl border-2 p-4 sm:p-5 w-36 sm:w-44 transition-all",
        status === "completed" && "border-gong-success bg-green-500/10",
        status === "active" && "border-gong-purple bg-purple-500/10 animate-pulse",
        status === "pending" && "border-border bg-surface-3"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-full mb-3",
          status === "completed" && "bg-gong-success text-white",
          status === "active" && "bg-gong-purple text-white",
          status === "pending" && "bg-surface-4 text-text-muted"
        )}
      >
        <Icon size={20} />
      </div>
      <span className="font-semibold text-sm text-center leading-tight text-text-primary">
        {node.label}
      </span>
      <span className="text-[11px] text-text-muted mt-1">{node.agent}</span>
      <span className="text-[10px] text-text-muted mt-2 text-center leading-snug">
        {node.description}
      </span>
    </div>
  );
}

function ArrowConnector() {
  return (
    <div className="flex items-center justify-center shrink-0 mx-1">
      <div className="w-8 h-0.5 bg-border-strong" />
      <ArrowRight size={16} className="text-text-muted -ml-1" />
    </div>
  );
}

function WorkflowFlowchart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users size={20} className="text-gong-purple" />
          LangGraph Onboarding State Machine
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-start sm:justify-center overflow-x-auto py-4 gap-0 pb-2">
          {WORKFLOW_NODES.map((node, i) => (
            <div key={node.id} className="flex items-center">
              <WorkflowNode node={node} status="pending" />
              {i < WORKFLOW_NODES.length - 1 && <ArrowConnector />}
            </div>
          ))}
        </div>
        <p className="text-xs text-text-muted text-center mt-4">
          Each node represents an autonomous LangGraph agent. Trigger a new hire
          to see the workflow animate in real-time.
        </p>
      </CardContent>
    </Card>
  );
}

function RecentOnboardings() {
  const { data: rawData, isLoading, error } = useQuery({
    queryKey: ["onboarding-list"],
    queryFn: () => apiFetch<OnboardingListResponse>("/onboarding/list"),
    refetchInterval: 10_000,
  });
  const data = rawData?.workflows;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Clock size={20} className="text-gong-purple" />
          Recent Onboardings
        </CardTitle>
        <Link
          href="/onboarding/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-gong-purple px-4 py-2 text-sm font-medium text-white hover:bg-gong-purple-dark transition-colors"
        >
          <UserPlus size={14} />
          New Hire
        </Link>
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
            Failed to load onboardings. Check that the backend is running.
          </div>
        )}

        {data && data.length === 0 && (
          <div className="text-center py-12 text-text-muted">
            <Users size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No onboardings yet.</p>
            <p className="text-xs mt-1">
              Trigger a{" "}
              <Link href="/onboarding/new" className="text-gong-purple underline">
                new hire
              </Link>{" "}
              to get started.
            </p>
          </div>
        )}

        {data && data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-muted">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium hidden sm:table-cell">Department</th>
                  <th className="pb-2 font-medium hidden sm:table-cell">Role</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Progress</th>
                  <th className="pb-2 font-medium hidden md:table-cell">Created</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-border last:border-0 hover:bg-surface-3 transition-colors"
                  >
                    <td className="py-3">
                      <Link
                        href={`/onboarding/status?id=${item.id}`}
                        className="font-medium text-gong-purple hover:underline"
                      >
                        {item.new_hire_name}
                      </Link>
                    </td>
                    <td className="py-3 text-text-secondary hidden sm:table-cell">{item.department}</td>
                    <td className="py-3 text-text-secondary hidden sm:table-cell">{item.role}</td>
                    <td className="py-3">
                      <Badge variant={statusBadgeVariant(item.status)}>
                        {item.status}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 rounded-full bg-surface-4 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-gong transition-all"
                            style={{ width: `${item.progress_pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-text-muted">
                          {item.progress_pct}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 text-text-muted text-xs hidden md:table-cell">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- page ---------- */

export default function OnboardingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-text-primary">
          AI Onboarding Orchestrator
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          LangGraph-powered multi-agent workflow for automated employee
          onboarding
        </p>
      </div>

      <WorkflowFlowchart />
      <RecentOnboardings />
    </div>
  );
}
