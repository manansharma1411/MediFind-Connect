import React from "react";
import { PlaceholderScreen } from "@/components/shared/PlaceholderScreen";

export default function MedicinesPage() {
  return (
    <PlaceholderScreen
      domain="Patient"
      title="Medicine Search & Directory"
      route="/medicines"
      description="Consumer-facing medication search, generic/brand resolution, and real-time local pharmacy availability comparison."
      plannedFeatures={[
        "Typo-tolerant fuzzy medicine search",
        "Therapeutic category & prescription filters",
        "Real-time In Stock / Low Stock / Out of Stock badges",
        "Cross-pharmacy price comparison & hold requests",
      ]}
    />
  );
}
