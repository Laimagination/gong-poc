import Link from "next/link";
import { Shield, Search, ShieldCheck, ArrowRight, Zap, BarChart3, Globe } from "lucide-react";

const pocs = [
  {
    title: "AI Governance & Cost Platform",
    desc: "Multi-model routing with LiteLLM, real-time cost tracking, SLA monitoring, and ISO 42001-aligned audit logging.",
    href: "/governance",
    icon: Shield,
    accent: "from-gong-purple to-gong-purple-dark",
    glow: "group-hover:shadow-glow",
    metrics: [
      { label: "3 LLM Providers", icon: Globe },
      { label: "Dept Chargeback", icon: BarChart3 },
      { label: "p50/p95/p99 SLAs", icon: Zap },
    ],
    tag: "POC 1",
    tagColor: "text-gong-purple-light bg-gong-purple/10 border-gong-purple/20",
  },
  {
    title: "Mining for Gold Discovery Engine",
    desc: "Systematic AI opportunity discovery across every Gong department. Four-dimension scoring model with 90-day phased roadmap.",
    href: "/discovery",
    icon: Search,
    accent: "from-gong-accent to-cyan-700",
    glow: "group-hover:shadow-glow-accent",
    metrics: [
      { label: "Department Scan", icon: Globe },
      { label: "Weighted Scoring", icon: BarChart3 },
      { label: "90-Day Roadmap", icon: Zap },
    ],
    tag: "POC 2",
    tagColor: "text-gong-accent-light bg-gong-accent/10 border-gong-accent/20",
  },
  {
    title: "AI Impact Assessment & Lifecycle",
    desc: "ISO 42005-aligned impact assessment and lifecycle management for all 40 automation opportunities with risk scoring and compliance controls.",
    href: "/aims",
    icon: ShieldCheck,
    accent: "from-gong-success to-emerald-700",
    glow: "group-hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]",
    metrics: [
      { label: "ISO 42005 Aligned", icon: Globe },
      { label: "Risk Matrix", icon: BarChart3 },
      { label: "42001 Controls", icon: Zap },
    ],
    tag: "POC 3",
    tagColor: "text-gong-success bg-gong-success/10 border-gong-success/20",
  },
];

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto py-4">
      {/* Hero */}
      <div className="mb-12 opacity-0 animate-fade-up">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-surface-2/60 text-[11px] text-text-muted mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-gong-success animate-pulse" />
          Live Portfolio — David Lai
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight leading-[1.1] mb-4">
          AI Operating Model
          <br />
          <span className="text-gradient">POC Portfolio</span>
        </h1>
        <p className="text-text-secondary text-lg max-w-2xl leading-relaxed">
          Three proof-of-concept demos spanning Strategy & Governance,
          Discovery & Execution, and Impact Assessment & Lifecycle.
        </p>
      </div>

      {/* POC Cards */}
      <div className="space-y-4">
        {pocs.map((poc, i) => {
          const Icon = poc.icon;
          return (
            <Link
              key={poc.href}
              href={poc.href}
              className={`block group opacity-0 animate-fade-up stagger-${i + 2}`}
            >
              <div className={`relative rounded-xl border border-border bg-surface-2/40 p-4 sm:p-6 transition-all duration-300 hover:border-border-strong ${poc.glow} hover:bg-surface-2/70`}>
                <div className="flex items-start gap-3 sm:gap-5">
                  {/* Icon */}
                  <div className={`shrink-0 w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-gradient-to-br ${poc.accent} flex items-center justify-center shadow-lg`}>
                    <Icon size={18} className="text-white sm:hidden" />
                    <Icon size={20} className="text-white hidden sm:block" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${poc.tagColor}`}>
                        {poc.tag}
                      </span>
                      <h2 className="text-base sm:text-lg font-display font-semibold text-text-primary group-hover:text-white transition-colors">
                        {poc.title}
                      </h2>
                    </div>
                    <p className="text-sm text-text-secondary mb-4 leading-relaxed">{poc.desc}</p>

                    {/* Metric pills */}
                    <div className="flex flex-wrap gap-2">
                      {poc.metrics.map((m) => {
                        const MIcon = m.icon;
                        return (
                          <span
                            key={m.label}
                            className="inline-flex items-center gap-1.5 text-[11px] text-text-muted bg-white/[0.03] border border-border rounded-full px-2.5 py-1"
                          >
                            <MIcon size={11} />
                            {m.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="shrink-0 self-center opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                    <ArrowRight size={18} className="text-text-muted" />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Footer stats */}
      <div className="mt-12 pt-8 border-t border-border opacity-0 animate-fade-up stagger-6">
        <div className="grid grid-cols-3 gap-3 sm:gap-6 text-center">
          {[
            { label: "Backend", value: "FastAPI", sub: "Python 3.11" },
            { label: "Frontend", value: "Next.js 15", sub: "React 19 + Tailwind" },
            { label: "Deployment", value: "Docker", sub: "Traefik + SSL" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">{s.label}</p>
              <p className="text-sm font-semibold text-text-primary font-display">{s.value}</p>
              <p className="text-[11px] text-text-muted">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
