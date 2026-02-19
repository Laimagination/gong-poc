"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AuditEntry {
  id: number;
  timestamp: string;
  department: string;
  model: string;
  provider: string;
  task_tier: string;
  total_tokens: number;
  cost_usd: number;
  latency_ms: number;
  status: string;
}

interface AuditData {
  entries: AuditEntry[];
  total_records: number;
}

type SortKey = keyof AuditEntry;
type SortDir = "asc" | "desc";

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gong-purple border-t-transparent" />
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-gong-danger/20 bg-gong-danger/10 p-4 text-sm text-gong-danger">
      {message}
    </div>
  );
}

const PAGE_SIZE = 20;

const STATUS_VARIANT: Record<string, "green" | "red" | "yellow" | "default"> = {
  success: "green",
  error: "red",
  timeout: "yellow",
};

export default function AuditLog() {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [modelFilter, setModelFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);

  const { data, isLoading, isError, error } = useQuery<AuditData>({
    queryKey: ["governance", "audit"],
    queryFn: () => apiFetch("/governance/audit"),
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  };

  const departments = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.entries.map((e) => e.department))].sort();
  }, [data]);

  const models = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.entries.map((e) => e.model))].sort();
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let entries = data.entries;

    if (deptFilter !== "all") entries = entries.filter((e) => e.department === deptFilter);
    if (modelFilter !== "all") entries = entries.filter((e) => e.model === modelFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.department.toLowerCase().includes(q) ||
          e.model.toLowerCase().includes(q) ||
          e.status.toLowerCase().includes(q) ||
          String(e.id).includes(q)
      );
    }

    entries = [...entries].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      const sa = String(av);
      const sb = String(bv);
      return sortDir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });

    return entries;
  }, [data, deptFilter, modelFilter, search, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageEntries = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const exportCsv = useCallback(() => {
    if (!filtered.length) return;
    const headers = ["ID", "Timestamp", "Department", "Model", "Tokens", "Cost", "Latency (ms)", "Status"];
    const rows = filtered.map((e) => [
      e.id,
      e.timestamp,
      e.department,
      e.model,
      e.total_tokens,
      e.cost_usd,
      e.latency_ms,
      e.status,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorBox message={`Failed to load audit log: ${(error as Error).message}`} />;

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <span className="text-text-muted ml-1">&#8597;</span>;
    return <span className="text-gong-purple ml-1">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-text-primary">Audit Log</h1>
          <p className="text-sm text-text-secondary mt-1">
            {data!.total_records} total entries{filtered.length !== data!.total_records ? ` (${filtered.length} filtered)` : ""}
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={!filtered.length}
          className="px-4 py-2 rounded-lg bg-gong-purple text-white text-sm font-medium hover:bg-gong-purple-dark disabled:opacity-50 transition-colors"
        >
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search..."
              className="flex-1 min-w-[200px] rounded-lg bg-surface-3 border border-border text-text-primary placeholder:text-text-muted px-3 py-2 text-sm focus:outline-none focus:border-gong-purple focus:ring-1 focus:ring-gong-purple/30"
            />
            <select
              value={deptFilter}
              onChange={(e) => { setDeptFilter(e.target.value); setPage(0); }}
              className="rounded-lg bg-surface-3 border border-border text-text-primary px-3 py-2 text-sm focus:outline-none focus:border-gong-purple focus:ring-1 focus:ring-gong-purple/30"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <select
              value={modelFilter}
              onChange={(e) => { setModelFilter(e.target.value); setPage(0); }}
              className="rounded-lg bg-surface-3 border border-border text-text-primary px-3 py-2 text-sm focus:outline-none focus:border-gong-purple focus:ring-1 focus:ring-gong-purple/30"
            >
              <option value="all">All Models</option>
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary bg-surface-2/40">
                {[
                  { key: "timestamp" as SortKey, label: "Time" },
                  { key: "department" as SortKey, label: "Department" },
                  { key: "model" as SortKey, label: "Model" },
                  { key: "total_tokens" as SortKey, label: "Tokens" },
                  { key: "cost_usd" as SortKey, label: "Cost" },
                  { key: "latency_ms" as SortKey, label: "Latency" },
                  { key: "status" as SortKey, label: "Status" },
                ].map((col) => (
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
              {pageEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-text-muted">
                    No entries found
                  </td>
                </tr>
              ) : (
                pageEntries.map((entry) => (
                  <tr key={entry.id} className="border-b border-border hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 pr-4 whitespace-nowrap text-text-secondary">
                      {new Date(entry.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 pr-4 text-text-secondary">{entry.department}</td>
                    <td className="py-3 pr-4">
                      <code className="text-xs bg-white/[0.06] text-text-primary rounded px-1.5 py-0.5">{entry.model}</code>
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums text-text-secondary">{entry.total_tokens.toLocaleString()}</td>
                    <td className="py-3 pr-4 text-right tabular-nums text-text-secondary">${entry.cost_usd.toFixed(4)}</td>
                    <td className="py-3 pr-4 text-right tabular-nums text-text-secondary">{entry.latency_ms}ms</td>
                    <td className="py-3 pr-4">
                      <Badge variant={STATUS_VARIANT[entry.status] || "default"}>
                        {entry.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-text-secondary">
            Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg bg-surface-3 border border-border text-text-secondary hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pageNum = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`px-3 py-1.5 rounded-lg border transition-colors ${
                    page === pageNum
                      ? "bg-gong-purple text-white border-gong-purple"
                      : "bg-surface-3 border-border text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {pageNum + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg bg-surface-3 border border-border text-text-secondary hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
