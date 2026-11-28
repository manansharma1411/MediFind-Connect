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
import { Badge } from "@/components/ui/Badge";
import {
  TableContainer,
  TableHead,
  TableHeaderCell,
} from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/States";

export default function SmartRestockPage() {
  return (
    <PharmacyPortalLayout>
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Intelligence", href: "/intelligence" },
          { label: "Smart Restock" },
        ]}
        title="Smart Restock Planner"
        description="Evidence-based reorder quantity suggestions factoring in current stock, demand trends, and supplier lead times."
        badge={<Badge variant="info">Awaiting Verified Data</Badge>}
      />

      <EmptyState
        title="Intelligence data will appear when sufficient verified data is available."
        description="Restock recommendations require sufficient historical stock movement and demand telemetry from your pharmacy."
      />

      {/* Schema Structure Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Restock Recommendation Schema</CardTitle>
          <CardDescription>
            Structured fields rendered for each verified reorder suggestion
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <TableContainer>
            <TableHead>
              <tr>
                <TableHeaderCell>Medicine</TableHeaderCell>
                <TableHeaderCell>Current Stock</TableHeaderCell>
                <TableHeaderCell>Suggested Reorder Qty</TableHeaderCell>
                <TableHeaderCell>Demand Trend</TableHeaderCell>
                <TableHeaderCell>Lead Time</TableHeaderCell>
                <TableHeaderCell>Explanation</TableHeaderCell>
              </tr>
            </TableHead>
            <tbody>
              <tr>
                <td
                  colSpan={6}
                  className="py-8 px-4 text-center text-xs text-slate-500"
                >
                  Awaiting verified inventory and demand history.
                </td>
              </tr>
            </tbody>
          </TableContainer>
        </CardContent>
      </Card>
    </PharmacyPortalLayout>
  );
}
