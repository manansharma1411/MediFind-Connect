"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  MapPin,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { PortalShell } from "@/components/layout/PortalShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DemoNoticeBanner } from "@/components/shared/DemoNoticeBanner";
import {
  SAMPLE_TRANSFERS,
  type SampleTransferRequest,
} from "@/mock-data/transfers";
import { cn } from "@/lib/cn";

const STATUS_PROGRESSION = [
  { label: "Requested", desc: "Partner submits stock request" },
  { label: "Approved / Rejected", desc: "Supplying store reviews stock" },
  { label: "Dispatched", desc: "Handed off to runner or courier" },
  { label: "Received", desc: "Verified and added to inventory" },
];

export default function CollaborationPage() {
  const [activeTab, setActiveTab] = useState<"incoming" | "outgoing">(
    "incoming"
  );
  const [selectedTransfer, setSelectedTransfer] =
    useState<SampleTransferRequest | null>(null);

  const incomingCount = SAMPLE_TRANSFERS.filter(
    (t) => t.direction === "incoming"
  ).length;
  const outgoingCount = SAMPLE_TRANSFERS.filter(
    (t) => t.direction === "outgoing"
  ).length;

  const visibleTransfers = useMemo(
    () => SAMPLE_TRANSFERS.filter((t) => t.direction === activeTab),
    [activeTab]
  );

  return (
    <PortalShell>
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Pharmacy Portal", href: "/pharmacy/dashboard" },
          { label: "Collaboration" },
        ]}
        title="Inter-Pharmacy Collaboration"
        description="Coordinate peer-to-peer stock transfers with nearby partner pharmacies to resolve urgent patient stockouts."
        badge={<Badge variant="neutral">Preview Shell</Badge>}
      />

      <DemoNoticeBanner
        title="Collaboration UI Preview"
        description="Transfer records below use isolated sample data. Approve, reject, dispatch, and receive actions are disabled until Person B's transfer workflow endpoints are connected."
      />

      {/* Expected Status Progression */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Transfer Workflow Progression</CardTitle>
          <CardDescription>
            Standard lifecycle for every inter-pharmacy stock requisition
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {STATUS_PROGRESSION.map((step, idx) => (
              <div
                key={step.label}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start justify-between gap-2"
              >
                <div>
                  <span className="font-mono text-[11px] font-bold text-teal-700">
                    STAGE 0{idx + 1}
                  </span>
                  <p className="text-xs font-bold text-slate-900 mt-0.5">
                    {step.label}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {step.desc}
                  </p>
                </div>
                {idx < STATUS_PROGRESSION.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-slate-300 hidden lg:block shrink-0 mt-1" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs: Incoming / Outgoing */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as "incoming" | "outgoing")}
          tabs={[
            { id: "incoming", label: "Incoming Requests", count: incomingCount },
            { id: "outgoing", label: "Outgoing Requests", count: outgoingCount },
          ]}
        />
        <Button size="sm" variant="outline" disabled>
          New Transfer Request (Pending API)
        </Button>
      </div>

      {/* Transfer Request Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleTransfers.map((tr) => (
          <Card key={tr.id} interactive className="flex flex-col justify-between">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-[11px] font-semibold text-slate-400">
                    {tr.id} • {tr.requestedAt}
                  </span>
                  <CardTitle className="mt-1">{tr.brand}</CardTitle>
                  <CardDescription>{tr.medicineName}</CardDescription>
                </div>
                <StatusBadge status={tr.status} />
              </div>
            </CardHeader>

            <CardContent className="pt-0 space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 inline-flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-teal-600" />
                    {tr.direction === "incoming"
                      ? "Requesting Store:"
                      : "Supplying Store:"}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {tr.partnerPharmacy}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    Location:
                  </span>
                  <span className="text-slate-700">
                    {tr.partnerArea} ({tr.distanceKm} km)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 inline-flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-slate-400" />
                    Requested Quantity:
                  </span>
                  <span className="font-bold text-teal-700">
                    {tr.quantity} strips
                  </span>
                </div>
              </div>
            </CardContent>

            <CardFooter>
              <div className="flex items-center gap-2">
                {tr.direction === "incoming" && tr.status === "requested" && (
                  <>
                    <Button size="sm" variant="primary" disabled>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" disabled>
                      Reject
                    </Button>
                  </>
                )}
                {tr.direction === "incoming" && tr.status === "approved" && (
                  <Button size="sm" variant="primary" disabled>
                    Mark Dispatched
                  </Button>
                )}
                {tr.direction === "outgoing" && tr.status === "dispatched" && (
                  <Button size="sm" variant="primary" disabled>
                    Confirm Receipt
                  </Button>
                )}
                {tr.status === "received" && (
                  <span className="text-xs font-semibold text-emerald-700">
                    Completed
                  </span>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedTransfer(tr)}
              >
                Details
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Transfer Details Modal */}
      <Modal
        isOpen={Boolean(selectedTransfer)}
        onClose={() => setSelectedTransfer(null)}
        title={selectedTransfer ? `Transfer ${selectedTransfer.id}` : "Transfer"}
        description={
          selectedTransfer
            ? `${selectedTransfer.brand} — ${selectedTransfer.medicineName}`
            : undefined
        }
        footer={
          <div className="flex flex-wrap items-center justify-between w-full gap-2">
            <span className="text-xs text-slate-500">
              Preview actions are disabled until backend API connects
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                leftIcon={<XCircle className="w-3.5 h-3.5" />}
                disabled
              >
                Reject
              </Button>
              <Button
                size="sm"
                variant="primary"
                leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                disabled
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<Truck className="w-3.5 h-3.5" />}
                disabled
              >
                Dispatch
              </Button>
            </div>
          </div>
        }
      >
        {selectedTransfer && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <StatusBadge status={selectedTransfer.status} />
              <span className="text-xs text-slate-500">
                {selectedTransfer.requestedAt}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Partner Pharmacy</span>
                <span className="font-bold text-slate-900">
                  {selectedTransfer.partnerPharmacy}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Area & Distance</span>
                <span className="text-slate-800">
                  {selectedTransfer.partnerArea} ({selectedTransfer.distanceKm} km)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Quantity</span>
                <span className={cn("font-bold text-teal-700")}>
                  {selectedTransfer.quantity} strips
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-600">
              <strong className="text-slate-800 block mb-1">
                Requisition Notes
              </strong>
              {selectedTransfer.notes}
            </div>
          </div>
        )}
      </Modal>
    </PortalShell>
  );
}
