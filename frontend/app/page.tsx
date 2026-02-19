import Link from "next/link";
import { Shield, Search, Users } from "lucide-react";

const pocs = [
  {
    title: "AI Governance & Cost Platform",
    desc: "Multi-model routing with LiteLLM, real-time cost tracking, SLA monitoring, and ISO 42001-aligned audit logging. Demonstrates financial governance and vendor management at scale.",
    href: "/governance",
    icon: Shield,
    color: "bg-purple-50 border-purple-200 text-purple-700",
    iconColor: "text-purple-600",
    metrics: ["3 LLM Providers", "Dept Chargeback", "p50/p95/p99 SLAs"],
  },
  {
    title: "Mining for Gold Discovery Engine",
    desc: "Systematic AI opportunity discovery across every Gong department. Four-dimension scoring model, prioritized backlog, and a 90-day phased roadmap aligned to Jim Gearhart's published IT philosophy.",
    href: "/discovery",
    icon: Search,
    color: "bg-cyan-50 border-cyan-200 text-cyan-700",
    iconColor: "text-cyan-600",
    metrics: ["Department Scan", "Weighted Scoring", "90-Day Roadmap"],
  },
  {
    title: "AI Onboarding Orchestrator",
    desc: "LangGraph-powered multi-agent workflow for employee onboarding. Coordinates identity provisioning, workspace setup, and equipment ordering with real-time progress tracking.",
    href: "/onboarding",
    icon: Users,
    color: "bg-emerald-50 border-emerald-200 text-emerald-700",
    iconColor: "text-emerald-600",
    metrics: ["5 AI Agents", "Live WebSocket", "Mock Enterprise APIs"],
  },
];

export default function Home() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gong-slate">AI Operating Model POC Portfolio</h1>
        <p className="text-gray-500 mt-2 text-lg">
          Three proof-of-concept demos spanning Strategy & Governance, Discovery & Execution, and Financial & Performance Operations.
        </p>
      </div>

      <div className="grid gap-6">
        {pocs.map((poc) => {
          const Icon = poc.icon;
          return (
            <Link key={poc.href} href={poc.href} className="block group">
              <div className={`rounded-xl border-2 p-6 transition-shadow hover:shadow-lg ${poc.color}`}>
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg bg-white/70 ${poc.iconColor}`}>
                    <Icon size={28} />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold mb-2 group-hover:underline">{poc.title}</h2>
                    <p className="text-sm opacity-80 mb-4">{poc.desc}</p>
                    <div className="flex gap-3 flex-wrap">
                      {poc.metrics.map((m) => (
                        <span key={m} className="text-xs font-medium bg-white/60 rounded-full px-3 py-1">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
