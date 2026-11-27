import React, { Suspense } from "react";
import { PharmacyPortalLayout } from "@/components/layout/PharmacyPortalLayout";
import { LoadingSkeleton } from "@/components/ui/States";
import { TransferDetailsClient } from "@/components/collaboration/TransferDetailsClient";

export default function TransferDetailsPage() {
  return (
    <PharmacyPortalLayout>
      <Suspense fallback={<LoadingSkeleton rows={5} />}>
        <TransferDetailsClient />
      </Suspense>
    </PharmacyPortalLayout>
  );
}
