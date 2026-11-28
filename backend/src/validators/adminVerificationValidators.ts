import { z } from 'zod';

export const pendingPharmaciesQuerySchema = z.object({
  status: z.enum(['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED']).default('PENDING'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
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
