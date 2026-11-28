"use client";

import React from "react";
import Link from "next/link";
import { AlertCircle, Home, RefreshCw } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function RouteErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageContainer size="md" className="py-14 sm:py-20">
      <Card elevated className="border-rose-200 bg-white">
        <CardContent className="p-8 sm:p-10 flex flex-col items-center text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Unable to Render This Page
          </h1>
          <p className="text-sm text-slate-600 max-w-md leading-relaxed">
            {error?.message ||
              "An unexpected client error occurred while loading this view. You can retry or return to the homepage."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button
              type="button"
              onClick={() => reset()}
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              Try Again
            </Button>
            <Link
              href="/"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Go Home</span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
