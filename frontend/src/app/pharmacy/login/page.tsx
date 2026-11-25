import React from "react";
import { PlaceholderScreen } from "@/components/shared/PlaceholderScreen";

export default function PharmacyLoginPage() {
  return (
    <PlaceholderScreen
      domain="Pharmacy"
      title="Pharmacy Portal Login"
      route="/pharmacy/login"
      description="Authenticated access point for registered pharmacy owners, managers, and dispensing staff."
      plannedFeatures={[
        "Role-based pharmacy staff authentication",
        "Session management integrated with Person B's auth API",
        "Quick navigation to Operations Dashboard & Inventory",
        "Password recovery & multi-store switching",
      ]}
    />
  );
}
