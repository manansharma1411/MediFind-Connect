import { z } from 'zod';

export const pendingPharmaciesQuerySchema = z.object({
  status: z.enum(['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED']).default('PENDING'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const adminPharmaciesListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  search: z.string().trim().max(120).optional(),
  status: z.enum(['ALL', 'PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED']).default('ALL'),
  isActive: z.enum(['all', 'true', 'false']).default('all'),
  sortBy: z.enum(['createdAt', 'name', 'verificationStatus']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const updatePharmacyOperationalStatusSchema = z.object({
  action: z.enum(['SUSPEND', 'REACTIVATE']),
  reason: z.string().trim().min(5, 'A reason of at least 5 characters is required.').max(500),
});

export const adminPharmacyIdParamSchema = z.object({
  id: z.string().uuid('Pharmacy ID must be a valid UUID'),
});

export const verifyPharmacyBodySchema = z
  .object({
    action: z.enum(['APPROVE', 'REJECT']),
    reason: z.string().trim().max(500).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.action === 'REJECT' && (!val.reason || val.reason.trim().length < 5)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A rejection reason of at least 5 characters is required.',
        path: ['reason'],
      });
    }
  });
