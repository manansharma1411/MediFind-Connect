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

export default function ShortageRadarPage() {
  return (
    <PharmacyPortalLayout>
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Intelligence", href: "/intelligence" },
          { label: "Shortage Radar" },
        ]}
        title="Regional Shortage Radar"
        description="Structured monitoring of emerging medicine shortages by neighborhood, severity, and verified evidence."
        badge={<Badge variant="info">Awaiting Verified Data</Badge>}
      />

      <EmptyState
        title="Intelligence data will appear when sufficient verified data is available."
        description="No live shortage signals are currently reported. Verified regional shortage events will populate the schema below once backend telemetry is active."
      />

      {/* Schema Structure Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Shortage Signal Schema</CardTitle>
          <CardDescription>
            Fields surfaced for every verified regional shortage alert
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <TableContainer>
            <TableHead>
              <tr>
                <TableHeaderCell>Area / Location</TableHeaderCell>
                <TableHeaderCell>Medicine</TableHeaderCell>
                <TableHeaderCell>Shortage Severity</TableHeaderCell>
                <TableHeaderCell>Evidence Summary</TableHeaderCell>
                <TableHeaderCell>Confidence / Uncertainty</TableHeaderCell>
                <TableHeaderCell>Last Updated</TableHeaderCell>
              </tr>
            </TableHead>
            <tbody>
              <tr>
                <td
                  colSpan={6}
                  className="py-8 px-4 text-center text-xs text-slate-500"
                >
                  Awaiting verified backend shortage signals.
                </td>
              </tr>
            </tbody>
          </TableContainer>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600">
            <strong className="text-slate-800 block mb-1">
              Explanation & Uncertainty Area
            </strong>
            When a shortage signal is active, this panel explains the underlying
            stockout ratio, unfulfilled search evidence, and confidence bounds.
          </div>
        </CardContent>
      </Card>
    </PharmacyPortalLayout>
  );
}
