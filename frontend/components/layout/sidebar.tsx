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
} from "lucide-react";

const navSections = [
  {
    title: "Overview",
    items: [
      { label: "Home", href: "/", icon: LayoutDashboard },
    ],
  },
  {
    title: "POC 1: Governance",
    items: [
      { label: "Cost Dashboard", href: "/governance", icon: Shield },
      { label: "Model Routing", href: "/governance/routing", icon: Route },
      { label: "SLA Monitor", href: "/governance/sla", icon: Activity },
      { label: "Audit Log", href: "/governance/audit", icon: FileText },
    ],
  },
  {
    title: "POC 2: Discovery",
    items: [
      { label: "Backlog", href: "/discovery", icon: Search },
      { label: "Scoring Model", href: "/discovery/scoring", icon: SlidersHorizontal },
      { label: "90-Day Roadmap", href: "/discovery/roadmap", icon: Map },
    ],
  },
  {
    title: "POC 3: Onboarding",
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
    <aside className="w-64 shrink-0 bg-gong-slate text-white flex flex-col h-screen">
      <div className="p-5 border-b border-gong-slate-light">
        <h1 className="text-lg font-bold tracking-tight">
          <span className="text-gong-purple-light">Gong</span> AI Operating Model
        </h1>
        <p className="text-xs text-gray-400 mt-1">POC Portfolio</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {navSections.map((section) => (
          <div key={section.title} className="mb-4">
            <h2 className="px-5 text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">
              {section.title}
            </h2>
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
                    "flex items-center gap-3 px-5 py-2 text-sm transition-colors",
                    active
                      ? "bg-gong-purple/20 text-gong-purple-light border-r-2 border-gong-purple-light"
                      : "text-gray-300 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-gong-slate-light text-[11px] text-gray-500">
        Built for Gong Staff AI Role
      </div>
    </aside>
  );
}
