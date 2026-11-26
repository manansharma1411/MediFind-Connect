import React, { Suspense } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { LoadingSkeleton } from "@/components/ui/States";
import { MedicineDetailsClient } from "@/features/medicine-finder/MedicineDetailsClient";

export default function MedicineDetailsPage() {
  return (
    <Suspense
      fallback={
        <PageContainer className="py-10 space-y-6">
          <LoadingSkeleton rows={5} />
        </PageContainer>
      }
    >
      <MedicineDetailsClient />
    </Suspense>
  );
}
