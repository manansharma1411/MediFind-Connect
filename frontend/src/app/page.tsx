import React from "react";
import Link from "next/link";
import {
  Search,
  Building2,
  GitCompareArrows,
  Activity,
  ArrowRight,
  ShieldCheck,
  Radar,
  PackageCheck,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BackendHealthBadge } from "@/components/shared/BackendHealthBadge";

const domainModules = [
  {
    title: "Patient Medicine Discovery",
    description:
      "Locate verified local stock, compare pharmacy pricing, and view real-time availability indicators.",
    href: "/medicines",
    cta: "Open Medicine Shell",
    icon: <Search className="w-5 h-5 text-teal-600" />,
    badge: "Patient Domain",
  },
  {
    title: "Partner Pharmacy Directory",
    description:
      "Browse neighborhood pharmacies, operating schedules, and verified store profiles.",
    href: "/pharmacies",
    cta: "Open Pharmacy Shell",
    icon: <Building2 className="w-5 h-5 text-teal-600" />,
    badge: "Patient Domain",
  },
  {
    title: "Pharmacy Operations Console",
    description:
      "Manage store inventory, batch thresholds, low-stock alerts, and patient pickup holds.",
    href: "/pharmacy/dashboard",
    cta: "Open Console Shell",
    icon: <PackageCheck className="w-5 h-5 text-teal-600" />,
    badge: "Pharmacy Portal",
  },
  {
    title: "Inter-Pharmacy Collaboration",
    description:
      "Coordinate peer-to-peer stock transfers, runner dispatches, and verified handoffs.",
    href: "/collaboration",
    cta: "Open Collaboration Shell",
    icon: <GitCompareArrows className="w-5 h-5 text-teal-600" />,
    badge: "B2B Network",
  },
  {
    title: "Regional Shortage Radar",
    description:
      "Monitor emerging neighborhood stockouts and unfulfilled demand spikes.",
    href: "/intelligence/shortage-radar",
    cta: "Open Radar Shell",
    icon: <Radar className="w-5 h-5 text-sky-600" />,
    badge: "Intelligence",
  },
  {
    title: "Smart Restock Planner",
    description:
      "Review data-driven replenishment insights and supply-demand matching.",
    href: "/intelligence/smart-restock",
    cta: "Open Restock Shell",
    icon: <Activity className="w-5 h-5 text-sky-600" />,
    badge: "Intelligence",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col pb-16">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-teal-50/80 via-slate-50 to-slate-50 border-b border-slate-200/80 py-14 sm:py-20">
        <PageContainer>
          <div className="max-w-3xl mx-auto text-center space-y-5">
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <Badge variant="brand" dot>
                Phase 2 Frontend Foundation
              </Badge>
              <BackendHealthBadge />
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.12]">
              The collaborative intelligence network for{" "}
              <span className="text-teal-600">medicine access</span>.
            </h1>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
              MediFind Connect links patients, community pharmacies, and
              regional supply intelligence into one unified clinical platform.
            </p>

            {/* Foundation Quick Links */}
            <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/medicines"
                className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 transition-colors shadow-sm"
              >
                <Search className="w-4 h-4" />
                <span>Explore Medicines Shell</span>
              </Link>
              <Link
                href="/pharmacy/register"
                className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-white text-slate-800 border border-slate-200 font-semibold text-sm hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-xs"
              >
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                <span>Pharmacy Onboarding</span>
              </Link>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* Architecture & Route Shells Grid */}
      <section className="pt-12 sm:pt-16">
        <PageContainer className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Application Architecture Shells
              </h2>
              <p className="text-sm text-slate-600">
                Verified routing foundation for all MediFind Connect domains.
                Feature logic will connect in upcoming phases.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="success" dot>
                Design System Active
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {domainModules.map((mod) => (
              <Card key={mod.href} interactive className="flex flex-col justify-between">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center">
                      {mod.icon}
                    </div>
                    <Badge variant="neutral">{mod.badge}</Badge>
                  </div>
                  <CardTitle>{mod.title}</CardTitle>
                  <CardDescription>{mod.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Link
                    href={mod.href}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-800 transition-colors"
                  >
                    <span>{mod.cta}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </PageContainer>
      </section>
    </div>
  );
}
