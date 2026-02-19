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

function ResponsePanel({ result, tier }: { result: ChatResponse; tier: Tier }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Response</CardTitle>
        <Badge variant={tier === "simple" ? "green" : tier === "moderate" ? "yellow" : "purple"}>
          {tier}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="Model" value={result.model} color={TIER_COLORS[tier]} />
          <MetricCard label="Tokens" value={result.tokens.total.toLocaleString()} />
          <MetricCard label="Cost" value={`$${result.cost_usd.toFixed(4)}`} color="text-gong-warning" />
          <MetricCard label="Latency" value={`${result.latency_ms}ms`} color="text-gong-accent" />
        </div>
        <div className="rounded-lg bg-gray-50 border p-4 text-sm text-gong-slate whitespace-pre-wrap">
          {result.response}
        </div>
      </CardContent>
    </Card>
  );
}

export default function RoutingPlayground() {
  const [prompt, setPrompt] = useState("");
  const [tier, setTier] = useState<Tier>("moderate");
  const [compareMode, setCompareMode] = useState(false);

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
        <h1 className="text-2xl font-bold text-gong-slate">Model Routing Playground</h1>
        <p className="text-sm text-gray-500 mt-1">
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
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-600 ml-auto cursor-pointer">
              <input
                type="checkbox"
                checked={compareMode}
                onChange={(e) => setCompareMode(e.target.checked)}
                className="rounded border-gray-300 text-gong-purple focus:ring-gong-purple"
              />
              Compare all tiers
            </label>
          </div>

          {/* Selected tier description */}
          {!compareMode && (
            <p className="text-xs text-gray-400">
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
              className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gong-purple focus:border-transparent resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">Ctrl+Enter to send</p>
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
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {(singleMutation.error as Error).message}
        </div>
      )}
      {!compareMode && singleMutation.data && (
        <ResponsePanel result={singleMutation.data} tier={tier} />
      )}

      {/* Compare Results */}
      {compareMode && compareError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
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
              <ResponsePanel key={t} result={compareResults[t]!} tier={t} />
            ) : (
              <Card key={t} className="opacity-50">
                <CardHeader>
                  <CardTitle className="text-base text-gray-400">
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
