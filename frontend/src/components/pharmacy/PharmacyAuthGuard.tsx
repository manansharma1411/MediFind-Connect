"use client";

import React from "react";
import Link from "next/link";
import { Lock, ArrowRight, Eye } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { usePharmacyAuth } from "@/context/PharmacyAuthContext";
import { LoadingSkeleton } from "@/components/ui/States";

export function PharmacyAuthGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, isHydrated, enterPreviewSession } = usePharmacyAuth();

  if (!isHydrated) {
    return (
      <PageContainer size="md" className="py-14 sm:py-20">
        <LoadingSkeleton rows={4} />
      </PageContainer>
    );
  }

  if (!session) {
    return (
      <PageContainer size="md" className="py-14 sm:py-20">
        <Card elevated className="border-slate-200">
          <CardContent className="p-8 sm:p-10 flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-teal-400 flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>

            <Badge variant="warning">Authorization Required</Badge>

            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Pharmacy Portal Access Restricted
            </h1>

            <p className="text-sm text-slate-600 max-w-md leading-relaxed">
              Pharmacy inventory, stock adjustments, alerts, and license details
              are restricted to authenticated pharmacy staff. Please sign in to
              continue.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                href="/pharmacy/login"
                className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors shadow-xs"
              >
                <span>Go to Partner Login</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Button
                variant="outline"
                size="md"
                leftIcon={<Eye className="w-4 h-4" />}
                onClick={enterPreviewSession}
              >
                Inspect UI Preview Mode
              </Button>
            </div>

            <p className="text-[11px] text-slate-400 max-w-sm pt-2">
              UI Preview Mode uses isolated read-only sample data while backend
              authentication endpoints are being finalized.
            </p>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return <>{children}</>;
}
