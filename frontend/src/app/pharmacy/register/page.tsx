"use client";

import React, { useState } from "react";
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
import { Toast } from "@/components/ui/Toast";
import { registerPharmacy } from "@/services/pharmacyService";
import type { ApiError } from "@/types/api";

export default function PharmacyRegisterPage() {
  const [form, setForm] = useState({
    name: "",
    licenseNumber: "",
    phone: "",
    schedule: "standard",
    address: "",
    area: "",
    city: "Bhopal",
    state: "Madhya Pradesh",
    pincode: "",
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    variant: "success" | "warning";
    title: string;
    message: string;
  } | null>(null);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "Pharmacy name is required.";
    if (!form.licenseNumber.trim())
      next.licenseNumber = "Drug license number is required.";
    if (!form.phone.trim()) next.phone = "Contact phone is required.";
    if (!form.address.trim()) next.address = "Street address is required.";
    if (!form.area.trim()) next.area = "Area / locality is required.";
    if (!/^\d{6}$/.test(form.pincode.trim()))
      next.pincode = "Enter a valid 6-digit PIN code.";
    if (!form.email.trim()) next.email = "Manager email is required.";
    if (form.password.length < 8)
      next.password = "Password must be at least 8 characters.";
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const res = await registerPharmacy({
        name: form.name.trim(),
        licenseNumber: form.licenseNumber.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        password: form.password,
        address: form.address.trim(),
        area: form.area.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        is24x7: form.schedule === "24x7",
      });
      setFeedback({
        variant: "success",
        title: "Registration Submitted",
        message: `Store ID ${res.pharmacyId} created with status: ${res.status}.`,
      });
    } catch (err) {
      const apiErr = err as Partial<ApiError>;
      setFeedback({
        variant: "warning",
        title: "Registration Unavailable",
        message:
          apiErr.status === 404 || apiErr.status === 501 || apiErr.code === "NETWORK_ERROR"
            ? "Endpoint POST /api/v1/pharmacies/register is awaiting Person B implementation."
            : apiErr.message || "Unable to submit pharmacy registration.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageContainer size="md" className="py-8 sm:py-12 space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Pharmacy Registration" },
        ]}
        title="Partner Pharmacy Onboarding"
        description="Register your community pharmacy to publish verified stock availability and manage inventory."
      />

      {feedback && (
        <Toast
          variant={feedback.variant}
          title={feedback.title}
          description={feedback.message}
        />
      )}

      <Card elevated>
        <CardHeader>
          <CardTitle>Store & Licensing Details</CardTitle>
          <CardDescription>
            Accurate licensing and address details ensure patient trust and
            correct map routing.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Pharmacy Legal / Store Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                error={errors.name}
                placeholder="e.g. CarePlus Community Pharmacy"
                leftIcon={<Building2 className="w-4 h-4" />}
              />
              <Input
                label="Drug License Number"
                value={form.licenseNumber}
                onChange={(e) =>
                  setForm({ ...form, licenseNumber: e.target.value })
                }
                error={errors.licenseNumber}
                placeholder="e.g. MP-BPL-20B-XXXXX"
                leftIcon={<FileCheck2 className="w-4 h-4" />}
              />
              <Input
                label="Contact Phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                error={errors.phone}
                placeholder="+91 755 XXX XXXX"
                leftIcon={<Phone className="w-4 h-4" />}
              />
              <Select
                label="Operating Schedule"
                value={form.schedule}
                onChange={(e) => setForm({ ...form, schedule: e.target.value })}
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
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                error={errors.address}
                placeholder="Plot / Shop number, Road"
                leftIcon={<MapPin className="w-4 h-4" />}
              />
              <Input
                label="Area / Locality"
                value={form.area}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
                error={errors.area}
                placeholder="e.g. MP Nagar Zone-I"
              />
              <Input
                label="City"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
              <Input
                label="PIN Code"
                value={form.pincode}
                onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                error={errors.pincode}
                placeholder="e.g. 462011"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <Input
                label="Manager Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                error={errors.email}
                placeholder="manager@pharmacy.example.com"
              />
              <Input
                label="Create Password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                error={errors.password}
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
              <Button type="submit" isLoading={isSubmitting}>
                Submit Registration
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
