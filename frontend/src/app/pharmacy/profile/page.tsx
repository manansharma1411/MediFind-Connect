"use client";

import React, { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { PharmacyPortalLayout } from "@/components/layout/PharmacyPortalLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Toast } from "@/components/ui/Toast";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/ui/States";
import { DemoNoticeBanner } from "@/components/shared/DemoNoticeBanner";
import { usePharmacyAuth } from "@/context/PharmacyAuthContext";
import {
  getPharmacyProfile,
  updateOperatingHours,
  updatePharmacyProfile,
} from "@/services/pharmacyService";
import type { PharmacyProfileData } from "@/types/pharmacy";
import type { ApiError } from "@/types/api";

export default function PharmacyProfilePage() {
  const { session, logout } = usePharmacyAuth();
  const [profile, setProfile] = useState<PharmacyProfileData | null>(null);
  const [source, setSource] = useState<"live" | "preview" | "unavailable">(
    "unavailable"
  );
  const [notice, setNotice] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{
    variant: "success" | "warning";
    title: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await getPharmacyProfile(session, controller.signal);
        if (controller.signal.aborted) return;
        setProfile(res.data);
        setSource(res.source);
        setNotice(res.notice);
      } catch (err) {
        const apiErr = err as Partial<ApiError>;
        if (apiErr.code === "REQUEST_CANCELLED") return;
        if (apiErr.status === 401) {
          logout();
          return;
        }
        setError(apiErr.message || "Failed to load pharmacy profile.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [session, logout]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !profile || isSaving) return;

    setIsSaving(true);
    setSaveFeedback(null);

    try {
      const updated = await updatePharmacyProfile(session, {
        name: profile.name,
        phone: profile.phone,
        address: profile.address,
        area: profile.area,
        city: profile.city,
        state: profile.state,
        pincode: profile.pincode,
      });
      await updateOperatingHours(session, profile.operatingHours);
      setProfile(updated);
      setIsEditing(false);
      setSaveFeedback({
        variant: "success",
        title: "Profile Updated",
        message: "Pharmacy contact, address, and operating hours saved.",
      });
    } catch (err) {
      const apiErr = err as Partial<ApiError>;
      if (apiErr.status === 401) {
        logout();
        return;
      }
      setSaveFeedback({
        variant: "warning",
        title: "Unable to Save Profile",
        message: apiErr.message || "Failed to update pharmacy profile.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PharmacyPortalLayout>
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Pharmacy Portal", href: "/pharmacy/dashboard" },
          { label: "Pharmacy Profile" },
        ]}
        title="Pharmacy Profile & Licensing"
        description="Manage store contact information, address, operating hours, and inspect verification status."
        actions={
          profile && (
            <Button
              variant={isEditing ? "outline" : "primary"}
              size="sm"
              onClick={() => {
                setIsEditing((prev) => !prev);
                setSaveFeedback(null);
              }}
            >
              {isEditing ? "Cancel Editing" : "Edit Profile"}
            </Button>
          )
        }
      />

      {notice && (
        <DemoNoticeBanner
          title={source === "preview" ? "Preview Mode" : "Backend Dependency"}
          description={notice}
        />
      )}

      {saveFeedback && (
        <Toast
          variant={saveFeedback.variant}
          title={saveFeedback.title}
          description={saveFeedback.message}
        />
      )}

      {isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : error ? (
        <ErrorState title="Unable to load profile" description={error} />
      ) : !profile ? (
        <EmptyState
          title="Pharmacy profile unavailable"
          description="GET /api/v1/pharmacies/:id is awaiting Person B implementation."
        />
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* License & Verification Status (Strictly behind AuthGuard) */}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">
                  Regulatory & Verification Status
                </CardTitle>
                <Badge
                  variant={
                    profile.verificationStatus === "VERIFIED"
                      ? "success"
                      : "warning"
                  }
                  dot
                >
                  {profile.verificationStatus}
                </Badge>
              </div>
              <CardDescription>
                Confidential license metadata is visible only to authenticated
                pharmacy staff.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-teal-600 shrink-0" />
                <div>
                  <span className="text-slate-500 block">
                    Drug License Number
                  </span>
                  <strong className="font-mono text-slate-900 text-sm">
                    {profile.licenseNumber}
                  </strong>
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block">Registered Email</span>
                <strong className="text-slate-900 text-sm">
                  {profile.email ?? "Not set"}
                </strong>
              </div>
            </CardContent>
          </Card>

          {/* Store Contact & Address */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Store Identity & Location
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Pharmacy Name"
                value={profile.name}
                disabled={!isEditing}
                onChange={(e) =>
                  setProfile({ ...profile, name: e.target.value })
                }
              />
              <Input
                label="Contact Phone"
                value={profile.phone}
                disabled={!isEditing}
                onChange={(e) =>
                  setProfile({ ...profile, phone: e.target.value })
                }
              />
              <Input
                label="Address"
                value={profile.address}
                disabled={!isEditing}
                onChange={(e) =>
                  setProfile({ ...profile, address: e.target.value })
                }
              />
              <Input
                label="Area / Locality"
                value={profile.area}
                disabled={!isEditing}
                onChange={(e) =>
                  setProfile({ ...profile, area: e.target.value })
                }
              />
              <Input
                label="City"
                value={profile.city}
                disabled={!isEditing}
                onChange={(e) =>
                  setProfile({ ...profile, city: e.target.value })
                }
              />
              <Input
                label="State"
                value={profile.state}
                disabled={!isEditing}
                onChange={(e) =>
                  setProfile({ ...profile, state: e.target.value })
                }
              />
              <Input
                label="PIN Code"
                value={profile.pincode}
                disabled={!isEditing}
                onChange={(e) =>
                  setProfile({ ...profile, pincode: e.target.value })
                }
              />
            </CardContent>
          </Card>

          {/* Operating Hours */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Operating Hours</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="inline-flex items-center gap-2.5 text-sm font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!isEditing}
                  checked={profile.operatingHours.is24x7}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      operatingHours: {
                        ...profile.operatingHours,
                        is24x7: e.target.checked,
                      },
                    })
                  }
                />
                <span>Open 24 Hours (24x7)</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Monday – Friday"
                  value={profile.operatingHours.weekdays}
                  disabled={!isEditing || profile.operatingHours.is24x7}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      operatingHours: {
                        ...profile.operatingHours,
                        weekdays: e.target.value,
                      },
                    })
                  }
                />
                <Input
                  label="Saturday"
                  value={profile.operatingHours.saturday}
                  disabled={!isEditing || profile.operatingHours.is24x7}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      operatingHours: {
                        ...profile.operatingHours,
                        saturday: e.target.value,
                      },
                    })
                  }
                />
                <Input
                  label="Sunday"
                  value={profile.operatingHours.sunday}
                  disabled={!isEditing || profile.operatingHours.is24x7}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      operatingHours: {
                        ...profile.operatingHours,
                        sunday: e.target.value,
                      },
                    })
                  }
                />
              </div>

              {isEditing && (
                <div className="pt-2 flex justify-end">
                  <Button type="submit" isLoading={isSaving}>
                    Save Changes
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </form>
      )}
    </PharmacyPortalLayout>
  );
}
