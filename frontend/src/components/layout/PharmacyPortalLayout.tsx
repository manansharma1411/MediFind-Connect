"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  PlusCircle,
  History,
  Bell,
  Building2,
  Settings,
  LogOut,
  Menu,
  X,
  UserCircle2,
  Activity,
  Search,
  Inbox,
  Send,
  FileText,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/Badge";
import { usePharmacyAuth } from "@/context/PharmacyAuthContext";
import { PharmacyAuthGuard } from "@/components/pharmacy/PharmacyAuthGuard";
import { getPharmacyAlerts } from "@/services/pharmacyService";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badgeCount?: number;
}

export function PharmacyPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PharmacyAuthGuard>
      <PharmacyPortalShell>{children}</PharmacyPortalShell>
    </PharmacyAuthGuard>
  );
}

function PharmacyPortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session, logout } = usePharmacyAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [alertCount, setAlertCount] = useState<number>(0);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    getPharmacyAlerts(session, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted && res.data) {
          setAlertCount(res.data.length);
        }
      })
      .catch(() => {
        // Ignore alert badge fetch errors in shell header
      });
    return () => controller.abort();
  }, [session]);

  const primaryNav: NavItem[] = [
    {
      label: "Overview",
      href: "/pharmacy/dashboard",
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      label: "Inventory",
      href: "/pharmacy/inventory",
      icon: <Package className="w-4 h-4" />,
    },
    {
      label: "Add Medicine",
      href: "/pharmacy/inventory/add",
      icon: <PlusCircle className="w-4 h-4" />,
    },
    {
      label: "Stock History",
      href: "/pharmacy/history",
      icon: <History className="w-4 h-4" />,
    },
    {
      label: "Alerts",
      href: "/pharmacy/alerts",
      icon: <Bell className="w-4 h-4" />,
      badgeCount: alertCount > 0 ? alertCount : undefined,
    },
    {
      label: "Pharmacy Profile",
      href: "/pharmacy/profile",
      icon: <Building2 className="w-4 h-4" />,
    },
    {
      label: "Settings",
      href: "/pharmacy/settings",
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  const collaborationNav: NavItem[] = [
    {
      label: "Stock Discovery",
      href: "/collaboration/discover",
      icon: <Search className="w-4 h-4" />,
    },
    {
      label: "Incoming Requests",
      href: "/collaboration/incoming",
      icon: <Inbox className="w-4 h-4" />,
    },
    {
      label: "Outgoing Requests",
      href: "/collaboration/outgoing",
      icon: <Send className="w-4 h-4" />,
    },
    {
      label: "Transfer Details",
      href: "/collaboration",
      icon: <FileText className="w-4 h-4" />,
    },
    {
      label: "Transfer History",
      href: "/collaboration/history",
      icon: <Clock className="w-4 h-4" />,
    },
  ];

  const networkNav: NavItem[] = [
    {
      label: "Intelligence",
      href: "/intelligence",
      icon: <Activity className="w-4 h-4" />,
    },
  ];

  const isActive = (href: string) => pathname === href;

  const renderLinks = (items: NavItem[]) =>
    items.map((item) => {
      const active = isActive(item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setMobileNavOpen(false)}
          className={cn(
            "flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors",
            active
              ? "bg-teal-50 text-teal-800 border border-teal-200/80"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent"
          )}
        >
          <span className="flex items-center gap-2.5">
            <span className={active ? "text-teal-600" : "text-slate-400"}>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </span>
          {typeof item.badgeCount === "number" && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
              {item.badgeCount}
            </span>
          )}
        </Link>
      );
    });

  return (
    <div className="flex-1 bg-slate-50">
      {/* Pharmacy Identity & Account Header Bar */}
      <div className="bg-white border-b border-slate-200/90">
        <PageContainer size="xl" className="py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileNavOpen((prev) => !prev)}
                className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"
                aria-label="Toggle pharmacy sidebar"
              >
                {mobileNavOpen ? (
                  <X className="w-4 h-4" />
                ) : (
                  <Menu className="w-4 h-4" />
                )}
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 truncate">
                    {session?.pharmacyName}
                  </span>
                  {session?.isPreviewSession ? (
                    <Badge variant="warning">UI Preview Session</Badge>
                  ) : (
                    <Badge variant="success" dot>
                      Authenticated
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 truncate">
                  Store ID: <span className="font-mono">{session?.pharmacyId}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Link
                href="/pharmacy/alerts"
                className="relative p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="View pharmacy alerts"
              >
                <Bell className="w-4 h-4" />
                {alertCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500" />
                )}
              </Link>

              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 text-xs text-slate-700">
                <UserCircle2 className="w-4 h-4 text-teal-600" />
                <span className="font-semibold">{session?.displayName}</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-500">{session?.role}</span>
              </div>

              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </PageContainer>
      </div>

      <PageContainer size="xl" className="py-6 sm:py-8">
        {/* Mobile Drawer Navigation */}
        {mobileNavOpen && (
          <nav
            aria-label="Mobile pharmacy navigation"
            className="lg:hidden mb-6 bg-white rounded-2xl border border-slate-200 p-4 space-y-4 shadow-sm"
          >
            <div className="space-y-1">{renderLinks(primaryNav)}</div>
            <div className="pt-3 border-t border-slate-100 space-y-1">
              <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Collaboration
              </p>
              {renderLinks(collaborationNav)}
            </div>
            <div className="pt-3 border-t border-slate-100 space-y-1">
              <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Intelligence
              </p>
              {renderLinks(networkNav)}
            </div>
          </nav>
        )}

        <div className="flex items-start gap-8">
          {/* Desktop Sidebar */}
          <aside
            aria-label="Pharmacy portal navigation"
            className="hidden lg:flex flex-col gap-5 w-64 shrink-0 sticky top-24 bg-white rounded-2xl border border-slate-200/90 p-4 shadow-[var(--shadow-card)]"
          >
            <div className="space-y-1">
              <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Pharmacy Management
              </p>
              <div className="space-y-0.5">{renderLinks(primaryNav)}</div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-1">
              <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Collaboration
              </p>
              <div className="space-y-0.5">{renderLinks(collaborationNav)}</div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-1">
              <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Intelligence
              </p>
              <div className="space-y-0.5">{renderLinks(networkNav)}</div>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1 min-w-0 space-y-6">{children}</div>
        </div>
      </PageContainer>
    </div>
  );
}
