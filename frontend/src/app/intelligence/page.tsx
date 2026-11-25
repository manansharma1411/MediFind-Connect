import React from "react";
import { PlaceholderScreen } from "@/components/shared/PlaceholderScreen";

export default function IntelligencePage() {
  return (
    <PlaceholderScreen
      domain="Intelligence"
      title="Network Intelligence Overview"
      route="/intelligence"
      description="Unified analytics workspace aggregating regional medicine demand signals, stock velocity, and supply-demand matching."
      plannedFeatures={[
        "Regional search demand spike visualization",
        "Supply-demand auto-matching recommendations",
        "Direct navigation to Shortage Radar & Smart Restock",
        "Historical fulfillment rate & stockout KPIs",
      ]}
    />
  );
}
