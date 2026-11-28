"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Lock, ShieldAlert } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { usePharmacyAuth } from "@/context/PharmacyAuthContext";
import { isAuthorizedAdminSession } from "@/lib/adminVerificationUtils";

export function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const { session } = usePharmacyAuth();

  if (!session) {
    return (
      <PageContainer size="md" className="py-14 sm:py-20">
        <Card elevated className="border-slate-200">
          <CardContent className="p-8 sm:p-10 flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-teal-400 flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
            <Badge variant="warning">Administrator Authentication Required</Badge>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Admin Verification Portal Restricted
            </h1>
            <p className="text-sm text-slate-600 max-w-md leading-relaxed">
              Sign in with an authorized administrator account to review
              pharmacy registrations and drug licence records.
            </p>
            <Link
              href="/pharmacy/login"
              className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors shadow-xs"
            >
              <span>Go to Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  if (!isAuthorizedAdminSession(session)) {
    return (
      <PageContainer size="md" className="py-14 sm:py-20">
        <Card elevated className="border-rose-200 bg-rose-50/30">
          <CardContent className="p-8 sm:p-10 flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <Badge variant="error">403 Forbidden</Badge>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Administrator Access Required
            </h1>
            <p className="text-sm text-slate-600 max-w-md leading-relaxed">
              This dashboard is restricted to network administrators. Pharmacy
              owner accounts, standard users, and preview sessions cannot view
              or approve pharmacy licence submissions.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Return Home
            </Link>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return <>{children}</>;
}
