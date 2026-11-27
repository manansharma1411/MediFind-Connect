"use client";

import React, { useState } from "react";
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
import { Toast } from "@/components/ui/Toast";
import { usePharmacyAuth } from "@/context/PharmacyAuthContext";
import { createTransferRequest } from "@/services/collaborationService";
import {
  validateCreateTransferForm,
  type CreateTransferFormErrors,
} from "@/lib/collaborationUtils";
import { DEMO_MEDICINES, DEMO_PHARMACIES } from "@/mock-data/discoveryDemo";
import type { ApiError } from "@/types/api";

export function TransferRequestClient() {
  const searchParams = useSearchParams();
  const { session, logout } = usePharmacyAuth();

  const [fulfillingPharmacyId, setFulfillingPharmacyId] = useState(
    searchParams.get("pharmacyId") ?? ""
  );
  const [medicineId, setMedicineId] = useState(
    searchParams.get("medicineId") ?? ""
  );
  const [quantityRequested, setQuantityRequested] = useState("");
  const [notes, setNotes] = useState("");

  const [errors, setErrors] = useState<CreateTransferFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    variant: "success" | "warning";
    title: string;
    message: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || isSubmitting) return;

    setFeedback(null);
    const nextErrors = validateCreateTransferForm(
      { fulfillingPharmacyId, medicineId, quantityRequested, notes },
      session.pharmacyId
    );
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const created = await createTransferRequest(session, {
        fulfillingPharmacyId,
        medicineId,
        quantityRequested: Number(quantityRequested),
        notes: notes.trim(),
      });
      setFeedback({
        variant: "success",
        title: "Transfer Request Created",
        message: `Request ${created.transferCode} submitted in REQUESTED state.`,
      });
      setQuantityRequested("");
      setNotes("");
    } catch (err) {
      const apiErr = err as Partial<ApiError>;
      if (apiErr.status === 401) {
        logout();
        return;
      }
      setFeedback({
        variant: "warning",
        title: "Transfer Request Not Submitted",
        message:
          apiErr.message ||
          "Unable to create transfer request. Verify backend availability.",
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
          { label: "Collaboration", href: "/collaboration" },
          { label: "New Transfer Request" },
        ]}
        title="Create Stock Transfer Request"
        description="Submit a formal requisition to a neighboring partner pharmacy."
        actions={
          <Link
            href="/collaboration/discover"
            className="text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            ← Back to Discovery
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
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle className="text-base">Transfer Requisition</CardTitle>
            <CardDescription>
              All fields are validated before sending to the backend.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Select
                label="Supplying (Destination) Pharmacy"
                value={fulfillingPharmacyId}
                onChange={(e) => setFulfillingPharmacyId(e.target.value)}
                error={errors.fulfillingPharmacyId}
                options={[
                  { value: "", label: "Select a partner pharmacy..." },
                  ...DEMO_PHARMACIES.filter(
                    (p) => p.id !== session?.pharmacyId
                  ).map((p) => ({
                    value: p.id,
                    label: `${p.name} (${p.location.area})`,
                  })),
                ]}
              />

              <Select
                label="Medicine"
                value={medicineId}
                onChange={(e) => setMedicineId(e.target.value)}
                error={errors.medicineId}
                options={[
                  { value: "", label: "Select a medicine..." },
                  ...DEMO_MEDICINES.map((m) => ({
                    value: m.id,
                    label: `${m.primaryBrand ?? m.name} (${m.strength})`,
                  })),
                ]}
              />

              <Input
                label="Requested Quantity (Units / Strips)"
                type="number"
                min={1}
                step={1}
                value={quantityRequested}
                onChange={(e) => setQuantityRequested(e.target.value)}
                error={errors.quantityRequested}
                placeholder="Enter positive integer"
              />

              <Input
                label="Reason / Message"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                error={errors.notes}
                placeholder="e.g. Urgent counter prescription demand"
              />

              <div className="pt-2 flex justify-end">
                <Button type="submit" isLoading={isSubmitting}>
                  Submit Transfer Request
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="text-base">Request Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Requesting Pharmacy</span>
                <strong className="text-slate-900">
                  {session?.pharmacyName}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Requested Quantity</span>
                <strong className="font-mono text-teal-700">
                  {quantityRequested || "—"}
                </strong>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 flex items-start gap-2 text-amber-950">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Stock is only reserved once the supplying pharmacy explicitly
                approves the request on the backend.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
