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

export default function AdminPharmaciesPage() {
  return (
    <SuperAdminLayout>
      <PageHeader
        breadcrumbs={[
          { label: "Super Admin", href: "/admin" },
          { label: "Pharmacies" },
        ]}
        title="Platform Pharmacy Management"
        description="View, suspend, or audit all registered pharmacies across MediFind Connect."
        badge={<Badge variant="info">Awaiting Backend API</Badge>}
      />

      <DemoNoticeBanner
        title="Admin Pharmacy Directory API Pending"
        description="Endpoint GET /api/v1/admin/pharmacies is awaiting Person B implementation. Use Pharmacy Verification for pending review workflows once backend endpoints are live."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registered Pharmacies</CardTitle>
          <CardDescription>
            Platform-wide pharmacy accounts and operational status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No live pharmacy directory data available"
            description="Platform-wide pharmacy management records will load once Person B implements the admin pharmacy management APIs."
          />
        </CardContent>
      </Card>
    </SuperAdminLayout>
  );
}
