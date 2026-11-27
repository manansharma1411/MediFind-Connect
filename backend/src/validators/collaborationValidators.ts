import { z } from 'zod';

export const transferIdParamSchema = z.object({
  transferId: z.string().uuid('Invalid transferId UUID'),
});

export const collaborationStockQuerySchema = z
  .object({
    medicineId: z.string().uuid('Invalid medicineId UUID').optional(),
    q: z.string().trim().max(150).optional().default(''),
    area: z.string().trim().max(120).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().min(0.5).max(200).default(25),
    onlyAvailable: z.coerce.boolean().optional().default(true),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine((d) => (d.lat === undefined) === (d.lng === undefined), {
    message: 'Both lat and lng must be provided together',
  });

export const createTransferSchema = z.object({
  supplyingPharmacyId: z.string().uuid('Invalid supplyingPharmacyId UUID'),
  medicineId: z.string().uuid('Invalid medicineId UUID'),
  sourceInventoryItemId: z.string().uuid('Invalid sourceInventoryItemId UUID'),
  requestedQuantity: z.number().int().min(1, 'requestedQuantity must be at least 1').max(10000),
  requestReason: z.string().trim().max(500).optional(),
});

export const listTransfersQuerySchema = z.object({
  direction: z.enum(['incoming', 'outgoing', 'all']).optional().default('all'),
  status: z
    .enum(['REQUESTED', 'APPROVED', 'REJECTED', 'DISPATCHED', 'RECEIVED', 'CANCELLED', 'ALL'])
    .optional()
    .default('ALL'),
  medicineId: z.string().uuid('Invalid medicineId UUID').optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const approveTransferSchema = z.object({
  approvedQuantity: z.number().int().min(1).optional(),
});

export const rejectTransferSchema = z.object({
  reason: z.string().trim().min(3, 'Rejection reason is required (min 3 chars)').max(500),
});

export const dispatchTransferSchema = z.object({
  dispatchReference: z.string().trim().max(120).optional(),
});

export const receiveTransferSchema = z.object({
  receivedQuantity: z.number().int().min(0, 'receivedQuantity cannot be negative'),
  discrepancyNotes: z.string().trim().max(500).optional(),
});

export const cancelTransferSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
