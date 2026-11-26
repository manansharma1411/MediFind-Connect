"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Lock, Mail, Pill, ShieldCheck } from "lucide-react";
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
import { DemoNoticeBanner } from "@/components/shared/DemoNoticeBanner";

export default function PharmacyLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <PageContainer size="md" className="py-10 sm:py-16 space-y-6">
      <DemoNoticeBanner
        title="Authentication Pending Backend"
        description="This is the UI shell for pharmacy staff login. Real Supabase JWT authentication will be wired once Person B's auth endpoints are ready."
      />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
        <div className="md:col-span-5 bg-slate-900 text-white rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="w-11 h-11 rounded-xl bg-teal-500 text-slate-950 flex items-center justify-center">
              <Pill className="w-6 h-6 rotate-45" />
            </div>
            <Badge variant="brand" className="bg-slate-800 text-teal-300 border-slate-700">
              Partner Portal
            </Badge>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Pharmacy Operations Access
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Sign in to manage store stock levels, monitor low-stock alerts,
              and coordinate inter-pharmacy medicine transfers.
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
              Enter your registered pharmacy credentials.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <form
              onSubmit={(e) => e.preventDefault()}
              className="space-y-4"
            >
              <Input
                label="Work Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pharmacist@store.example.com"
                leftIcon={<Mail className="w-4 h-4" />}
                autoComplete="email"
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                leftIcon={<Lock className="w-4 h-4" />}
                autoComplete="current-password"
              />

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="inline-flex items-center gap-2 text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-teal-600"
                  />
                  <span>Keep session active</span>
                </label>
                <span className="text-slate-400">
                  Password reset via backend
                </span>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled
                title="Authentication backend not yet connected"
              >
                Sign In (Pending Backend Auth)
              </Button>
            </form>
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
