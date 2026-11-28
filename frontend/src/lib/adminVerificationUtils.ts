import type { PharmacySession } from "../types/pharmacy.ts";
import type {
  AdminPharmacyVerificationRecord,
  AdminVerificationHistoryEntry,
  AdminVerificationStatus,
} from "../types/adminVerification.ts";

export interface BackendAdminHistoryEvent {
  id: string | number;
  previousStatus?: string | null;
  newStatus?: string | null;
  action?: string | null;
  adminUserId?: string | null;
  reviewedBy?: string | null;
  reason?: string | null;
  createdAt?: string | null;
  reviewedAt?: string | null;
}

export interface BackendAdminPharmacyRecord {
  id: string;
  ownerUserId?: string | null;
  name?: string | null;
  ownerName?: string | null;
  phone?: string | null;
  contactPhone?: string | null;
  email?: string | null;
  contactEmail?: string | null;
  licenseNumber?: string | null;
  isLicensedVerified?: boolean;
  verificationStatus?: string | null;
  rejectionReason?: string | null;
  licenseReviewNotes?: string | null;
  location?: {
    address?: string | null;
    area?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
  } | null;
  registeredAddress?: string | null;
  area?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  createdAt?: string | null;
  registeredAt?: string | null;
  isActive?: boolean;
  tier?: string | null;
  history?: BackendAdminHistoryEvent[] | null;
}

export function normalizeVerificationStatus(
  value: string | null | undefined
): AdminVerificationStatus {
  switch (String(value ?? "").toUpperCase()) {
    case "VERIFIED":
      return "VERIFIED";
    case "REJECTED":
      return "REJECTED";
    case "SUSPENDED":
      return "SUSPENDED";
    case "PENDING":
    default:
      return "PENDING";
  }
}

export function mapAdminVerificationHistoryEntry(
  ev: BackendAdminHistoryEvent
): AdminVerificationHistoryEntry {
  return {
    id: String(ev.id),
    previousStatus: ev.previousStatus
      ? normalizeVerificationStatus(ev.previousStatus)
      : null,
    newStatus: normalizeVerificationStatus(ev.newStatus),
    reason: ev.reason ?? null,
    reviewedBy: ev.adminUserId ?? ev.reviewedBy ?? null,
    reviewedAt: ev.createdAt ?? ev.reviewedAt ?? "",
  };
}

export function mapAdminPharmacyRecord(
  raw: BackendAdminPharmacyRecord,
  historyRaw?: BackendAdminHistoryEvent[] | null
): AdminPharmacyVerificationRecord {
  const historyList = Array.isArray(historyRaw)
    ? historyRaw
    : Array.isArray(raw.history)
    ? raw.history
    : [];

  return {
    id: String(raw.id),
    name: raw.name ?? "Unnamed Pharmacy",
    ownerName: raw.ownerName ?? null,
    contactPhone: raw.phone ?? raw.contactPhone ?? "",
    contactEmail: raw.email ?? raw.contactEmail ?? null,
    area: raw.location?.area ?? raw.area ?? "",
    city: raw.location?.city ?? raw.city ?? "",
    state: raw.location?.state ?? raw.state ?? "",
    pincode: raw.location?.pincode ?? raw.pincode ?? "",
    registeredAddress:
      raw.location?.address ?? raw.registeredAddress ?? "Address unavailable",
    licenseNumber: raw.licenseNumber ?? null,
    licenseReviewNotes: raw.rejectionReason ?? raw.licenseReviewNotes ?? null,
    registeredAt: raw.createdAt ?? raw.registeredAt ?? "",
    verificationStatus: normalizeVerificationStatus(raw.verificationStatus),
    isActive: typeof raw.isActive === "boolean" ? raw.isActive : undefined,
    tier: raw.tier ?? undefined,
    history: historyList.map(mapAdminVerificationHistoryEntry),
  };
}

export function getAdminDataStatusBadge(params: {
  isLoading: boolean;
  error: string | null;
  source: "live" | "unavailable";
  itemCount: number;
}): {
  label: "Loading" | "API Unavailable" | "No Records" | "Live Data";
  variant: "info" | "error" | "neutral" | "success";
} {
  if (params.isLoading) {
    return { label: "Loading", variant: "info" };
  }
  if (params.error || params.source === "unavailable") {
    return { label: "API Unavailable", variant: "error" };
  }
  if (params.itemCount === 0) {
    return { label: "No Records", variant: "neutral" };
  }
  return { label: "Live Data", variant: "success" };
}

export function getAuthorizedAdminEmail(): string {
  return (
    process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim().toLowerCase() ||
    "admin676@gmail.com"
  );
}

export function isAuthorizedAdminEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  return normalized === getAuthorizedAdminEmail();
}

export function isAuthorizedAdminSession(
  session: PharmacySession | null
): boolean {
  if (!session) return false;
  if (session.isPreviewSession) return false;
  if (!session.accessToken?.trim()) return false;
  return session.role === "network_admin";
}

export function validateRejectionReason(reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed.length < 5) {
    return "A rejection reason of at least 5 characters is required.";
  }
  if (trimmed.length > 500) {
    return "Rejection reason must be 500 characters or fewer.";
  }
  return null;
}

export function getVerificationStatusMeta(status: AdminVerificationStatus): {
  label: string;
  variant: "warning" | "success" | "error" | "neutral";
} {
  switch (status) {
    case "VERIFIED":
      return { label: "Verified", variant: "success" };
    case "REJECTED":
      return { label: "Rejected", variant: "error" };
    case "SUSPENDED":
      return { label: "Suspended", variant: "neutral" };
    case "PENDING":
    default:
      return { label: "Pending Review", variant: "warning" };
  }
}

export function filterVerificationRecords(
  records: AdminPharmacyVerificationRecord[],
  params: { query?: string; status?: AdminVerificationStatus | "ALL" }
): AdminPharmacyVerificationRecord[] {
  const q = (params.query ?? "").trim().toLowerCase();
  const status = params.status ?? "ALL";

  return records.filter((item) => {
    if (status !== "ALL" && item.verificationStatus !== status) {
      return false;
    }
    if (!q) return true;
    const haystack = [
      item.name,
      item.city,
      item.area,
      item.ownerName ?? "",
      item.contactEmail ?? "",
      item.contactPhone,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function paginateVerificationRecords<T>(
  items: T[],
  page: number,
  pageSize: number
): { pageItems: T[]; totalPages: number; currentPage: number } {
  const safeSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(items.length / safeSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * safeSize;
  return {
    pageItems: items.slice(start, start + safeSize),
    totalPages,
    currentPage,
  };
}
