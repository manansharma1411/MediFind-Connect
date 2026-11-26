import React from "react";
import Link from "next/link";
import { ArrowRight, Pill } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { Medicine } from "@/types/medicine";

export function MedicineResultCard({ medicine }: { medicine: Medicine }) {
  const brandList = medicine.brands.map((b) => b.brandName).join(", ");

  return (
    <Card interactive className="flex flex-col justify-between">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              {medicine.therapeuticClass && (
                <Badge variant="neutral">{medicine.therapeuticClass}</Badge>
              )}
              <Badge variant={medicine.isPrescriptionRequired ? "info" : "brand"}>
                {medicine.isPrescriptionRequired ? "Rx Required" : "OTC"}
              </Badge>
            </div>
            <CardTitle className="pt-1">
              {medicine.primaryBrand ?? medicine.name}
            </CardTitle>
            <CardDescription>
              Generic: <strong className="text-slate-700">{medicine.genericName}</strong>
            </CardDescription>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center shrink-0">
            <Pill className="w-5 h-5" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
          <div>
            <span className="text-slate-500 block">Strength</span>
            <span className="font-semibold text-slate-900">
              {medicine.strength}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Form</span>
            <span className="font-semibold text-slate-900">
              {medicine.form}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Pack Size</span>
            <span className="font-semibold text-slate-900 truncate block">
              {medicine.packSize}
            </span>
          </div>
        </div>

        {brandList && (
          <p className="text-xs text-slate-500 line-clamp-1">
            <strong className="text-slate-700">Brands:</strong> {brandList}
          </p>
        )}
      </CardContent>

      <CardFooter>
        <span className="text-xs text-slate-500">
          Storage: {medicine.storageCondition}
        </span>
        <Link
          href={`/medicines/${encodeURIComponent(medicine.id)}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-800 transition-colors"
        >
          <span>Check Availability</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </CardFooter>
    </Card>
  );
}
