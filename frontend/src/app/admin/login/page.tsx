"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
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
import { usePharmacyAuth } from "@/context/PharmacyAuthContext";
import { loginAdmin } from "@/services/adminVerificationService";
import { isAuthorizedAdminEmail } from "@/lib/adminVerificationUtils";
import type { ApiError } from "@/types/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const { setSession } = usePharmacyAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setFieldError(null);
    setApiError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setFieldError("Administrator email and password are required.");
      return;
    }

    if (!isAuthorizedAdminEmail(trimmedEmail)) {
      setFieldError(
        "This email address is not authorized for Super Admin Portal access."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const adminSession = await loginAdmin(trimmedEmail, password);
      setPassword("");
      setSession(adminSession);
      router.push("/admin");
    } catch (err) {
      const eObj = err as Partial<ApiError>;
      if (eObj.status === 403 || eObj.code === "FORBIDDEN") {
        setApiError(
          eObj.message || "Your account does not have administrator permissions."
        );
      } else if (eObj.code === "INVALID_CREDENTIALS") {
        setApiError("Invalid administrator email or password.");
      } else if (eObj.status === 401 || eObj.code === "UNAUTHORIZED") {
        setApiError(
          "Your session is invalid or expired. Please sign in again."
        );
      } else if (eObj.code === "SUPABASE_NOT_CONFIGURED") {
        setApiError(
          "Supabase Auth environment variables are not configured for this environment."
        );
      } else if (
        eObj.code === "NETWORK_ERROR" ||
        eObj.code === "API_NOT_CONFIGURED" ||
        eObj.status === 503
      ) {
        setApiError(
          "Unable to reach the MediFind Connect backend for administrator verification."
        );
      } else {
        setApiError(
          eObj.message || "Administrator authentication failed."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center">
      <PageContainer size="md" className="py-12 max-w-md">
        <Card elevated className="border-slate-200">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-950 text-teal-400 flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="flex justify-center">
              <Badge variant="brand">MediFind Connect · Super Admin</Badge>
            </div>
            <CardTitle className="text-2xl font-extrabold text-slate-900">
              Administrator Login
            </CardTitle>
            <CardDescription>
              Secure access to the MediFind Connect control panel.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {(fieldError || apiError) && (
              <Toast
                variant="warning"
                title={fieldError ? "Validation Notice" : "Authorization Error"}
                description={fieldError ?? apiError ?? undefined}
              />
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <Input
                label="Administrator Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@medifind.example.com"
                leftIcon={<Mail className="w-4 h-4" />}
                autoComplete="email"
                required
              />

              <div className="space-y-1.5">
                <label
                  htmlFor="admin-password"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Password
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter administrator password"
                    autoComplete="current-password"
                    required
                    className="w-full h-11 rounded-xl border border-slate-300 bg-white pl-10 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                isLoading={isSubmitting}
              >
                Sign In
              </Button>
            </form>
          </CardContent>
        </Card>
      </PageContainer>
    </div>
  );
}
