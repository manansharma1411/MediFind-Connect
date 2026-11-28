import type { PaginationMeta } from "./aiIntelligence.ts";

export type AdminVerificationStatus =
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "SUSPENDED";

export interface AdminVerificationSummary {
  pendingCount: number | null;
  verifiedCount: number | null;
  rejectedCount: number | null;
  totalRegisteredCount: number | null;
}

export interface AdminVerificationHistoryEntry {
  id: string;
  previousStatus: AdminVerificationStatus | null;
  newStatus: AdminVerificationStatus;
  reason: string | null;
  reviewedBy: string | null;
  reviewedAt: string;
}

export interface AdminPharmacyVerificationRecord {
  id: string;
  name: string;
  ownerName: string | null;
  contactPhone: string;
  contactEmail: string | null;
  area: string;
  city: string;
  state: string;
  pincode: string;
  registeredAddress: string;
  licenseNumber: string | null;
  licenseReviewNotes: string | null;
  registeredAt: string;
  verificationStatus: AdminVerificationStatus;
  history: AdminVerificationHistoryEntry[];
}

export interface AdminVerificationListResponse {
  summary: AdminVerificationSummary;
  items: AdminPharmacyVerificationRecord[];
  pagination?: PaginationMeta;
}
