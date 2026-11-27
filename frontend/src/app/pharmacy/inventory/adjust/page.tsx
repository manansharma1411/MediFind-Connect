import React, { Suspense } from "react";
import { PharmacyPortalLayout } from "@/components/layout/PharmacyPortalLayout";
import { LoadingSkeleton } from "@/components/ui/States";
import { StockAdjustClient } from "@/components/pharmacy/StockAdjustClient";

export default function AdjustStockPage() {
  return (
    <PharmacyPortalLayout>
      <Suspense fallback={<LoadingSkeleton rows={4} />}>
        <StockAdjustClient />
      </Suspense>
    </PharmacyPortalLayout>
  );
}
