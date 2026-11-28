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
import { Toast } from "@/components/ui/Toast";

export default function AdminUsersPage() {
  return (
    <SuperAdminLayout>
      <PageHeader
        breadcrumbs={[
          { label: "Super Admin", href: "/admin" },
          { label: "Users" },
        ]}
        title="User & Role Management"
        description="Manage platform administrators, pharmacy owners, and account access states."
        badge={<Badge variant="error" dot>API Unavailable</Badge>}
      />

      <Toast
        variant="warning"
        title="API Unavailable"
        description="Endpoint GET /api/v1/admin/users is awaiting Person B implementation."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform Accounts</CardTitle>
          <CardDescription>
            Authenticated users and server-verified role assignments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No user records loaded"
            description="User management tables will populate once Person B exposes the authenticated admin user management endpoints."
          />
        </CardContent>
      </Card>
    </SuperAdminLayout>
  );
}
