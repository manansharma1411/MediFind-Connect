"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/ui/States";
import { DemoNoticeBanner } from "@/components/shared/DemoNoticeBanner";
import { usePharmacyAuth } from "@/context/PharmacyAuthContext";
import {
  getPharmacyInventory,
  patchPharmacyInventory,
} from "@/services/pharmacyService";
import { computeStockAdjustmentPreview } from "@/lib/pharmacyUtils";
import type {
  PharmacyInventoryItem,
  StockAdjustmentMode,
  StockAdjustmentReason,
} from "@/types/pharmacy";
import type { ApiError } from "@/types/api";
import { cn } from "@/lib/cn";

const REASON_OPTIONS: Array<{ value: StockAdjustmentReason; label: string }> = [
  { value: "STOCK_AUDIT", label: "Stock Audit / Count Correction" },
  { value: "SALE", label: "Counter Sale" },
  { value: "SALE_RETURN", label: "Customer Return" },
  { value: "INITIAL_STOCK", label: "Restock / New Delivery" },
  { value: "EXPIRY_DISPOSAL", label: "Expired Stock Disposal" },
];

export function StockAdjustClient() {
  const searchParams = useSearchParams();
  const initialItemId = searchParams.get("itemId") ?? "";
  const { session, logout } = usePharmacyAuth();

  const [items, setItems] = useState<PharmacyInventoryItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState(initialItemId);
  const [mode, setMode] = useState<StockAdjustmentMode>("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<StockAdjustmentReason>("STOCK_AUDIT");
  const [notes, setNotes] = useState("");

  const [source, setSource] = useState<"live" | "preview" | "unavailable">(
    "unavailable"
  );
  const [notice, setNotice] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<{
    variant: "success" | "warning";
    title: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await getPharmacyInventory(session, controller.signal);
        if (controller.signal.aborted) return;
        const list = res.data ?? [];
        setItems(list);
        setSource(res.source);
        setNotice(res.notice);
        if (list.length > 0 && !selectedItemId) {
          setSelectedItemId(list[0].id);
        }
      } catch (err) {
        const apiErr = err as Partial<ApiError>;
        if (apiErr.code === "REQUEST_CANCELLED") return;
        if (apiErr.status === 401) {
          logout();
          return;
        }
        setLoadError(apiErr.message || "Failed to load inventory items.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [session, logout, selectedItemId]);

  const activeItem = items.find((i) => i.id === selectedItemId) ?? null;
  const preview = activeItem
    ? computeStockAdjustmentPreview(activeItem.quantityAvailable, mode, amount)
    : null;

  const handleConfirmAdjustment = async () => {
    if (!session || !activeItem || !preview || !preview.isValid || isSubmitting)
      return;

    setIsSubmitting(true);
    setSubmitFeedback(null);

    try {
      const res = await patchPharmacyInventory(session, {
        medicineId: activeItem.medicineId,
        deltaQuantity: preview.deltaQuantity,
        reason,
        notes: notes.trim() || undefined,
      });

      setItems((prev) =>
        prev.map((it) =>
          it.id === activeItem.id
            ? { ...it, quantityAvailable: preview.resultingQuantity }
            : it
        )
      );
      setIsConfirmOpen(false);
      setAmount("");
      setNotes("");
      setSubmitFeedback({
        variant: "success",
        title: "Stock Adjusted",
        message:
          res.message ||
          `Updated ${activeItem.medicineName} to ${preview.resultingQuantity} units.`,
      });
    } catch (err) {
      const apiErr = err as Partial<ApiError>;
      if (apiErr.status === 401) {
        logout();
        return;
      }
      setIsConfirmOpen(false);
      setSubmitFeedback({
        variant: "warning",
        title:
          apiErr.code === "INSUFFICIENT_STOCK"
            ? "Insufficient Stock Conflict"
            : "Adjustment Failed",
        message:
          apiErr.message || "Stock update was rejected by the backend.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Pharmacy Portal", href: "/pharmacy/dashboard" },
          { label: "Inventory", href: "/pharmacy/inventory" },
          { label: "Adjust Stock" },
        ]}
        title="Stock Adjustment"
        description="Add, remove, or correct inventory quantities with an auditable reason and confirmation."
        actions={
          <Link
            href="/pharmacy/inventory"
            className="text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            ← Back to Inventory
          </Link>
        }
      />

      {notice && (
        <DemoNoticeBanner
          title={source === "preview" ? "Preview Mode" : "Backend Dependency"}
          description={notice}
        />
      )}

      {submitFeedback && (
        <Toast
          variant={submitFeedback.variant}
          title={submitFeedback.title}
          description={submitFeedback.message}
        />
      )}

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : loadError ? (
        <ErrorState title="Unable to load inventory" description={loadError} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No inventory items available to adjust"
          description="Add a medicine to your inventory first, or connect the backend inventory endpoint."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle className="text-base">Adjustment Parameters</CardTitle>
              <CardDescription>
                Select the SKU, adjustment type, and reason.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                label="Inventory Item"
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                options={items.map((it) => ({
                  value: it.id,
                  label: `${it.brandName} (${it.medicineName}) — Current: ${it.quantityAvailable}`,
                }))}
              />

              <div className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-800 block">
                  Adjustment Type
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: "add", label: "Add Stock" },
                      { id: "remove", label: "Remove Stock" },
                      { id: "correct", label: "Correct Count" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setMode(opt.id)}
                      className={cn(
                        "h-10 rounded-xl text-xs font-semibold border transition-colors cursor-pointer",
                        mode === opt.id
                          ? "bg-teal-600 text-white border-teal-600"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <Input
                label={
                  mode === "correct"
                    ? "New Exact Quantity"
                    : mode === "add"
                    ? "Quantity to Add"
                    : "Quantity to Remove"
                }
                type="number"
                min={0}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                error={amount !== "" && preview && !preview.isValid ? preview.error : undefined}
                placeholder="Enter whole number"
              />

              <Select
                label="Adjustment Reason"
                value={reason}
                onChange={(e) =>
                  setReason(e.target.value as StockAdjustmentReason)
                }
                options={REASON_OPTIONS}
              />

              <Input
                label="Audit Notes (Optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reference invoice, audit note, or disposal reason..."
              />

              <div className="pt-2 flex justify-end">
                <Button
                  disabled={!preview?.isValid}
                  onClick={() => setIsConfirmOpen(true)}
                >
                  Review & Confirm Adjustment
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Live Calculation Summary */}
          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle className="text-base">
                Expected Quantity Preview
              </CardTitle>
              <CardDescription>
                Verify the resulting stock before committing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {activeItem && preview && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Selected Medicine</span>
                    <strong className="text-slate-900">
                      {activeItem.brandName}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Current Quantity</span>
                    <strong className="font-mono text-slate-900">
                      {activeItem.quantityAvailable}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Proposed Change</span>
                    <strong
                      className={cn(
                        "font-mono",
                        preview.deltaQuantity >= 0
                          ? "text-emerald-700"
                          : "text-rose-700"
                      )}
                    >
                      {preview.deltaQuantity >= 0
                        ? `+${preview.deltaQuantity}`
                        : preview.deltaQuantity}
                    </strong>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between text-sm">
                    <span className="font-semibold text-slate-800">
                      Resulting Quantity
                    </span>
                    <strong className="font-mono text-teal-700">
                      {preview.resultingQuantity}
                    </strong>
                  </div>
                </div>
              )}

              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 flex items-start gap-2 text-xs text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Stock updates are never assumed successful until confirmed by
                  the backend audit response.
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title="Confirm Stock Adjustment"
        description="Please review this inventory mutation before submitting."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              isLoading={isSubmitting}
              onClick={handleConfirmAdjustment}
            >
              Confirm & Submit
            </Button>
          </>
        }
      >
        {activeItem && preview && (
          <div className="space-y-3 text-xs text-slate-700">
            <p>
              Medicine: <strong className="text-slate-900">{activeItem.brandName}</strong> (
              {activeItem.medicineName})
            </p>
            <p>
              Change:{" "}
              <strong className="font-mono">
                {activeItem.quantityAvailable} → {preview.resultingQuantity}
              </strong>{" "}
              ({preview.deltaQuantity >= 0 ? `+${preview.deltaQuantity}` : preview.deltaQuantity})
            </p>
            <p>
              Reason: <strong>{reason.replace(/_/g, " ")}</strong>
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
