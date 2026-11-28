"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Building2,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Pill,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { PageContainer } from "@/components/layout/PageContainer";
import { AdminAuthGuard } from "@/components/admin/AdminAuthGuard";
import { usePharmacyAuth } from "@/context/PharmacyAuthContext";

interface AdminNavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    label: "Admin Overview",
    href: "/admin",
    icon: <LayoutDashboard className="w-4 h-4" />,
  },
  {
    label: "Pharmacy Verification",
    href: "/admin/pharmacy-verification",
    icon: <ClipboardCheck className="w-4 h-4" />,
  },
  {
    label: "Pharmacies",
    href: "/admin/pharmacies",
    icon: <Building2 className="w-4 h-4" />,
  },
  {
    label: "Users",
    href: "/admin/users",
    icon: <Users className="w-4 h-4" />,
  },
  {
    label: "Medicines",
    href: "/admin/medicines",
    icon: <Pill className="w-4 h-4" />,
  },
  {
    label: "Platform Analytics",
    href: "/admin/analytics",
    icon: <Activity className="w-4 h-4" />,
  },
  {
    label: "Audit Logs",
    href: "/admin/audit-logs",
    icon: <FileText className="w-4 h-4" />,
  },
  {
    label: "Admin Settings",
    href: "/admin/settings",
    icon: <Settings className="w-4 h-4" />,
  },
];

export function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminAuthGuard>
      <SuperAdminShell>{children}</SuperAdminShell>
    </AdminAuthGuard>
  );
}

function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session, logout } = usePharmacyAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const renderNavLinks = () =>
    ADMIN_NAV_ITEMS.map((item) => {
      const active = pathname === item.href;
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setMobileOpen(false)}
          className={cn(
            "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors",
            active
              ? "bg-teal-50 text-teal-800 border border-teal-200/80"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent"
          )}
        >
          <span className={active ? "text-teal-600" : "text-slate-400"}>
            {item.icon}
          </span>
          <span>{item.label}</span>
        </Link>
      );
    });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Super Admin Top Bar */}
      <div className="bg-slate-950 text-white border-b border-slate-800">
        <PageContainer size="xl" className="py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileOpen((prev) => !prev)}
                className="lg:hidden p-2 rounded-lg text-slate-300 hover:bg-slate-800"
                aria-label="Toggle admin navigation"
              >
                {mobileOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>

              <Link
                href="/admin"
                className="flex items-center gap-2.5 min-w-0"
              >
                <div className="w-9 h-9 rounded-xl bg-teal-500 text-slate-950 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold tracking-tight truncate">
                    MediFind Connect · Super Admin
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    Centralized Platform Governance & Verification Control
                  </p>
                </div>
              </Link>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Badge
                variant="brand"
                className="hidden sm:inline-flex bg-slate-800 text-teal-300 border-slate-700"
              >
                {session?.email}
              </Badge>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 hover:bg-slate-800 border border-slate-700 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </PageContainer>
      </div>

      <PageContainer size="xl" className="py-6 sm:py-8">
        {mobileOpen && (
          <nav
            aria-label="Mobile super admin navigation"
            className="lg:hidden mb-6 bg-white rounded-2xl border border-slate-200 p-4 space-y-1 shadow-sm"
          >
            {renderNavLinks()}
          </nav>
        )}

        <div className="flex items-start gap-8">
          <aside
            aria-label="Super admin navigation"
            className="hidden lg:flex flex-col gap-1 w-64 shrink-0 sticky top-24 bg-white rounded-2xl border border-slate-200/90 p-4 shadow-[var(--shadow-card)]"
          >
            <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Platform Administration
            </p>
            {renderNavLinks()}
          </aside>

          <main className="flex-1 min-w-0 space-y-6">{children}</main>
        </div>
      </PageContainer>
    </div>
  );
}
