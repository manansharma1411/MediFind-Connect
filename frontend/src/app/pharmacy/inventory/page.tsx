"use client";

import React, { useMemo, useState } from "react";
import { Edit2, Plus } from "lucide-react";
import { PortalShell } from "@/components/layout/PortalShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { AvailabilityBadge, Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import {
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/States";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { DemoNoticeBanner } from "@/components/shared/DemoNoticeBanner";
import { SAMPLE_INVENTORY_ROWS } from "@/mock-data/inventory";

export default function PharmacyInventoryPage() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SAMPLE_INVENTORY_ROWS.filter((row) => {
      const matchesQuery =
        !q ||
        row.medicineName.toLowerCase().includes(q) ||
        row.brand.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "all" || row.availability === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [query, statusFilter]);

  return (
    <PortalShell>
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Pharmacy Portal", href: "/pharmacy/dashboard" },
          { label: "Inventory" },
        ]}
        title="Inventory Management"
        description="Manage medicine SKUs, unit quantities, pricing, and availability thresholds."
        badge={<Badge variant="neutral">Sample Table</Badge>}
        actions={
          <Button
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsAddModalOpen(true)}
          >
            Add Medicine (Preview)
          </Button>
        }
      />

      <DemoNoticeBanner
        title="Inventory UI Preview"
        description="Rows below use isolated sample data. Stock mutations will persist once Person B's inventory endpoints are connected."
      />

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery("")}
            placeholder="Filter by medicine name or brand..."
            aria-label="Filter inventory"
          />
          <div className="w-full sm:w-52 shrink-0">
            <Select
              aria-label="Filter by stock status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: "all", label: "All Stock States" },
                { value: "in_stock", label: "In Stock" },
                { value: "low_stock", label: "Low Stock" },
                { value: "out_of_stock", label: "Out of Stock" },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {filteredRows.length === 0 ? (
        <EmptyState
          title="No matching inventory items"
          description="Adjust your search term or stock filter."
          actionLabel="Clear Filters"
          onAction={() => {
            setQuery("");
            setStatusFilter("all");
          }}
        />
      ) : (
        <>
          {/* Desktop/Tablet Data Table */}
          <div className="hidden md:block">
            <TableContainer>
              <TableHead>
                <tr>
                  <TableHeaderCell>Medicine Name</TableHeaderCell>
                  <TableHeaderCell>Brand</TableHeaderCell>
                  <TableHeaderCell>Quantity</TableHeaderCell>
                  <TableHeaderCell>Price</TableHeaderCell>
                  <TableHeaderCell>Availability</TableHeaderCell>
                  <TableHeaderCell>Last Updated</TableHeaderCell>
                  <TableHeaderCell className="text-right">
                    Actions
                  </TableHeaderCell>
                </tr>
              </TableHead>
              <tbody>
                {filteredRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-semibold text-slate-900">
                      {row.medicineName}
                    </TableCell>
                    <TableCell>{row.brand}</TableCell>
                    <TableCell className="font-mono text-xs font-semibold">
                      {row.quantity} strips
                    </TableCell>
                    <TableCell className="font-semibold text-slate-900">
                      ₹{row.priceInr.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <AvailabilityBadge status={row.availability} />
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {row.lastUpdated}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                        disabled
                        title="Editing connects in API integration phase"
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </TableContainer>
          </div>

          {/* Mobile Card Layout */}
          <div className="md:hidden space-y-3">
            {filteredRows.map((row) => (
              <Card key={row.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">
                        {row.medicineName}
                      </p>
                      <p className="text-xs text-slate-500">{row.brand}</p>
                    </div>
                    <AvailabilityBadge status={row.availability} />
                  </div>
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                    <span className="text-slate-600">
                      Qty: <strong>{row.quantity}</strong> • Price:{" "}
                      <strong>₹{row.priceInr.toFixed(2)}</strong>
                    </span>
                    <Button size="sm" variant="outline" disabled>
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Add Medicine Preview Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Medicine to Inventory"
        description="Preview layout for adding a new SKU to your store catalog."
        footer={
          <>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button disabled>Save SKU (Pending Backend)</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Medicine / Generic Name" placeholder="e.g. Paracetamol 650 mg" />
          <Input label="Brand Name" placeholder="e.g. Dolo 650" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Quantity" type="number" placeholder="0" />
            <Input label="Retail Price (₹)" type="number" placeholder="0.00" />
          </div>
        </div>
      </Modal>
    </PortalShell>
  );
}
