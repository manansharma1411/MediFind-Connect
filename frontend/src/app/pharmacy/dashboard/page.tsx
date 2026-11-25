import React from "react";
import { PlaceholderScreen } from "@/components/shared/PlaceholderScreen";

export default function PharmacyDashboardPage() {
  return (
    <PlaceholderScreen
      domain="Pharmacy"
      title="Pharmacy Operations Dashboard"
      route="/pharmacy/dashboard"
      description="Centralized operational workspace for monitoring store stock health, patient holds, and inter-pharmacy transfer activity."
      plannedFeatures={[
        "KPI summary cards (SKUs, Low Stock, Active Holds)",
        "Urgent low-stock & expiring batch alert feed",
        "Incoming patient hold queue with 1-click actions",
        "Quick shortcuts to Inventory & Collaboration",
      ]}
    />
  );
}
