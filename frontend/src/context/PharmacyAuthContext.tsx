"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import type { PharmacySession } from "@/types/pharmacy";

const STORAGE_KEY = "mf_pharmacy_session_v1";

interface PharmacyAuthContextValue {
  session: PharmacySession | null;
  setSession: (next: PharmacySession | null) => void;
  enterPreviewSession: () => void;
  logout: () => void;
}

const PharmacyAuthContext = createContext<PharmacyAuthContextValue | null>(
  null
);

function readInitialSession(): PharmacySession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PharmacySession;
  } catch {
    return null;
  }
}

export function PharmacyAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSessionState] = useState<PharmacySession | null>(
    readInitialSession
  );

  const setSession = useCallback((next: PharmacySession | null) => {
    setSessionState(next);
    if (typeof window !== "undefined") {
      try {
        if (next) {
          window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } else {
          window.sessionStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        // Ignore storage quota errors
      }
    }
  }, []);

  const enterPreviewSession = useCallback(() => {
    setSession({
      accessToken: "preview-session-no-backend-token",
      userId: "preview-staff-1",
      email: "preview@careplus-pharmacy.example.com",
      displayName: "Preview Pharmacist",
      role: "pharmacy_admin",
      pharmacyId: "demo-pharm-1",
      pharmacyName: "CarePlus Community Pharmacy (Preview)",
      isPreviewSession: true,
    });
  }, [setSession]);

  const logout = useCallback(() => {
    setSession(null);
  }, [setSession]);

  return (
    <PharmacyAuthContext.Provider
      value={{ session, setSession, enterPreviewSession, logout }}
    >
      {children}
    </PharmacyAuthContext.Provider>
  );
}

export function usePharmacyAuth(): PharmacyAuthContextValue {
  const ctx = useContext(PharmacyAuthContext);
  if (!ctx) {
    throw new Error(
      "usePharmacyAuth must be used inside a PharmacyAuthProvider"
    );
  }
  return ctx;
}
