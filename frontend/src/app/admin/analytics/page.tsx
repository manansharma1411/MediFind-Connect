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

export default function AdminAnalyticsPage() {
  return (
    <SuperAdminLayout>
      <PageHeader
        breadcrumbs={[
          { label: "Super Admin", href: "/admin" },
          { label: "Platform Analytics" },
        ]}
        title="Platform Analytics"
        description="Network-wide medicine availability coverage, search volume trends, and regional fulfillment health."
        badge={<Badge variant="info">Awaiting Backend API</Badge>}
      />

      <DemoNoticeBanner
        title="Admin Platform Analytics API Pending"
        description="Endpoint GET /api/v1/admin/analytics is awaiting Person B implementation. No fabricated metrics are displayed."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Network Telemetry</CardTitle>
          <CardDescription>
            Aggregated cross-city platform performance indicators
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Platform analytics unavailable"
            description="Network analytics charts will render once Person B implements the admin analytics endpoints."
          />
        </CardContent>
      </Card>
    </SuperAdminLayout>
  );
}
