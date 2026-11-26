"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Pill,
  Search,
  Building2,
  Menu,
  X,
  LogIn,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { PageContainer } from "@/components/layout/PageContainer";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const publicNavItems: NavItem[] = [
  {
    label: "Find Medicines",
    href: "/medicines",
    icon: <Search className="w-4 h-4" />,
  },
  {
    label: "Pharmacies",
    href: "/pharmacies",
    icon: <Building2 className="w-4 h-4" />,
  },
  {
    label: "How It Works",
    href: "/#how-it-works",
    icon: <Pill className="w-4 h-4" />,
  },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (href: string) => {
    if (href.startsWith("/#")) return false;
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const inPortal =
    pathname.startsWith("/pharmacy") ||
    pathname.startsWith("/collaboration") ||
    pathname.startsWith("/intelligence");

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/90">
      <PageContainer>
        <div className="h-16 flex items-center justify-between gap-4">
          {/* Brand Identity */}
          <Link
            href="/"
            className="flex items-center gap-2.5 group shrink-0"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm group-hover:bg-teal-700 transition-colors">
              <Pill className="w-5 h-5 rotate-45" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-extrabold text-slate-900 tracking-tight leading-none">
                MediFind <span className="text-teal-600">Connect</span>
              </span>
              <span className="text-[10px] font-medium text-slate-500 tracking-wide mt-0.5 hidden sm:block">
                Medicine Access Network
              </span>
            </div>
          </Link>

          {/* Public Discovery Navigation */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-1"
          >
            {publicNavItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors",
                    active
                      ? "bg-teal-50 text-teal-800 border border-teal-200/70"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border border-transparent"
                  )}
                >
                  <span className={active ? "text-teal-600" : "text-slate-400"}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Pharmacy Portal Actions */}
          <div className="hidden md:flex items-center gap-2.5 shrink-0">
            <Link
              href="/pharmacy/dashboard"
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors",
                inPortal
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              )}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Pharmacy Portal</span>
            </Link>
            <Link
              href="/pharmacy/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-xs"
            >
              <LogIn className="w-4 h-4" />
              <span>Partner Login</span>
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </PageContainer>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white">
          <PageContainer className="py-4 space-y-2">
            {publicNavItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors",
                    active
                      ? "bg-teal-50 text-teal-800"
                      : "text-slate-700 hover:bg-slate-100"
                  )}
                >
                  <span className={active ? "text-teal-600" : "text-slate-400"}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <div className="pt-3 mt-3 border-t border-slate-100 flex flex-col gap-2">
              <Link
                href="/pharmacy/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 text-center"
              >
                Pharmacy Portal
              </Link>
              <Link
                href="/pharmacy/login"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 text-center"
              >
                Partner Login
              </Link>
            </div>
          </PageContainer>
        </div>
      )}
    </header>
  );
}
