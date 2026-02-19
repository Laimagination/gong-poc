"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Shield,
  Route,
  Activity,
  FileText,
  Search,
  SlidersHorizontal,
  Map,
  Users,
  UserPlus,
  ClipboardList,
  Sparkles,
} from "lucide-react";

const navSections = [
  {
    title: "Overview",
    items: [
      { label: "Home", href: "/", icon: LayoutDashboard },
    ],
  },
  {
    title: "Governance",
    items: [
      { label: "Cost Dashboard", href: "/governance", icon: Shield },
      { label: "Model Routing", href: "/governance/routing", icon: Route },
      { label: "SLA Monitor", href: "/governance/sla", icon: Activity },
      { label: "Audit Log", href: "/governance/audit", icon: FileText },
    ],
  },
  {
    title: "Discovery",
    items: [
      { label: "Backlog", href: "/discovery", icon: Search },
      { label: "Scoring Model", href: "/discovery/scoring", icon: SlidersHorizontal },
      { label: "90-Day Roadmap", href: "/discovery/roadmap", icon: Map },
    ],
  },
  {
    title: "Onboarding",
    items: [
      { label: "Workflow", href: "/onboarding", icon: Users },
      { label: "New Hire", href: "/onboarding/new", icon: UserPlus },
      { label: "Status", href: "/onboarding/status", icon: ClipboardList },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 flex flex-col h-screen bg-surface-1/80 backdrop-blur-xl border-r border-border">
      {/* Logo */}
      <div className="p-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-gong flex items-center justify-center shadow-glow">
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-display font-bold tracking-tight text-text-primary">
              Gong <span className="text-gradient">AI</span>
            </h1>
            <p className="text-[10px] text-text-muted leading-none">Operating Model</p>
          </div>
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-border-strong to-transparent" />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {navSections.map((section, sIdx) => (
          <div key={section.title} className={cn(sIdx > 0 && "mt-5")}>
            <h2 className="px-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted mb-1.5 font-body">
              {section.title}
            </h2>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-[7px] text-[13px] rounded-lg transition-all duration-200",
                      active
                        ? "bg-gong-purple/15 text-gong-purple-light shadow-sm shadow-gong-purple-glow"
                        : "text-text-secondary hover:bg-white/[0.04] hover:text-text-primary"
                    )}
                  >
                    <Icon size={15} className={cn(active && "text-gong-purple-light")} strokeWidth={active ? 2.2 : 1.8} />
                    <span className="font-body">{item.label}</span>
                    {active && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-gong-purple-light shadow-sm shadow-gong-purple-light/50" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="h-px bg-gradient-to-r from-transparent via-border-strong to-transparent" />

      {/* Footer */}
      <div className="p-4 flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-gradient-gong-subtle flex items-center justify-center">
          <span className="text-[10px] font-bold text-gong-purple-light">DL</span>
        </div>
        <div>
          <p className="text-[11px] text-text-secondary font-medium">David Lai</p>
          <p className="text-[9px] text-text-muted">Staff AI Enablement</p>
        </div>
      </div>
    </aside>
  );
}
