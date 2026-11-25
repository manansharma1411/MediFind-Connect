import React from "react";
import { PlaceholderScreen } from "@/components/shared/PlaceholderScreen";

export default function ShortageRadarPage() {
  return (
    <PlaceholderScreen
      domain="Intelligence"
      title="Regional Shortage Radar"
      route="/intelligence/shortage-radar"
      description="Early-warning geographic intelligence identifying emerging neighborhood medicine shortages from unfulfilled search signals."
      plannedFeatures={[
        "Area-level scarcity risk indicators",
        "Critical shortage alerts by therapeutic category",
        "Unfulfilled patient search trend tracking",
        "1-click trigger for collaborative network balancing",
      ]}
    />
  );
}
