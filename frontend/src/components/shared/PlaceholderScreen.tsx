import React from "react";
import Link from "next/link";
import { ArrowLeft, Construction } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export interface PlaceholderScreenProps {
  domain: "Patient" | "Pharmacy" | "Collaboration" | "Intelligence";
  title: string;
  route: string;
  description: string;
  plannedFeatures: string[];
  phaseLabel?: string;
}

export function PlaceholderScreen({
  domain,
  title,
  route,
  description,
  plannedFeatures,
  phaseLabel = "Phase 2 Routing Shell",
}: PlaceholderScreenProps) {
  return (
    <PageContainer className="py-10 sm:py-14 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-teal-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Overview</span>
        </Link>
        <Badge variant="brand" dot>
          {domain} Domain
        </Badge>
      </div>

      <Card elevated className="overflow-hidden">
        <CardHeader className="border-b border-slate-100 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="warning">{phaseLabel}</Badge>
                <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  {route}
                </span>
              </div>
              <CardTitle className="text-2xl sm:text-3xl pt-1">
                {title}
              </CardTitle>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center shrink-0">
              <Construction className="w-6 h-6" />
            </div>
          </div>
          <CardDescription className="text-base pt-1">
            {description}
          </CardDescription>
        </CardHeader>

        <CardContent className="py-6 space-y-5">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Planned Capabilities (Unimplemented in Phase 2)
            </h4>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {plannedFeatures.map((feature) => (
                <li
                  key={feature}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-sm text-slate-700 flex items-start gap-2.5"
                >
                  <span
                    aria-hidden="true"
                    className="w-2 h-2 rounded-full bg-teal-500 mt-1.5 shrink-0"
                  />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200/80 text-xs text-sky-900 leading-relaxed">
            <strong>Foundation Status:</strong> This route is a verified
            navigation shell. Feature logic and backend API integrations will be
            implemented in upcoming phases once Person B publishes the API
            contracts.
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
