"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Building2,
  Eye,
  EyeOff,
  FileCheck2,
  Lock,
  Mail,
  MapPin,
  Navigation,
  Phone,
  UserCheck,
} from "lucide-react";
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
import { usePharmacyAuth } from "@/context/PharmacyAuthContext";
import {
  registerPharmacy,
  type RegisterPharmacyResponse,
} from "@/services/pharmacyService";
import {
  getPasswordStrength,
  mapApiDetailsToRegistrationErrors,
  validatePharmacyRegistrationForm,
  type PharmacyRegistrationFormErrors,
} from "@/lib/pharmacyRegistrationUtils";
import type { ApiError } from "@/types/api";

export default function PharmacyRegisterPage() {
  const { session } = usePharmacyAuth();
  const hasLiveAuthToken = Boolean(
    session && !session.isPreviewSession && session.accessToken
  );

  const [form, setForm] = useState({
    ownerName: "",
    name: "",
    licenseNumber: "",
    phone: "",
    schedule: "standard",
    tier: "standard" as "standard" | "hub" | "hospital_attached",
    address: "",
    area: "",
    city: "Bhopal",
    state: "Madhya Pradesh",
    pincode: "",
    lat: "",
    lng: "",
    email: session?.email ?? "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errors, setErrors] = useState<PharmacyRegistrationFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [registrationResult, setRegistrationResult] =
    useState<RegisterPharmacyResponse | null>(null);
  const [feedback, setFeedback] = useState<{
    variant: "success" | "warning" | "info";
    title: string;
    message: string;
  } | null>(null);

  const handleDetectCoordinates = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setFeedback({
        variant: "warning",
        title: "Geolocation Unavailable",
        message:
          "Your browser does not support geolocation. Enter your store latitude and longitude manually.",
      });
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        }));
        setErrors((prev) => ({ ...prev, lat: undefined, lng: undefined }));
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
        setFeedback({
          variant: "warning",
          title: "Location Permission Denied",
          message:
            "Enter your store latitude and longitude manually so patients can find your pharmacy.",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setFeedback(null);
    const nextErrors = validatePharmacyRegistrationForm(
      {
        ...form,
        is24x7: form.schedule === "24x7",
      },
      { requireAccountCredentials: !hasLiveAuthToken }
    );
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    setRegistrationResult(null);
    try {
      const latTrimmed = form.lat.trim();
      const lngTrimmed = form.lng.trim();

      const res = await registerPharmacy({
        payload: {
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          ...(hasLiveAuthToken ? {} : { password: form.password }),
          licenseNumber: form.licenseNumber.trim(),
          is24x7: form.schedule === "24x7",
          tier: form.tier,
          address: form.address.trim(),
          area: form.area.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          pincode: form.pincode.trim(),
          ...(latTrimmed !== "" ? { lat: Number(latTrimmed) } : {}),
          ...(lngTrimmed !== "" ? { lng: Number(lngTrimmed) } : {}),
        },
        existingAccessToken: hasLiveAuthToken ? session?.accessToken : undefined,
      });

      setForm((prev) => ({ ...prev, password: "", confirmPassword: "" }));
      setRegistrationResult(res);
      setFeedback({
        variant: "success",
        title: `Registration Submitted — ${res.status}`,
        message: `${res.name} (ID: ${res.pharmacyId}) in ${res.area}, ${res.city} (${res.pincode}) has been submitted with status ${res.status}. Drug license verification is pending review. Sign in via Partner Login to access your portal.`,
      });
    } catch (err) {
      const apiErr = err as Partial<ApiError>;
      const mapped = mapApiDetailsToRegistrationErrors(apiErr);
      if (Object.keys(mapped).length > 0) {
        setErrors((prev) => ({ ...prev, ...mapped }));
      }

      const msgLower = (apiErr.message ?? "").toLowerCase();
      let title = "Registration Failed";
      if (apiErr.status === 409 || apiErr.code === "CONFLICT") {
        if (msgLower.includes("email")) {
          title = "Email Already Registered";
          setErrors((prev) => ({
            ...prev,
            email: apiErr.message || "This email is already registered.",
          }));
        } else if (msgLower.includes("license")) {
          title = "Drug License Already Registered";
          setErrors((prev) => ({
            ...prev,
            licenseNumber:
              apiErr.message || "This license number is already registered.",
          }));
        } else {
          title = "Duplicate Pharmacy Registration";
        }
      } else if (apiErr.status === 400 || apiErr.code === "VALIDATION_ERROR") {
        title = "Validation Error";
      } else if (apiErr.status === 429) {
        title = "Too Many Registration Attempts";
      }

      setFeedback({
        variant: "warning",
        title,
        message: apiErr.message || "Unable to submit pharmacy registration.",
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
        description="Submit your licensed pharmacy details via POST /api/v1/pharmacies/register to create your partner account."
      />

      {hasLiveAuthToken && (
        <Toast
          variant="info"
          title="Authenticated Account Detected"
          description={`Signed in as ${session?.email}. Complete your pharmacy details below to finish onboarding.`}
        />
      )}

      {feedback && (
        <Toast
          variant={feedback.variant}
          title={feedback.title}
          description={feedback.message}
        />
      )}

      {registrationResult && (
        <Card className="border-teal-200 bg-teal-50/50">
          <CardHeader>
            <CardTitle>
              Application Status: {registrationResult.status}
            </CardTitle>
            <CardDescription>
              Your pharmacy profile has been created and is awaiting drug
              license verification. Registration does not mark your store as
              verified automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-700 space-y-1">
            <p>
              <strong>Pharmacy:</strong> {registrationResult.name}
            </p>
            <p>
              <strong>Pharmacy ID:</strong> {registrationResult.pharmacyId}
            </p>
            <p>
              <strong>Location:</strong> {registrationResult.area},{" "}
              {registrationResult.city} — {registrationResult.pincode}
            </p>
            <p>
              <strong>Verification Status:</strong>{" "}
              {registrationResult.status} (
              {registrationResult.isLicensedVerified
                ? "Verified"
                : "Pending License Review"}
              )
            </p>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-3">
            <Link href="/pharmacy/login">
              <Button type="button">Sign In to Partner Portal</Button>
            </Link>
          </CardFooter>
        </Card>
      )}

      <Card elevated>
        <CardHeader>
          <CardTitle>Store & Licensing Details</CardTitle>
          <CardDescription>
            Newly registered pharmacies start with a{" "}
            <strong>PENDING</strong> verification status until drug license
            review is completed.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
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
                placeholder="e.g. MP-BPL-20B-10294"
                leftIcon={<FileCheck2 className="w-4 h-4" />}
              />
              <Input
                label="Contact Phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                error={errors.phone}
                placeholder="+91 755 255 4321"
                leftIcon={<Phone className="w-4 h-4" />}
              />
              <Select
                label="Pharmacy Tier"
                value={form.tier}
                onChange={(e) =>
                  setForm({
                    ...form,
                    tier: e.target.value as
                      | "standard"
                      | "hub"
                      | "hospital_attached",
                  })
                }
                options={[
                  { value: "standard", label: "Standard Retail Pharmacy" },
                  { value: "hub", label: "Hub / Distribution Pharmacy" },
                  { value: "hospital_attached", label: "Hospital-Attached" },
                ]}
              />
              <Select
                label="Operating Schedule"
                value={form.schedule}
                onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                options={[
                  { value: "standard", label: "Standard Operating Hours" },
                  { value: "24x7", label: "Open 24 Hours (24x7)" },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
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
                error={errors.city}
              />
              <Input
                label="State"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                error={errors.state}
              />
              <Input
                label="PIN Code"
                value={form.pincode}
                onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                error={errors.pincode}
                placeholder="e.g. 462011"
              />
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-800">
                  Store Coordinates
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  leftIcon={<Navigation className="w-3.5 h-3.5" />}
                  isLoading={isLocating}
                  onClick={handleDetectCoordinates}
                >
                  Use Current Coordinates
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Latitude"
                  type="number"
                  step="any"
                  value={form.lat}
                  onChange={(e) => setForm({ ...form, lat: e.target.value })}
                  error={errors.lat}
                  placeholder="e.g. 23.2323"
                />
                <Input
                  label="Longitude"
                  type="number"
                  step="any"
                  value={form.lng}
                  onChange={(e) => setForm({ ...form, lng: e.target.value })}
                  error={errors.lng}
                  placeholder="e.g. 77.4332"
                />
              </div>
            </div>

            {!hasLiveAuthToken && (
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Create Your Pharmacy Account
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    These credentials will be used to sign in to the Pharmacy
                    Partner Portal.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Owner / Authorized Person Name"
                    value={form.ownerName}
                    onChange={(e) =>
                      setForm({ ...form, ownerName: e.target.value })
                    }
                    error={errors.ownerName}
                    placeholder="e.g. Dr. Rajesh Sharma"
                    leftIcon={<UserCheck className="w-4 h-4" />}
                    autoComplete="name"
                  />
                  <Input
                    label="Email Address"
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    error={errors.email}
                    placeholder="manager@pharmacy.example.com"
                    leftIcon={<Mail className="w-4 h-4" />}
                    autoComplete="email"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="register-password"
                      className="block text-sm font-semibold text-slate-700"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <Lock className="w-4 h-4" />
                      </span>
                      <input
                        id="register-password"
                        type={showPassword ? "text" : "password"}
                        value={form.password}
                        onChange={(e) =>
                          setForm({ ...form, password: e.target.value })
                        }
                        placeholder="Minimum 8 characters"
                        autoComplete="new-password"
                        className="w-full h-11 rounded-xl border border-slate-300 bg-white pl-10 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {form.password.length > 0 && (
                      <p className="text-xs text-slate-500">
                        Strength:{" "}
                        <span className="font-semibold text-slate-700">
                          {getPasswordStrength(form.password).label}
                        </span>
                      </p>
                    )}
                    {errors.password && (
                      <p className="text-xs font-medium text-rose-600">
                        {errors.password}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="register-confirm-password"
                      className="block text-sm font-semibold text-slate-700"
                    >
                      Confirm Password
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <Lock className="w-4 h-4" />
                      </span>
                      <input
                        id="register-confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={form.confirmPassword}
                        onChange={(e) =>
                          setForm({ ...form, confirmPassword: e.target.value })
                        }
                        placeholder="Re-enter password"
                        autoComplete="new-password"
                        className="w-full h-11 rounded-xl border border-slate-300 bg-white pl-10 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        aria-label={
                          showConfirmPassword
                            ? "Hide confirm password"
                            : "Show confirm password"
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-xs font-medium text-rose-600">
                        {errors.confirmPassword}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

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
