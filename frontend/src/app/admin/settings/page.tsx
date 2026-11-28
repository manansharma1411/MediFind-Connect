"use client";

import React from "react";
import { ShieldCheck } from "lucide-react";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Toast } from "@/components/ui/Toast";

export default function AdminSettingsPage() {
  return (
    <SuperAdminLayout>
      <PageHeader
        breadcrumbs={[
          { label: "Super Admin", href: "/admin" },
          { label: "Settings" },
        ]}
        title="Platform Admin Settings"
        description="Security posture, verification policy, and environment configuration status."
        badge={<Badge variant="error" dot>API Unavailable</Badge>}
      />

      <Toast
        variant="warning"
        title="API Unavailable"
        description="Configurable platform settings (GET/PATCH /api/v1/admin/settings) are awaiting Person B implementation."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            Enforced Security Controls
          </CardTitle>
          <CardDescription>
            Platform-level safeguards active in the Super Admin Portal
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <p className="font-semibold text-slate-900">
              Authoritative Backend Authorization
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              All administrative operations require server-verified{" "}
              <code className="font-mono">network_admin</code> credentials and
              never rely on email-pattern checks or client-only role overrides.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <p className="font-semibold text-slate-900">
              Zero Service-Role Key Exposure
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              Supabase service-role credentials remain strictly on the backend
              server and are never bundled into frontend code.
            </p>
          </div>
        </CardContent>
      </Card>
    </SuperAdminLayout>
  );
}
