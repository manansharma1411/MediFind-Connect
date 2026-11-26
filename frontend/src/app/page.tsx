import React from "react";
import Link from "next/link";
import {
  Search,
  Building2,
  GitCompareArrows,
  Radar,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  MapPin,
  Lock,
  Activity,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { AvailabilityBadge, Badge } from "@/components/ui/Badge";
import { BackendHealthBadge } from "@/components/shared/BackendHealthBadge";

const workflowSteps = [
  {
    step: "01",
    title: "Patient Medicine Discovery",
    description:
      "Search by brand or generic composition, compare local availability, and locate nearby pharmacies.",
    icon: <Search className="w-5 h-5 text-teal-600" />,
  },
  {
    step: "02",
    title: "Pharmacy Inventory & Transfers",
    description:
      "Community pharmacies maintain structured stock records and coordinate peer-to-peer transfers to resolve stockouts.",
    icon: <GitCompareArrows className="w-5 h-5 text-teal-600" />,
  },
  {
    step: "03",
    title: "Shortage & Restock Intelligence",
    description:
      "Verified network signals highlight emerging regional shortages and support timely replenishment planning.",
    icon: <Radar className="w-5 h-5 text-sky-600" />,
  },
];

const platformPillars = [
  {
    title: "For Patients & Caregivers",
    subtitle: "Clarity before you travel",
    description:
      "Eliminate guesswork when searching for essential prescriptions. View generic equivalents, store hours, distance, and availability status in one place.",
    points: [
      "Search by brand name, generic salt, or category",
      "Filter by availability, open hours, and distance",
      "Clear OTC vs. prescription-required indicators",
    ],
    href: "/medicines",
    cta: "Search Medicines",
    icon: <Search className="w-5 h-5 text-teal-600" />,
  },
  {
    title: "For Community Pharmacies",
    subtitle: "Connected operations & B2B sharing",
    description:
      "Turn isolated store inventories into a resilient neighborhood network. Track low-stock items and fulfill urgent patient demand through verified inter-pharmacy transfers.",
    points: [
      "Centralized SKU, batch, and stock status tracking",
      "Structured transfer requests with step-by-step audit trail",
      "Dedicated operational console and onboarding",
    ],
    href: "/pharmacy/dashboard",
    cta: "Open Pharmacy Portal",
    icon: <Building2 className="w-5 h-5 text-teal-600" />,
  },
  {
    title: "Demand & Shortage Insights",
    subtitle: "Evidence-backed supply visibility",
    description:
      "Understand where medicine access gaps are forming. Intelligence views surface regional shortage signals and restock guidance only when backed by verified data.",
    points: [
      "Transparent shortage severity and evidence summaries",
      "Smart restock suggestions with lead-time context",
      "Honest uncertainty and empty states when data is sparse",
    ],
    href: "/intelligence",
    cta: "Explore Intelligence",
    icon: <Activity className="w-5 h-5 text-sky-600" />,
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* 1. Hero Section */}
      <section className="bg-gradient-to-b from-teal-50/80 via-slate-50 to-slate-50 border-b border-slate-200/80 py-14 sm:py-20">
        <PageContainer>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge variant="brand" dot>
                  MediFind Connect Platform
                </Badge>
                <BackendHealthBadge />
              </div>

              <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.12]">
                The collaborative intelligence network for{" "}
                <span className="text-teal-600">medicine access</span>.
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
                MediFind Connect brings patients, community pharmacies, and
                supply intelligence together—making it easier to locate
                essential medicines nearby and coordinate stock across local
                pharmacy networks.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  href="/medicines"
                  className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 transition-colors shadow-sm"
                >
                  <Search className="w-4 h-4" />
                  <span>Find Medicines Nearby</span>
                </Link>
                <Link
                  href="/pharmacy/register"
                  className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-white text-slate-800 border border-slate-200 font-semibold text-sm hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-xs"
                >
                  <Building2 className="w-4 h-4 text-teal-600" />
                  <span>Partner as a Pharmacy</span>
                </Link>
              </div>
            </div>

            {/* Composed Interface Preview (Clearly Labeled) */}
            <div className="lg:col-span-5">
              <Card elevated className="overflow-hidden border-slate-200/90">
                <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-200">
                    Interface Preview • Availability Card
                  </span>
                  <Badge variant="neutral" className="bg-slate-800 text-teal-300 border-slate-700">
                    Sample Layout
                  </Badge>
                </div>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide">
                        Analgesic • OTC
                      </p>
                      <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                        Paracetamol 650 mg
                      </h2>
                      <p className="text-xs text-slate-500">
                        Generic composition • Tablet strip
                      </p>
                    </div>
                    <AvailabilityBadge status="in_stock" />
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-teal-600" />
                        Nearby Partner Pharmacy
                      </span>
                      <span className="text-slate-500">Distance preview</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>Status indicators adapt to live stock</span>
                      <span className="font-bold text-teal-700">
                        Transparent pricing
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
                    <span>Connected to pharmacy inventory</span>
                    <Link
                      href="/medicines"
                      className="font-semibold text-teal-700 hover:text-teal-800 inline-flex items-center gap-1"
                    >
                      <span>Try Discovery UI</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* 2. How the Platform Works */}
      <section id="how-it-works" className="py-14 sm:py-16 bg-white border-b border-slate-200/80">
        <PageContainer className="space-y-10">
          <div className="max-w-2xl space-y-2">
            <Badge variant="brand">How It Works</Badge>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Three connected layers for reliable medicine access
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Instead of treating every pharmacy in isolation, MediFind Connect
              coordinates patient discovery, inter-store stock sharing, and
              regional shortage visibility.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {workflowSteps.map((item) => (
              <Card key={item.step} className="bg-slate-50/50">
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center">
                      {item.icon}
                    </div>
                    <span className="font-mono text-xs font-bold text-slate-400">
                      STEP {item.step}
                    </span>
                  </div>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </PageContainer>
      </section>

      {/* 3. Platform Pillars */}
      <section className="py-14 sm:py-16">
        <PageContainer className="space-y-10">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Designed for every participant in the access chain
            </h2>
            <p className="text-sm sm:text-base text-slate-600">
              Dedicated interfaces tailored for patients, pharmacists, and
              regional supply coordination.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {platformPillars.map((pillar) => (
              <Card
                key={pillar.title}
                interactive
                className="flex flex-col justify-between"
              >
                <CardHeader className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center">
                    {pillar.icon}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide">
                      {pillar.subtitle}
                    </p>
                    <CardTitle className="mt-1">{pillar.title}</CardTitle>
                  </div>
                  <CardDescription>{pillar.description}</CardDescription>
                </CardHeader>

                <CardContent className="pt-0 space-y-5">
                  <ul className="space-y-2">
                    {pillar.points.map((pt) => (
                      <li
                        key={pt}
                        className="flex items-start gap-2 text-xs sm:text-sm text-slate-600"
                      >
                        <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={pillar.href}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-800 transition-colors"
                  >
                    <span>{pillar.cta}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </PageContainer>
      </section>

      {/* 4. Trust & Responsible Data Handling */}
      <section className="pb-16">
        <PageContainer>
          <div className="rounded-3xl bg-slate-900 text-white p-8 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-3">
              <div className="inline-flex items-center gap-2 text-teal-400 text-xs font-bold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>Trust & Responsible Data Handling</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Clinical clarity without fabricated predictions
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                MediFind Connect separates verified pharmacy inventory from
                analytical insights, never exposes privileged credentials in the
                browser, and never substitutes for licensed medical advice or
                prescription verification.
              </p>
            </div>
            <div className="lg:col-span-4 flex flex-col gap-3">
              <div className="p-4 rounded-2xl bg-slate-800/90 border border-slate-700 flex items-start gap-3">
                <Lock className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300 leading-relaxed">
                  <strong className="text-white block mb-0.5">
                    Role-Scoped Access
                  </strong>
                  Pharmacy inventory and transfer actions require authenticated
                  server verification.
                </div>
              </div>
              <Link
                href="/pharmacies"
                className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm transition-colors"
              >
                <span>Browse Partner Directory</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </PageContainer>
      </section>
    </div>
  );
}
