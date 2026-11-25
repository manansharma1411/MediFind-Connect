import React from "react";
import { PlaceholderScreen } from "@/components/shared/PlaceholderScreen";

export default function PharmacyRegisterPage() {
  return (
    <PlaceholderScreen
      domain="Pharmacy"
      title="Pharmacy Network Onboarding"
      route="/pharmacy/register"
      description="Multi-step registration and credential verification workflow for community pharmacies joining MediFind Connect."
      plannedFeatures={[
        "Store profile & operating hours configuration",
        "Drug license & GSTIN verification fields",
        "Exact map coordinate picker for patient routing",
        "Initial staff credential setup",
      ]}
    />
  );
}
