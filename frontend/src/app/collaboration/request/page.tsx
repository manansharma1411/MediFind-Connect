import React, { Suspense } from "react";
import { PharmacyPortalLayout } from "@/components/layout/PharmacyPortalLayout";
import { LoadingSkeleton } from "@/components/ui/States";
import { TransferRequestClient } from "@/components/collaboration/TransferRequestClient";

export default function CreateTransferRequestPage() {
  return (
    <PharmacyPortalLayout>
      <Suspense fallback={<LoadingSkeleton rows={4} />}>
        <TransferRequestClient />
      </Suspense>
    </PharmacyPortalLayout>
  );
}
