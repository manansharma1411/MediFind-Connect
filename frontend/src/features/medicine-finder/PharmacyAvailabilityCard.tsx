import React from "react";
import { Clock, MapPin, AlertTriangle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { AvailabilityBadge, Badge } from "@/components/ui/Badge";
import {
  formatLastUpdated,
  isStaleTimestamp,
  mapStockStatusToBadge,
} from "@/lib/medicineUtils";
import type { MedicineAvailability } from "@/types/medicine";
import { cn } from "@/lib/cn";

export function PharmacyAvailabilityCard({
  item,
  isSelected = false,
  onSelect,
}: {
  item: MedicineAvailability;
  isSelected?: boolean;
  onSelect?: () => void;
}) {
  const stale = isStaleTimestamp(item.lastUpdatedAt, 24);
  const updatedLabel = formatLastUpdated(item.lastUpdatedAt);
  const hasReliableOpenStatus =
    item.is24x7 || typeof item.isOpenNow === "boolean";
  const isOpen = item.is24x7 || item.isOpenNow === true;

  return (
    <Card
      interactive
      onClick={onSelect}
      className={cn(
        onSelect && "cursor-pointer",
        isSelected && "border-teal-500 ring-2 ring-teal-500/20"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <AvailabilityBadge status={mapStockStatusToBadge(item.status)} />
              {item.is24x7 && <Badge variant="brand">24x7</Badge>}
              {hasReliableOpenStatus && !item.is24x7 && (
                <Badge variant={isOpen ? "success" : "neutral"}>
                  {isOpen ? "Open Now" : "Closed"}
                </Badge>
              )}
            </div>
            <CardTitle className="pt-1">{item.pharmacyName}</CardTitle>
            <CardDescription className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>
                {item.address ? `${item.address}, ${item.area}` : item.area}
              </span>
            </CardDescription>
          </div>

          {typeof item.distanceKm === "number" && (
            <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-100 shrink-0">
              {item.distanceKm} km away
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
          <div>
            <span className="text-slate-500 block">Selling Price</span>
            <span className="text-base font-extrabold text-teal-700">
              ₹{item.sellingPrice.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">MRP</span>
            <span className="text-sm font-semibold text-slate-600 line-through">
              ₹{item.mrp.toFixed(2)}
            </span>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <span className="text-slate-500 block">Last Updated</span>
            <span className="font-semibold text-slate-800 inline-flex items-center gap-1 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {updatedLabel}
            </span>
          </div>
        </div>

        {stale && (
          <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>
              Stock update is older than 24 hours ({updatedLabel}). Call pharmacy
              to confirm before visiting.
            </span>
          </div>
        )}

        {item.operatingHoursLabel && (
          <p className="text-xs text-slate-500">
            Hours: <strong className="text-slate-700">{item.operatingHoursLabel}</strong>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
