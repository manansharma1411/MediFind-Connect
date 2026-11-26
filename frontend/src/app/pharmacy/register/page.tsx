"use client";

import React from "react";
import Link from "next/link";
import { Building2, FileCheck2, MapPin, Phone } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DemoNoticeBanner } from "@/components/shared/DemoNoticeBanner";

export default function PharmacyRegisterPage() {
  return (
    <PageContainer size="md" className="py-8 sm:py-12 space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Pharmacy Registration" },
        ]}
        title="Partner Pharmacy Onboarding"
        description="Register your community pharmacy to publish real-time stock availability and join the inter-pharmacy transfer network."
        badge={<Badge variant="neutral">UI Shell</Badge>}
      />

      <DemoNoticeBanner
        title="Onboarding Preview"
        description="Form fields below reflect the planned KYC and store onboarding schema. Submission is disabled until Person B's registration endpoint is connected."
      />

      <Card elevated>
        <CardHeader>
          <CardTitle>Store & Licensing Details</CardTitle>
          <CardDescription>
            Accurate licensing and address details ensure patient trust and
            correct map routing.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Pharmacy Legal / Store Name"
                placeholder="e.g. CarePlus Community Pharmacy"
                leftIcon={<Building2 className="w-4 h-4" />}
              />
              <Input
                label="Drug License Number"
                placeholder="e.g. MP-BPL-20B-XXXXX"
                leftIcon={<FileCheck2 className="w-4 h-4" />}
              />
              <Input
                label="Contact Phone"
                type="tel"
                placeholder="+91 755 XXX XXXX"
                leftIcon={<Phone className="w-4 h-4" />}
              />
              <Select
                label="Operating Schedule"
                options={[
                  { value: "standard", label: "Standard (08:00 AM – 10:00 PM)" },
                  { value: "extended", label: "Extended (07:00 AM – 11:30 PM)" },
                  { value: "24x7", label: "Open 24 Hours (24x7)" },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Street Address"
                placeholder="Plot / Shop number, Road, Landmark"
                leftIcon={<MapPin className="w-4 h-4" />}
              />
              <Input
                label="Area / Locality"
                placeholder="e.g. MP Nagar Zone-I, Bhopal"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <Input
                label="Manager Email"
                type="email"
                placeholder="manager@pharmacy.example.com"
              />
              <Input
                label="Create Password"
                type="password"
                placeholder="Minimum 8 characters"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <Link
                href="/pharmacy/login"
                className="text-sm font-semibold text-slate-600 hover:text-slate-900 px-3 py-2"
              >
                Already registered? Sign in
              </Link>
              <Button type="submit" disabled>
                Submit Application (Pending Backend)
              </Button>
            </div>
          </form>
        </CardContent>

        <CardFooter className="text-xs text-slate-500">
          <span>
            Verification requires valid retail pharmacy license review before
            live listing.
          </span>
        </CardFooter>
      </Card>
    </PageContainer>
  );
}
