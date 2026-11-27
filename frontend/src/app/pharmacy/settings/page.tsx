"use client";

import React from "react";
import { PharmacyPortalLayout } from "@/components/layout/PharmacyPortalLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { BackendHealthBadge } from "@/components/shared/BackendHealthBadge";
import { usePharmacyAuth } from "@/context/PharmacyAuthContext";

export default function PharmacySettingsPage() {
  const { session, logout } = usePharmacyAuth();

  return (
    <PharmacyPortalLayout>
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Pharmacy Portal", href: "/pharmacy/dashboard" },
          { label: "Settings" },
        ]}
        title="Portal Settings"
        description="Session security, API connectivity status, and portal preferences."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Session</CardTitle>
            <CardDescription>
              Current authenticated pharmacy staff context
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Staff Name</span>
              <strong className="text-slate-900">{session?.displayName}</strong>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Email</span>
              <strong className="text-slate-900">{session?.email}</strong>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Role</span>
              <Badge variant="brand">{session?.role}</Badge>
            </div>
            <div className="pt-2">
              <Button variant="outline" size="sm" onClick={logout}>
                Sign Out of Portal
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Backend Connectivity</CardTitle>
            <CardDescription>
              Live status of Person B&apos;s Express API
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">API Health Probe</span>
              <BackendHealthBadge />
            </div>
            <p className="text-slate-500 leading-relaxed">
              Configured via <code className="font-mono">NEXT_PUBLIC_API_BASE_URL</code>.
              Protected mutations require a valid Supabase Auth Bearer JWT.
            </p>
          </CardContent>
        </Card>
      </div>
    </PharmacyPortalLayout>
  );
}
