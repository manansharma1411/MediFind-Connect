import React, { Suspense } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PharmacyAuthProvider } from "@/context/PharmacyAuthContext";

export const metadata: Metadata = {
  title: "MediFind Connect | Collaborative Medicine Access Network",
  description:
    "The collaborative intelligence network for medicine access—linking patients, community pharmacies, and regional supply intelligence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-800">
        <PharmacyAuthProvider>
          <Suspense
            fallback={
              <div className="h-16 w-full bg-white border-b border-slate-200" />
            }
          >
            <Navbar />
          </Suspense>
          <main className="flex-1 flex flex-col">{children}</main>
          <Footer />
        </PharmacyAuthProvider>
      </body>
    </html>
  );
}
