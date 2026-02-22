"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/charts";

type Tier = "simple" | "moderate" | "complex";

interface ChatResponse {
  response: string;
  model: string;
  provider: string;
  task_tier: string;
  tokens: { input: number; output: number; total: number };
  cost_usd: number;
  latency_ms: number;
  status: string;
}

const TIER_OPTIONS: { value: Tier; label: string; description: string }[] = [
  { value: "simple", label: "Simple", description: "Fast, low-cost model for basic tasks" },
  { value: "moderate", label: "Moderate", description: "Balanced model for standard tasks" },
  { value: "complex", label: "Complex", description: "Most capable model for complex reasoning" },
];

const TIER_COLORS: Record<Tier, string> = {
  simple: "text-gong-success",
  moderate: "text-gong-warning",
  complex: "text-gong-purple",
};

function Spinner({ size = "h-5 w-5" }: { size?: string }) {
  return (
    <div className={`${size} animate-spin rounded-full border-2 border-gong-purple border-t-transparent`} />
  );
}

function ResponsePanel({ result, tier, compact = false }: { result: ChatResponse; tier: Tier; compact?: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">{compact ? tier.charAt(0).toUpperCase() + tier.slice(1) : "Response"}</CardTitle>
        <Badge variant={tier === "simple" ? "green" : tier === "moderate" ? "yellow" : "purple"}>
          {tier}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {compact ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">Model</span>
              <span className={`font-medium ${TIER_COLORS[tier]} truncate ml-2`}>{result.model}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">Tokens</span>
              <span className="font-medium text-text-primary">{result.tokens.total.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">Cost</span>
              <span className="font-medium text-gong-warning">${result.cost_usd.toFixed(4)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">Latency</span>
              <span className="font-medium text-gong-accent">{result.latency_ms}ms</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard label="Model" value={result.model} color={TIER_COLORS[tier]} />
            <MetricCard label="Tokens" value={result.tokens.total.toLocaleString()} />
            <MetricCard label="Cost" value={`$${result.cost_usd.toFixed(4)}`} color="text-gong-warning" />
            <MetricCard label="Latency" value={`${result.latency_ms}ms`} color="text-gong-accent" />
          </div>
        )}
        <div className={`rounded-lg bg-surface-2/60 border border-border p-3 text-sm text-text-primary whitespace-pre-wrap ${compact ? "max-h-60 overflow-auto" : ""}`}>
          {result.response}
        </div>
      </CardContent>
    </Card>
  );
}

export default function RoutingPlayground() {
  const [prompt, setPrompt] = useState("");
  const [tier, setTier] = useState<Tier>("moderate");
  const [compareMode, setCompareMode] = useState(true);

  const singleMutation = useMutation<ChatResponse, Error, { prompt: string; task_tier: Tier }>({
    mutationFn: (body) =>
      apiFetch("/governance/chat", {
        method: "POST",
        body: JSON.stringify({ message: body.prompt, task_tier: body.task_tier }),
      }),
  });

  const [compareResults, setCompareResults] = useState<Record<Tier, ChatResponse | null>>({
    simple: null,
    moderate: null,
    complex: null,
  });
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  const handleSend = () => {
    if (!prompt.trim()) return;

    if (compareMode) {
      setCompareLoading(true);
      setCompareError(null);
      setCompareResults({ simple: null, moderate: null, complex: null });

      Promise.allSettled(
        (["simple", "moderate", "complex"] as Tier[]).map((t) =>
          apiFetch<ChatResponse>("/governance/chat", {
            method: "POST",
            body: JSON.stringify({ message: prompt, task_tier: t }),
          }).then((res) => ({ tier: t, res }))
        )
      ).then((results) => {
        const next: Record<Tier, ChatResponse | null> = { simple: null, moderate: null, complex: null };
        for (const r of results) {
          if (r.status === "fulfilled") next[r.value.tier] = r.value.res;
        }
        const allFailed = results.every((r) => r.status === "rejected");
        if (allFailed) setCompareError("All requests failed. Is the backend running?");
        setCompareResults(next);
        setCompareLoading(false);
      });
    } else {
      singleMutation.mutate({ prompt, task_tier: tier });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-text-primary">Model Routing Playground</h1>
        <p className="text-sm text-text-secondary mt-1">
          Test the intelligent routing engine across task complexity tiers
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Tier Selector & Compare Toggle */}
          <div className="flex flex-wrap items-center gap-4">
            {!compareMode && (
              <div className="flex gap-2">
                {TIER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTier(opt.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      tier === opt.value
                        ? "bg-gong-purple text-white"
                        : "bg-surface-3 text-text-secondary hover:text-text-primary border border-border"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setCompareMode(!compareMode)}
              className="flex items-center gap-2.5 ml-auto text-sm text-text-secondary cursor-pointer"
            >
              <span>Compare all tiers</span>
              <div className={`relative w-10 h-[22px] rounded-full transition-colors ${compareMode ? "bg-gong-purple" : "bg-surface-3 border border-border"}`}>
                <div className={`absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-transform ${compareMode ? "translate-x-[22px]" : "translate-x-[3px]"}`} />
              </div>
            </button>
          </div>

          {/* Selected tier description */}
          {!compareMode && (
            <p className="text-xs text-text-muted">
              {TIER_OPTIONS.find((o) => o.value === tier)?.description}
            </p>
          )}

          {/* Prompt Input */}
          <div className="flex gap-3">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter a prompt to test routing..."
              rows={3}
              className="flex-1 rounded-lg bg-surface-3 border border-border text-text-primary placeholder:text-text-muted px-4 py-3 text-sm focus:outline-none focus:border-gong-purple focus:ring-1 focus:ring-gong-purple/30 resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-text-muted">Ctrl+Enter to send</p>
            <button
              onClick={handleSend}
              disabled={!prompt.trim() || singleMutation.isPending || compareLoading}
              className="px-6 py-2.5 rounded-lg bg-gong-purple text-white text-sm font-medium hover:bg-gong-purple-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {(singleMutation.isPending || compareLoading) && <Spinner />}
              {compareMode ? "Compare All Tiers" : "Send"}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Single Result */}
      {!compareMode && singleMutation.isError && (
        <div className="rounded-lg border border-gong-danger/20 bg-gong-danger/10 p-4 text-sm text-gong-danger">
          {(singleMutation.error as Error).message}
        </div>
      )}
      {!compareMode && singleMutation.data && (
        <ResponsePanel result={singleMutation.data} tier={tier} />
      )}

      {/* Compare Results */}
      {compareMode && compareError && (
        <div className="rounded-lg border border-gong-danger/20 bg-gong-danger/10 p-4 text-sm text-gong-danger">
          {compareError}
        </div>
      )}
      {compareMode && compareLoading && (
        <div className="flex items-center justify-center py-12">
          <Spinner size="h-8 w-8" />
        </div>
      )}
      {compareMode && !compareLoading && (compareResults.simple || compareResults.moderate || compareResults.complex) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {(["simple", "moderate", "complex"] as Tier[]).map((t) =>
            compareResults[t] ? (
              <ResponsePanel key={t} result={compareResults[t]!} tier={t} compact />
            ) : (
              <Card key={t} className="opacity-50">
                <CardHeader>
                  <CardTitle className="text-base text-text-muted">
                    {t.charAt(0).toUpperCase() + t.slice(1)} - Failed
                  </CardTitle>
                </CardHeader>
              </Card>
            )
          )}
        </div>
      )}
    </div>
  );
}
