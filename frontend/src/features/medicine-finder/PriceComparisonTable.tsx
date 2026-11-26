import React from "react";
import { Info } from "lucide-react";
import {
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import { AvailabilityBadge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  formatLastUpdated,
  mapStockStatusToBadge,
  sortPriceComparisons,
} from "@/lib/medicineUtils";
import type { MedicineAvailability } from "@/types/medicine";

export function PriceComparisonTable({
  items,
  strength,
  packSize,
}: {
  items: MedicineAvailability[];
  strength: string;
  packSize: string;
}) {
  const sorted = sortPriceComparisons(items);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Price Comparison ({strength} • {packSize})
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <TableContainer>
          <TableHead>
            <tr>
              <TableHeaderCell>Pharmacy</TableHeaderCell>
              <TableHeaderCell>Selling Price</TableHeaderCell>
              <TableHeaderCell>MRP</TableHeaderCell>
              <TableHeaderCell>Availability</TableHeaderCell>
              <TableHeaderCell>Distance</TableHeaderCell>
              <TableHeaderCell>Last Updated</TableHeaderCell>
            </tr>
          </TableHead>
          <tbody>
            {sorted.map((row) => (
              <TableRow key={row.pharmacyId}>
                <TableCell className="font-semibold text-slate-900">
                  <div>{row.pharmacyName}</div>
                  <div className="text-xs font-normal text-slate-500">
                    {row.area}
                  </div>
                </TableCell>
                <TableCell className="font-extrabold text-teal-700">
                  ₹{row.sellingPrice.toFixed(2)}
                </TableCell>
                <TableCell className="text-slate-500 line-through text-xs">
                  ₹{row.mrp.toFixed(2)}
                </TableCell>
                <TableCell>
                  <AvailabilityBadge status={mapStockStatusToBadge(row.status)} />
                </TableCell>
                <TableCell className="text-xs font-semibold text-slate-700">
                  {typeof row.distanceKm === "number"
                    ? `${row.distanceKm} km`
                    : "Location not set"}
                </TableCell>
                <TableCell className="text-xs text-slate-500">
                  {formatLastUpdated(row.lastUpdatedAt)}
                </TableCell>
              </TableRow>
            ))}
          </tbody>
        </TableContainer>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5 text-xs text-slate-600">
          <Info className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Price Comparison Scope:</strong> Prices are compared only
            for equivalent strength ({strength}) and pack size ({packSize}). A
            lower price does not imply clinical interchangeability with another
            medicine or formulation.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
