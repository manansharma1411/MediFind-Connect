import React from "react";
import Link from "next/link";
import { Pill, Info } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";

export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 mt-auto">
      <PageContainer className="py-10 space-y-8">
        {/* Clinical Safety Notice */}
        <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-start sm:items-center gap-3 text-xs text-slate-300">
          <Info className="w-5 h-5 text-teal-400 shrink-0 mt-0.5 sm:mt-0" />
          <p className="leading-relaxed">
            <strong className="text-white">Clinical Notice:</strong> MediFind
            Connect provides medicine availability and inter-pharmacy
            collaboration infrastructure. It does not replace qualified medical
            diagnosis, treatment advice, or prescription verification.
          </p>
        </div>

        {/* Footer Columns */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-sm">
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center">
                <Pill className="w-4 h-4 rotate-45" />
              </div>
              <span className="font-extrabold text-white text-base tracking-tight">
                MediFind Connect
              </span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed max-w-md">
              The collaborative intelligence network for medicine access—linking
              patients, community pharmacies, and regional supply intelligence.
            </p>
          </div>

          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Network
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/medicines" className="hover:text-teal-400 transition-colors">
                  Medicine Directory
                </Link>
              </li>
              <li>
                <Link href="/pharmacies" className="hover:text-teal-400 transition-colors">
                  Partner Pharmacies
                </Link>
              </li>
              <li>
                <Link href="/collaboration" className="hover:text-teal-400 transition-colors">
                  Inter-Pharmacy Transfers
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Operations & Radar
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/pharmacy/dashboard" className="hover:text-teal-400 transition-colors">
                  Pharmacy Dashboard
                </Link>
              </li>
              <li>
                <Link href="/intelligence/shortage-radar" className="hover:text-teal-400 transition-colors">
                  Shortage Radar
                </Link>
              </li>
              <li>
                <Link href="/intelligence/smart-restock" className="hover:text-teal-400 transition-colors">
                  Smart Restock
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>MediFind Connect — Frontend Foundation (Phase 2)</span>
          <span>Architecture: Next.js App Router + TypeScript + Tailwind CSS</span>
        </div>
      </PageContainer>
    </footer>
  );
}
