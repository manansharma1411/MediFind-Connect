import type { PharmacySession } from "../types/pharmacy.ts";
import type {
  AdminPharmacyVerificationRecord,
  AdminVerificationStatus,
} from "../types/adminVerification.ts";

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
