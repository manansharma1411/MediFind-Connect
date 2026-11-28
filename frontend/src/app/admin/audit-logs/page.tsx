"use client";

import React from "react";
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
import { EmptyState } from "@/components/ui/States";
import { DemoNoticeBanner } from "@/components/shared/DemoNoticeBanner";

export default function AdminAuditLogsPage() {
  return (
    <SuperAdminLayout>
      <PageHeader
        breadcrumbs={[
          { label: "Super Admin", href: "/admin" },
          { label: "Audit Logs" },
        ]}
        title="Admin Activity & Audit Logs"
        description="Immutable audit trail of pharmacy verification decisions, account suspensions, and catalog changes."
        badge={<Badge variant="info">Awaiting Backend API</Badge>}
      />

      <DemoNoticeBanner
        title="Admin Audit Log API Pending"
        description="Endpoint GET /api/v1/admin/audit-logs is awaiting Person B implementation."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Governance Audit History</CardTitle>
          <CardDescription>
            Actor, action type, target entity, reason, and UTC timestamp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No audit log entries available"
            description="Audit events will appear automatically once Person B implements the admin audit-log endpoint."
          />
        </CardContent>
      </Card>
    </SuperAdminLayout>
  );
}
