"use client";

import React, { useState } from "react";
import { AlertCircle, ExternalLink, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

export interface MapMarkerItem {
  id: string;
  name: string;
  area: string;
  address?: string;
  lat: number | null;
  lng: number | null;
  distanceKm?: number | null;
  statusLabel?: string;
}

export function PharmacyMapPanel({
  markers,
  selectedId,
  onSelectMarker,
  title = "Pharmacy Location Map",
}: {
  markers: MapMarkerItem[];
  selectedId?: string | null;
  onSelectMarker?: (id: string) => void;
  title?: string;
}) {
  const [mapLoadError, setMapLoadError] = useState(false);

  const validMarkers = markers.filter(
    (m): m is MapMarkerItem & { lat: number; lng: number } =>
      typeof m.lat === "number" &&
      typeof m.lng === "number" &&
      !Number.isNaN(m.lat) &&
      !Number.isNaN(m.lng)
  );

  const activeMarker =
    validMarkers.find((m) => m.id === selectedId) ?? validMarkers[0] ?? null;

  const buildOsmEmbedUrl = (lat: number, lng: number) => {
    const delta = 0.015;
    const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
      bbox
    )}&layer=mapnik&marker=${lat},${lng}`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant="info">OpenStreetMap</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!activeMarker ? (
          <div className="h-64 rounded-xl bg-slate-50 border border-dashed border-slate-300 flex flex-col items-center justify-center text-center p-6 space-y-2">
            <MapPin className="w-6 h-6 text-slate-400" />
            <p className="text-sm font-semibold text-slate-800">
              Coordinates unavailable
            </p>
            <p className="text-xs text-slate-500 max-w-xs">
              None of the currently listed pharmacies have valid map
              coordinates.
            </p>
          </div>
        ) : mapLoadError ? (
          <div className="h-64 rounded-xl bg-amber-50/50 border border-amber-200 flex flex-col items-center justify-center text-center p-6 space-y-2">
            <AlertCircle className="w-6 h-6 text-amber-600" />
            <p className="text-sm font-semibold text-slate-900">
              Unable to load map tiles
            </p>
            <p className="text-xs text-slate-600 max-w-xs">
              Check your network connection or open the pharmacy coordinates
              directly on OpenStreetMap.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative h-64 sm:h-72 w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
              <iframe
                title={`Map centered on ${activeMarker.name}`}
                src={buildOsmEmbedUrl(activeMarker.lat, activeMarker.lng)}
                className="w-full h-full border-0"
                loading="lazy"
                onError={() => setMapLoadError(true)}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span>
                Showing: <strong className="text-slate-900">{activeMarker.name}</strong>
              </span>
              <a
                href={`https://www.openstreetmap.org/?mlat=${activeMarker.lat}&mlon=${activeMarker.lng}#map=16/${activeMarker.lat}/${activeMarker.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:text-teal-800"
              >
                <span>Open in OpenStreetMap</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}

        {/* Selectable Marker List */}
        {validMarkers.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Select Pharmacy Pin ({validMarkers.length})
            </p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {validMarkers.map((m) => {
                const isSelected = activeMarker?.id === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onSelectMarker?.(m.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-xl border text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer",
                      isSelected
                        ? "bg-teal-50 border-teal-300 text-teal-900"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="font-bold truncate">{m.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {m.area}
                        {m.statusLabel ? ` • ${m.statusLabel}` : ""}
                      </p>
                    </div>
                    {typeof m.distanceKm === "number" && (
                      <span className="font-semibold text-teal-700 shrink-0">
                        {m.distanceKm} km
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
