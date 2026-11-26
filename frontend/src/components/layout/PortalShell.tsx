"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  GitCompareArrows,
  Activity,
  Radar,
  RefreshCw,
  LogIn,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { PageContainer } from "@/components/layout/PageContainer";

interface SidebarLink {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const pharmacyLinks: SidebarLink[] = [
  {
    label: "Dashboard",
    href: "/pharmacy/dashboard",
    icon: <LayoutDashboard className="w-4 h-4" />,
  },
  {
    label: "Inventory",
    href: "/pharmacy/inventory",
    icon: <Package className="w-4 h-4" />,
  },
  {
    label: "Collaboration",
    href: "/collaboration",
    icon: <GitCompareArrows className="w-4 h-4" />,
  },
];

const intelligenceLinks: SidebarLink[] = [
  {
    label: "Overview",
    href: "/intelligence",
    icon: <Activity className="w-4 h-4" />,
  },
  {
    label: "Shortage Radar",
    href: "/intelligence/shortage-radar",
    icon: <Radar className="w-4 h-4" />,
  },
  {
    label: "Smart Restock",
    href: "/intelligence/smart-restock",
    icon: <RefreshCw className="w-4 h-4" />,
  },
];

const accountLinks: SidebarLink[] = [
  {
    label: "Portal Login",
    href: "/pharmacy/login",
    icon: <LogIn className="w-4 h-4" />,
  },
  {
    label: "Register Pharmacy",
    href: "/pharmacy/register",
    icon: <UserPlus className="w-4 h-4" />,
  },
];

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href;

  const renderLinkGroup = (title: string, links: SidebarLink[]) => (
    <div className="space-y-1">
      <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {title}
      </p>
      <div className="space-y-0.5">
        {links.map((link) => {
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors",
                active
                  ? "bg-teal-50 text-teal-800 border border-teal-200/80"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent"
              )}
            >
              <span className={active ? "text-teal-600" : "text-slate-400"}>
                {link.icon}
              </span>
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );

  const allLinks = [...pharmacyLinks, ...intelligenceLinks];

  return (
    <PageContainer size="xl" className="py-6 sm:py-8">
      {/* Mobile/Tablet Horizontal Portal Navigation */}
      <nav
        aria-label="Portal sections"
        className="lg:hidden mb-6 flex items-center gap-2 overflow-x-auto pb-2"
      >
        {allLinks.map((link) => {
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-colors shrink-0",
                active
                  ? "bg-teal-600 text-white border-teal-600 shadow-xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              )}
            >
              {link.icon}
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex items-start gap-8">
        {/* Desktop Sidebar */}
        <aside
          aria-label="Portal navigation"
          className="hidden lg:flex flex-col gap-6 w-60 shrink-0 sticky top-24 bg-white rounded-2xl border border-slate-200/90 p-4 shadow-[var(--shadow-card)]"
        >
          {renderLinkGroup("Pharmacy Operations", pharmacyLinks)}
          {renderLinkGroup("Network Intelligence", intelligenceLinks)}
          <div className="pt-4 border-t border-slate-100">
            {renderLinkGroup("Portal Access", accountLinks)}
          </div>
        </aside>

        {/* Main Portal Content */}
        <div className="flex-1 min-w-0 space-y-6">{children}</div>
      </div>
    </PageContainer>
  );
}
