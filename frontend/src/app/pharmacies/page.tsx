"use client";

import React, { useMemo, useState } from "react";
import { Clock, Map, MapPin, Phone, ShieldCheck } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { DemoNoticeBanner } from "@/components/shared/DemoNoticeBanner";
import { SAMPLE_PHARMACIES } from "@/mock-data/pharmacies";
import { cn } from "@/lib/cn";

export default function PharmaciesPage() {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("all");
  const [openOnly, setOpenOnly] = useState(false);

  const filteredPharmacies = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SAMPLE_PHARMACIES.filter((p) => {
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.area.toLowerCase().includes(q);
      const matchesArea = area === "all" || p.area === area;
      const matchesOpen = !openOnly || p.isOpenNow;
      return matchesQuery && matchesArea && matchesOpen;
    });
  }, [query, area, openOnly]);

  return (
    <PageContainer className="py-8 sm:py-12 space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Pharmacies" }]}
        title="Partner Pharmacies"
        description="Explore verified community pharmacies participating in the MediFind Connect network."
        badge={<Badge variant="neutral">UI Preview</Badge>}
      />

      <DemoNoticeBanner
        title="Sample Directory"
        description="Pharmacy cards below demonstrate the directory layout using isolated sample records. Live geolocation, store hours, and interactive Leaflet map pins will connect in the integration phase."
      />

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-5 flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery("")}
            placeholder="Search pharmacy name or neighborhood..."
            aria-label="Search pharmacies"
          />
          <div className="w-full md:w-56 shrink-0">
            <Select
              aria-label="Filter by area"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              options={[
                { value: "all", label: "All Areas" },
                { value: "MP Nagar Zone-I", label: "MP Nagar Zone-I" },
                { value: "Arera Colony", label: "Arera Colony" },
                { value: "New Market", label: "New Market" },
              ]}
            />
          </div>
          <button
            type="button"
            onClick={() => setOpenOnly((prev) => !prev)}
            className={cn(
              "h-11 px-4 rounded-xl text-sm font-semibold border transition-colors cursor-pointer shrink-0",
              openOnly
                ? "bg-teal-600 text-white border-teal-600"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            )}
          >
            Open Now Only
          </button>
        </CardContent>
      </Card>

      {/* Directory + Map Shell */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-4">
          {filteredPharmacies.length === 0 ? (
            <EmptyState
              title="No matching pharmacies"
              description="Adjust your search query or area filter."
              actionLabel="Show All"
              onAction={() => {
                setQuery("");
                setArea("all");
                setOpenOnly(false);
              }}
            />
          ) : (
            filteredPharmacies.map((pharm) => (
              <Card key={pharm.id} interactive>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={pharm.isOpenNow ? "success" : "neutral"} dot>
                          {pharm.isOpenNow ? "Open Now" : "Closed"}
                        </Badge>
                        {pharm.is24x7 && <Badge variant="brand">24x7</Badge>}
                      </div>
                      <CardTitle>{pharm.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1.5 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span>{pharm.address}</span>
                      </CardDescription>
                    </div>
                    <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-100">
                      {pharm.distanceKm} km
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="pt-0 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {pharm.hours}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {pharm.phone}
                  </span>
                  {pharm.verifiedSample && (
                    <span className="inline-flex items-center gap-1 text-teal-700 font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Sample Verified Partner
                    </span>
                  )}
                </CardContent>

                <CardFooter>
                  <span className="text-xs text-slate-500">
                    Area: {pharm.area}
                  </span>
                  <Button size="sm" variant="outline" disabled>
                    Directions (Pending Map API)
                  </Button>
                </CardFooter>
              </Card>
            ))
          )}
        </div>

        {/* Map Integration Shell */}
        <div className="lg:col-span-5 lg:sticky lg:top-24">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Interactive Map Shell</CardTitle>
                <Badge variant="info">Leaflet Ready</Badge>
              </div>
              <CardDescription>
                OpenStreetMap + Leaflet pharmacy pins will render here when
                geolocation & store coordinate endpoints are connected.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72 rounded-xl bg-slate-100 border border-dashed border-slate-300 flex flex-col items-center justify-center text-center p-6 space-y-2">
                <div className="w-11 h-11 rounded-xl bg-white text-teal-600 border border-slate-200 flex items-center justify-center shadow-xs">
                  <Map className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold text-slate-800">
                  Map Canvas Placeholder
                </p>
                <p className="text-xs text-slate-500 max-w-xs">
                  Color-coded availability markers and turn-by-turn routing
                  preview.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
