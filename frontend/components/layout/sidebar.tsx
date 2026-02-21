"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
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
  ShieldCheck,
  Grid3X3,
  GitBranch,
  ListChecks,
  Network,
  Sparkles,
  Menu,
  X,
} from "lucide-react";

const navSections = [
  {
    title: "Overview",
    items: [
      { label: "Home", href: "/", icon: LayoutDashboard },
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
    title: "Governance",
    items: [
      { label: "Cost Dashboard", href: "/governance", icon: Shield },
      { label: "Model Routing", href: "/governance/routing", icon: Route },
      { label: "SLA Monitor", href: "/governance/sla", icon: Activity },
      { label: "Audit Log", href: "/governance/audit", icon: FileText },
    ],
  },
  {
    title: "AIMS",
    items: [
      { label: "Dashboard", href: "/aims", icon: ShieldCheck },
      { label: "Risk Matrix", href: "/aims/risk-matrix", icon: Grid3X3 },
      { label: "Lifecycle", href: "/aims/lifecycle", icon: GitBranch },
      { label: "Controls", href: "/aims/controls", icon: ListChecks },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { label: "Knowledge Graph", href: "/knowledge-graph", icon: Network },
    ],
  },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {/* Logo */}
      <div className="p-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-gong flex items-center justify-center shadow-sm">
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
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-[7px] text-[13px] rounded-lg transition-all duration-200",
                      active
                        ? "bg-gong-purple/10 text-gong-purple font-medium shadow-sm"
                        : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                    )}
                  >
                    <Icon size={15} className={cn(active && "text-gong-purple")} strokeWidth={active ? 2.2 : 1.8} />
                    <span className="font-body">{item.label}</span>
                    {active && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-gong-purple" />
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
        <div className="w-6 h-6 rounded-full bg-gradient-gong flex items-center justify-center">
          <span className="text-[10px] font-bold text-white">DL</span>
        </div>
        <div>
          <p className="text-[11px] text-text-secondary font-medium">David Lai</p>
          <p className="text-[9px] text-text-muted">Staff AI Enablement</p>
        </div>
      </div>
    </>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center gap-3 px-4 bg-white/90 backdrop-blur-xl border-b border-border">
        <button
          onClick={() => setOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-surface-2 border border-border text-text-secondary hover:text-text-primary transition-colors"
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-gong flex items-center justify-center">
            <Sparkles size={12} className="text-white" />
          </div>
          <span className="text-sm font-display font-bold text-text-primary">
            Gong <span className="text-gradient">AI</span>
          </span>
        </div>
      </div>

      {/* Mobile drawer overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "md:hidden fixed top-0 left-0 z-50 h-screen w-72 flex flex-col bg-white border-r border-border transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary transition-colors"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
        <SidebarContent onNavigate={() => setOpen(false)} />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col h-screen bg-white border-r border-border">
        <SidebarContent />
      </aside>
    </>
  );
}
