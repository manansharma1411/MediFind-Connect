"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Lock, Mail, Pill, ShieldCheck } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Toast } from "@/components/ui/Toast";
import { usePharmacyAuth } from "@/context/PharmacyAuthContext";
import { loginPharmacy } from "@/services/pharmacyService";
import type { ApiError } from "@/types/api";

export default function PharmacyLoginPage() {
  const router = useRouter();
  const { setSession, enterPreviewSession } = usePharmacyAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);
    setApiError(null);

    if (!email.trim() || !password.trim()) {
      setFieldError("Both work email and password are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const session = await loginPharmacy(email.trim(), password);
      setPassword("");
      setSession(session);
      if (!session.pharmacyId) {
        router.push("/pharmacy/register");
      } else {
        router.push("/pharmacy/dashboard");
      }
    } catch (err) {
      const eObj = err as Partial<ApiError>;
      if (eObj.code === "SUPABASE_NOT_CONFIGURED") {
        setApiError(
          "Supabase Auth environment variables are not configured. You can inspect the portal using UI Preview Mode below."
        );
      } else if (eObj.code === "EMAIL_NOT_CONFIRMED") {
        setApiError(
          "Email confirmation is required before signing in. Please verify your email address and try again."
        );
      } else if (eObj.code === "INVALID_CREDENTIALS") {
        setApiError(
          "Invalid email or password. Please check your credentials and try again."
        );
      } else if (eObj.status === 401 || eObj.code === "UNAUTHORIZED") {
        setApiError(
          "Your session is unauthorized or expired. Please sign in again."
        );
      } else if (
        eObj.code === "NETWORK_ERROR" ||
        eObj.code === "API_NOT_CONFIGURED" ||
        eObj.status === 503
      ) {
        setApiError(
          "Unable to reach the MediFind Connect backend right now. Please try again shortly."
        );
      } else {
        setApiError(
          eObj.message || "Authentication failed. Check your credentials."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePreviewLogin = () => {
    enterPreviewSession();
    router.push("/pharmacy/dashboard");
  };

  return (
    <PageContainer size="md" className="py-10 sm:py-16 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
        <div className="md:col-span-5 bg-slate-900 text-white rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="w-11 h-11 rounded-xl bg-teal-500 text-slate-950 flex items-center justify-center">
              <Pill className="w-6 h-6 rotate-45" />
            </div>
            <Badge
              variant="brand"
              className="bg-slate-800 text-teal-300 border-slate-700"
            >
              Partner Portal
            </Badge>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Pharmacy Operations Access
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Sign in to manage store stock levels, monitor low-stock & expiry
              alerts, and coordinate inter-pharmacy medicine transfers.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 flex items-start gap-3 text-xs text-slate-300">
            <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
            <span>
              Protected by role-based server verification (Supabase Auth JWT).
            </span>
          </div>
        </div>

        <Card elevated className="md:col-span-7">
          <CardHeader>
            <CardTitle>Sign In to Pharmacy Portal</CardTitle>
            <CardDescription>
              Enter your registered pharmacy staff credentials.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {(fieldError || apiError) && (
              <Toast
                variant="warning"
                title={fieldError ? "Validation Error" : "Sign-In Notice"}
                description={fieldError ?? apiError ?? undefined}
              />
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Work Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pharmacist@store.example.com"
                leftIcon={<Mail className="w-4 h-4" />}
                autoComplete="email"
                required
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                leftIcon={<Lock className="w-4 h-4" />}
                autoComplete="current-password"
                required
              />

              <Button
                type="submit"
                className="w-full"
                isLoading={isSubmitting}
              >
                Sign In
              </Button>
            </form>

            <div className="pt-3 border-t border-slate-100 space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                leftIcon={<Eye className="w-4 h-4" />}
                onClick={handlePreviewLogin}
              >
                Enter UI Preview Mode (Sample Data)
              </Button>
              <p className="text-[11px] text-slate-500 text-center">
                Preview mode uses isolated read-only sample data for UI
                inspection.
              </p>
            </div>
          </CardContent>

          <CardFooter className="text-xs text-slate-600">
            <span>New partner pharmacy?</span>
            <Link
              href="/pharmacy/register"
              className="font-semibold text-teal-700 hover:text-teal-800"
            >
              Register your store →
            </Link>
          </CardFooter>
        </Card>
      </div>
    </PageContainer>
  );
}
