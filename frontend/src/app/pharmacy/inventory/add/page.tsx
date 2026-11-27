"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Search } from "lucide-react";
import { PharmacyPortalLayout } from "@/components/layout/PharmacyPortalLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { SearchInput } from "@/components/ui/SearchInput";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Toast } from "@/components/ui/Toast";
import { usePharmacyAuth } from "@/context/PharmacyAuthContext";
import { searchMedicines } from "@/services/medicineService";
import { patchPharmacyInventory } from "@/services/pharmacyService";
import {
  validateAddMedicineForm,
  type AddMedicineFormErrors,
} from "@/lib/pharmacyUtils";
import type { Medicine } from "@/types/medicine";
import type { ApiError } from "@/types/api";
import { cn } from "@/lib/cn";

export default function AddMedicinePage() {
  const { session, logout } = usePharmacyAuth();

  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogResults, setCatalogResults] = useState<Medicine[]>([]);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(
    null
  );

  const [batchNumber, setBatchNumber] = useState("");
  const [quantity, setQuantity] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [reorderThreshold, setReorderThreshold] = useState("5");

  const [errors, setErrors] = useState<AddMedicineFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    variant: "success" | "warning";
    title: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await searchMedicines(
          { q: catalogQuery, page: 1, limit: 6 },
          controller.signal
        );
        if (!controller.signal.aborted) {
          setCatalogResults(res.items);
        }
      } catch {
        // Ignore cancelled catalog lookups
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [catalogQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !session) return;

    setFeedback(null);
    const nextErrors = validateAddMedicineForm({
      medicineId: selectedMedicine?.id ?? "",
      batchNumber,
      quantity,
      sellingPrice,
      expiryDate,
      reorderThreshold,
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const res = await patchPharmacyInventory(session, {
        medicineId: selectedMedicine!.id,
        deltaQuantity: Number(quantity),
        reason: "INITIAL_STOCK",
        batchNumber: batchNumber.trim() || undefined,
        expiryDate,
        sellingPrice: Number(sellingPrice),
        reorderThreshold: Number(reorderThreshold),
        notes: "Initial stock addition via Pharmacy Portal",
      });
      setFeedback({
        variant: "success",
        title: "Medicine Added to Inventory",
        message:
          res.message ||
          `${selectedMedicine!.name} added successfully.${
            res.auditLogId ? ` Audit ID: ${res.auditLogId}` : ""
          }`,
      });
      setQuantity("");
      setBatchNumber("");
      setSellingPrice("");
      setExpiryDate("");
    } catch (err) {
      const apiErr = err as Partial<ApiError>;
      if (apiErr.status === 401) {
        logout();
        return;
      }
      setFeedback({
        variant: "warning",
        title: "Unable to Save Inventory Item",
        message:
          apiErr.message || "An error occurred while adding the medicine.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PharmacyPortalLayout>
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Pharmacy Portal", href: "/pharmacy/dashboard" },
          { label: "Inventory", href: "/pharmacy/inventory" },
          { label: "Add Medicine" },
        ]}
        title="Add Medicine to Inventory"
        description="Select a verified medicine from the master catalogue and record batch, pricing, and threshold details."
        actions={
          <Link
            href="/pharmacy/inventory"
            className="text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            ← Back to Inventory
          </Link>
        }
      />

      {feedback && (
        <Toast
          variant={feedback.variant}
          title={feedback.title}
          description={feedback.message}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Step 1: Search Existing Catalogue */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="text-base">
              1. Select from Master Catalogue
            </CardTitle>
            <CardDescription>
              Search existing medicines to avoid duplicate drug records.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <SearchInput
              value={catalogQuery}
              onChange={(e) => setCatalogQuery(e.target.value)}
              onClear={() => setCatalogQuery("")}
              placeholder="Search generic or brand name..."
              aria-label="Search master medicine catalogue"
            />

            {errors.medicineId && (
              <p className="text-xs font-medium text-rose-600" role="alert">
                {errors.medicineId}
              </p>
            )}

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {catalogResults.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  No catalogue medicines match &ldquo;{catalogQuery}&rdquo;.
                </p>
              ) : (
                catalogResults.map((med) => {
                  const isSelected = selectedMedicine?.id === med.id;
                  return (
                    <button
                      key={med.id}
                      type="button"
                      onClick={() => {
                        setSelectedMedicine(med);
                        setErrors((prev) => ({
                          ...prev,
                          medicineId: undefined,
                        }));
                      }}
                      className={cn(
                        "w-full text-left p-3 rounded-xl border text-xs transition-colors cursor-pointer flex items-start justify-between gap-2",
                        isSelected
                          ? "bg-teal-50 border-teal-400 text-teal-950"
                          : "bg-white border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <div>
                        <p className="font-bold text-slate-900">
                          {med.primaryBrand ?? med.name}
                        </p>
                        <p className="text-slate-500 mt-0.5">
                          {med.genericName} • {med.strength} • {med.form}
                        </p>
                      </div>
                      {isSelected ? (
                        <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                      ) : (
                        <Search className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Batch, Quantity, Price & Threshold */}
        <Card className="lg:col-span-7">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">
                2. Stock & Pricing Details
              </CardTitle>
              {selectedMedicine && (
                <Badge variant="brand">
                  Selected: {selectedMedicine.primaryBrand ?? selectedMedicine.name}
                </Badge>
              )}
            </div>
            <CardDescription>
              All fields are validated before submitting to inventory.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Batch Identifier (Optional)"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="e.g. DL-2026-A1"
                />
                <Input
                  label="Expiry Date"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  error={errors.expiryDate}
                />
                <Input
                  label="Initial Quantity (Units / Strips)"
                  type="number"
                  min={1}
                  step={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  error={errors.quantity}
                  placeholder="e.g. 25"
                />
                <Input
                  label="Selling Price (₹)"
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  error={errors.sellingPrice}
                  placeholder="e.g. 29.00"
                />
                <Input
                  label="Minimum Stock Threshold"
                  type="number"
                  min={0}
                  step={1}
                  value={reorderThreshold}
                  onChange={(e) => setReorderThreshold(e.target.value)}
                  error={errors.reorderThreshold}
                  helperText="Triggers Low Stock alert at or below this count."
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <Button type="submit" isLoading={isSubmitting}>
                  Add to Store Inventory
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PharmacyPortalLayout>
  );
}
