import React from "react";
import { PlaceholderScreen } from "@/components/shared/PlaceholderScreen";

export default function PharmacyInventoryPage() {
  return (
    <PlaceholderScreen
      domain="Pharmacy"
      title="Inventory Master Management"
      route="/pharmacy/inventory"
      description="Complete SKU catalog control for community pharmacists, including batch quantities, pricing, and reorder thresholds."
      plannedFeatures={[
        "Searchable & filterable SKU data table",
        "Fast-entry stock addition from verified drug master",
        "Batch expiry tracking & threshold configuration",
        "Chronological stock movement & audit history",
      ]}
    />
  );
}
