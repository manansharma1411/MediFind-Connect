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

export default function AdminMedicinesPage() {
  return (
    <SuperAdminLayout>
      <PageHeader
        breadcrumbs={[
          { label: "Super Admin", href: "/admin" },
          { label: "Medicines" },
        ]}
        title="Master Medicine Catalog"
        description="Curate canonical medicine records, generic mappings, and brand aliases across the platform."
        badge={<Badge variant="info">Awaiting Backend API</Badge>}
      />

      <DemoNoticeBanner
        title="Admin Medicine Catalog API Pending"
        description="Administrative catalog endpoints (GET/POST/PATCH /api/v1/admin/medicines) are awaiting Person B implementation."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Canonical Medicine Registry</CardTitle>
          <CardDescription>
            Standardized medicine definitions used across patient discovery and pharmacy stock
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No admin catalog records loaded"
            description="Catalog administration tools will activate once Person B implements the admin medicine endpoints."
          />
        </CardContent>
      </Card>
    </SuperAdminLayout>
  );
}
