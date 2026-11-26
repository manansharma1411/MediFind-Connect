"use client";

import React from "react";
import { MapPin, Navigation, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { DEMO_MANUAL_AREAS } from "@/mock-data/discoveryDemo";
import type { UserLocationState } from "@/types/medicine";

export interface LocationPickerProps {
  location: UserLocationState;
  onChange: (next: UserLocationState) => void;
}

export function LocationPicker({ location, onChange }: LocationPickerProps) {
  const handleRequestGps = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      onChange({
        status: "unavailable",
        coords: null,
        label: "Browser location unavailable",
        source: "none",
        errorMessage:
          "Your browser does not support geolocation. Please select an area manually.",
      });
      return;
    }

    onChange({
      ...location,
      status: "requesting",
      errorMessage: undefined,
    });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          status: "granted",
          coords: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          },
          label: "Current GPS Location",
          source: "gps",
        });
      },
      (err) => {
        const denied = err.code === err.PERMISSION_DENIED;
        onChange({
          status: denied ? "denied" : "unavailable",
          coords: null,
          label: "Location not shared",
          source: "none",
          errorMessage: denied
            ? "Location permission was denied. Select an area manually to calculate distances."
            : "Unable to determine your location. Please select an area manually.",
        });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleManualSelect = (areaId: string) => {
    if (!areaId) {
      onChange({
        status: "idle",
        coords: null,
        label: "No location selected",
        source: "none",
      });
      return;
    }

    const found = DEMO_MANUAL_AREAS.find((a) => a.id === areaId);
    if (!found) return;

    onChange({
      status: "granted",
      coords: { lat: found.lat, lng: found.lng },
      label: found.label,
      source: "manual",
    });
  };

  const selectedAreaId =
    location.source === "manual"
      ? DEMO_MANUAL_AREAS.find((a) => a.label === location.label)?.id ?? ""
      : "";

  return (
    <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-[var(--shadow-card)] space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
            <span className="text-sm font-bold text-slate-900">
              Your Location for Distance
            </span>
            {location.coords ? (
              <Badge variant="brand" dot>
                {location.label}
              </Badge>
            ) : (
              <Badge variant="neutral">Not Set</Badge>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Location is used only to calculate distance to nearby pharmacies and
            is never stored on our servers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Navigation className="w-3.5 h-3.5" />}
            isLoading={location.status === "requesting"}
            onClick={handleRequestGps}
          >
            Use My Location
          </Button>
          {location.coords && (
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<X className="w-3.5 h-3.5" />}
              onClick={() =>
                onChange({
                  status: "idle",
                  coords: null,
                  label: "No location selected",
                  source: "none",
                })
              }
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-slate-100">
        <div className="w-full sm:w-72">
          <Select
            aria-label="Select neighborhood manually"
            value={selectedAreaId}
            onChange={(e) => handleManualSelect(e.target.value)}
            options={[
              { value: "", label: "Or choose an area manually..." },
              ...DEMO_MANUAL_AREAS.map((a) => ({
                value: a.id,
                label: a.label,
              })),
            ]}
          />
        </div>
        {location.errorMessage && (
          <p
            role="alert"
            className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{location.errorMessage}</span>
          </p>
        )}
      </div>
    </div>
  );
}
