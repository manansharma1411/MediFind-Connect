"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Eye, PlusCircle, SlidersHorizontal } from "lucide-react";
import { PharmacyPortalLayout } from "@/components/layout/PharmacyPortalLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import {
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/ui/States";
import { Modal } from "@/components/ui/Modal";
import { DemoNoticeBanner } from "@/components/shared/DemoNoticeBanner";
import { usePharmacyAuth } from "@/context/PharmacyAuthContext";
import { getPharmacyInventory } from "@/services/pharmacyService";
import {
  filterAndSortInventory,
  getEffectiveInventoryStatus,
  type InventoryFilterOptions,
} from "@/lib/pharmacyUtils";
import type {
  EffectiveInventoryStatus,
  PharmacyInventoryItem,
} from "@/types/pharmacy";
import type { ApiError } from "@/types/api";

const PAGE_SIZE = 10;

function renderInventoryBadge(status: EffectiveInventoryStatus) {
  switch (status) {
    case "IN_STOCK":
      return (
        <Badge variant="success" dot>
          In Stock
        </Badge>
      );
    case "LOW_STOCK":
      return (
        <Badge variant="warning" dot>
          Low Stock
        </Badge>
      );
    case "EXPIRED":
      return (
        <Badge variant="error" dot>
          Expired (Not for Sale)
        </Badge>
      );
    case "OUT_OF_STOCK":
    default:
      return (
        <Badge variant="error" dot>
          Out of Stock
        </Badge>
      );
  }
}

export default function PharmacyInventoryPage() {
  const { session, logout } = usePharmacyAuth();
  const [items, setItems] = useState<PharmacyInventoryItem[]>([]);
  const [source, setSource] = useState<"live" | "preview" | "unavailable">(
    "unavailable"
  );
  const [notice, setNotice] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<InventoryFilterOptions>({
    query: "",
    statusFilter: "all",
    expiryFilter: "all",
    sortBy: "name",
  });
  const [page, setPage] = useState(1);
  const [nowMs, setNowMs] = useState<number>(0);
  const [selectedItem, setSelectedItem] =
    useState<PharmacyInventoryItem | null>(null);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await getPharmacyInventory(session, controller.signal);
        if (controller.signal.aborted) return;
        setNowMs(Date.now());
        setItems(res.data ?? []);
        setSource(res.source);
        setNotice(res.notice);
        setError(null);
      } catch (err) {
        const apiErr = err as Partial<ApiError>;
        if (apiErr.code === "REQUEST_CANCELLED") return;
        if (apiErr.status === 401) {
          logout();
          return;
        }
        setError(apiErr.message || "Failed to load pharmacy inventory.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [session, logout]);

  const filteredItems = useMemo(
    () => filterAndSortInventory(items, filters, nowMs),
    [items, filters, nowMs]
  );

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const pagedItems = filteredItems.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  return (
    <PharmacyPortalLayout>
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Pharmacy Portal", href: "/pharmacy/dashboard" },
          { label: "Inventory" },
        ]}
        title="Inventory Management"
        description="Search, filter, inspect batches, and adjust stock quantities. Expired batches are flagged and blocked from active sale."
        actions={
          <Link
            href="/pharmacy/inventory/add"
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Medicine</span>
          </Link>
        }
      />

      {notice && (
        <DemoNoticeBanner
          title={source === "preview" ? "Preview Mode" : "Backend Dependency"}
          description={notice}
        />
      )}

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5">
            <SearchInput
              value={filters.query}
              onChange={(e) => {
                setFilters((f) => ({ ...f, query: e.target.value }));
                setPage(1);
              }}
              onClear={() => {
                setFilters((f) => ({ ...f, query: "" }));
                setPage(1);
              }}
              placeholder="Search medicine name, brand, or batch..."
              aria-label="Search inventory"
            />
          </div>

          <div className="md:col-span-2">
            <Select
              aria-label="Filter by stock status"
              value={filters.statusFilter}
              onChange={(e) => {
                setFilters((f) => ({
                  ...f,
                  statusFilter: e.target.value as InventoryFilterOptions["statusFilter"],
                }));
                setPage(1);
              }}
              options={[
                { value: "all", label: "All Statuses" },
                { value: "IN_STOCK", label: "In Stock" },
                { value: "LOW_STOCK", label: "Low Stock" },
                { value: "OUT_OF_STOCK", label: "Out of Stock" },
                { value: "EXPIRED", label: "Expired" },
              ]}
            />
          </div>

          <div className="md:col-span-3">
            <Select
              aria-label="Filter by expiry"
              value={filters.expiryFilter}
              onChange={(e) => {
                setFilters((f) => ({
                  ...f,
                  expiryFilter: e.target.value as InventoryFilterOptions["expiryFilter"],
                }));
                setPage(1);
              }}
              options={[
                { value: "all", label: "All Expiry Dates" },
                { value: "near_expiry", label: "Expiring within 30 days" },
                { value: "expired", label: "Expired Batches" },
              ]}
            />
          </div>

          <div className="md:col-span-2">
            <Select
              aria-label="Sort inventory"
              value={filters.sortBy}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  sortBy: e.target.value as InventoryFilterOptions["sortBy"],
                }))
              }
              options={[
                { value: "name", label: "Sort: Name" },
                { value: "quantity", label: "Sort: Quantity" },
                { value: "expiry", label: "Sort: Expiry" },
                { value: "price", label: "Sort: Price" },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : error ? (
        <ErrorState title="Unable to load inventory" description={error} />
      ) : source === "unavailable" ? (
        <EmptyState
          title="Inventory endpoint unavailable"
          description="GET /api/v1/pharmacies/:id/inventory is awaiting Person B implementation."
        />
      ) : pagedItems.length === 0 ? (
        <EmptyState
          title="No matching inventory items"
          description="Adjust your search query, status filter, or expiry filter."
          actionLabel="Reset Filters"
          onAction={() => {
            setFilters({
              query: "",
              statusFilter: "all",
              expiryFilter: "all",
              sortBy: "name",
            });
            setPage(1);
          }}
        />
      ) : (
        <div className="space-y-4">
          {/* Desktop Table */}
          <div className="hidden lg:block">
            <TableContainer>
              <TableHead>
                <tr>
                  <TableHeaderCell>Medicine & Brand</TableHeaderCell>
                  <TableHeaderCell>Strength / Form</TableHeaderCell>
                  <TableHeaderCell>Batch</TableHeaderCell>
                  <TableHeaderCell>Qty</TableHeaderCell>
                  <TableHeaderCell>Selling Price</TableHeaderCell>
                  <TableHeaderCell>Expiry</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell className="text-right">
                    Actions
                  </TableHeaderCell>
                </tr>
              </TableHead>
              <tbody>
                {pagedItems.map((item) => {
                  const effectiveStatus = getEffectiveInventoryStatus(item, nowMs);
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-semibold text-slate-900">
                          {item.medicineName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {item.brandName} • {item.packSize}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium text-slate-800">
                          {item.strength}
                        </div>
                        <div className="text-slate-500">{item.form}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-600">
                        {item.batchNumber ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold">
                        {item.quantityAvailable}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900">
                        ₹{item.sellingPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {item.expiryDate}
                      </TableCell>
                      <TableCell>
                        {renderInventoryBadge(effectiveStatus)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            leftIcon={<Eye className="w-3.5 h-3.5" />}
                            onClick={() => setSelectedItem(item)}
                          >
                            View
                          </Button>
                          <Link
                            href={`/pharmacy/inventory/adjust?itemId=${encodeURIComponent(
                              item.id
                            )}`}
                            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <SlidersHorizontal className="w-3 h-3 text-teal-600" />
                            <span>Adjust</span>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </tbody>
            </TableContainer>
          </div>

          {/* Mobile/Tablet Cards */}
          <div className="lg:hidden space-y-3">
            {pagedItems.map((item) => {
              const effectiveStatus = getEffectiveInventoryStatus(item, nowMs);
              return (
                <Card key={item.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-slate-900 text-sm">
                          {item.medicineName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {item.brandName} • {item.strength} • {item.form}
                        </p>
                      </div>
                      {renderInventoryBadge(effectiveStatus)}
                    </div>
                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 text-xs">
                      <div>
                        <span className="text-slate-500 block">Qty</span>
                        <strong>{item.quantityAvailable}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Price</span>
                        <strong>₹{item.sellingPrice.toFixed(2)}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Expiry</span>
                        <strong className="font-mono">{item.expiryDate}</strong>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedItem(item)}
                      >
                        View Details
                      </Button>
                      <Link
                        href={`/pharmacy/inventory/adjust?itemId=${encodeURIComponent(
                          item.id
                        )}`}
                        className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700"
                      >
                        Adjust Stock
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-slate-500">
                Page {page} of {totalPages} ({filteredItems.length} items)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  leftIcon={<ChevronLeft className="w-4 h-4" />}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inventory Item Detail Modal */}
      <Modal
        isOpen={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        title={selectedItem?.medicineName ?? "Inventory Item"}
        description={
          selectedItem
            ? `${selectedItem.brandName} • ${selectedItem.packSize}`
            : undefined
        }
        footer={
          selectedItem && (
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setSelectedItem(null)}>
                Close
              </Button>
              <Link
                href={`/pharmacy/inventory/adjust?itemId=${encodeURIComponent(
                  selectedItem.id
                )}`}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700"
              >
                Adjust Stock
              </Link>
            </div>
          )
        }
      >
        {selectedItem && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-2">
              {renderInventoryBadge(getEffectiveInventoryStatus(selectedItem, nowMs))}
            </div>
            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <span className="text-slate-500 block">Strength & Form</span>
                <strong className="text-slate-900">
                  {selectedItem.strength} • {selectedItem.form}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Batch Number</span>
                <strong className="font-mono text-slate-900">
                  {selectedItem.batchNumber ?? "N/A"}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Available Qty</span>
                <strong className="text-slate-900">
                  {selectedItem.quantityAvailable}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Reserved Qty</span>
                <strong className="text-slate-900">
                  {selectedItem.quantityReserved}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Selling Price / MRP</span>
                <strong className="text-teal-700">
                  ₹{selectedItem.sellingPrice.toFixed(2)} / ₹
                  {selectedItem.mrp.toFixed(2)}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Expiry Date</span>
                <strong className="font-mono text-slate-900">
                  {selectedItem.expiryDate}
                </strong>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </PharmacyPortalLayout>
  );
}
