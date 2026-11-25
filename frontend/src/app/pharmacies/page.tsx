import React from "react";
import { PlaceholderScreen } from "@/components/shared/PlaceholderScreen";

export default function PharmaciesPage() {
  return (
    <PlaceholderScreen
      domain="Patient"
      title="Verified Partner Pharmacies"
      route="/pharmacies"
      description="Directory and geographic map view of verified community pharmacies participating in the MediFind Connect network."
      plannedFeatures={[
        "Neighborhood location selector & radius filtering",
        "24x7 and open-now operating status indicators",
        "Interactive Leaflet + OpenStreetMap store pins",
        "Store catalog preview & turn-by-turn directions",
      ]}
    />
  );
}
