import { z } from 'zod';

export const SEARCH_OUTCOMES = [
  'MATCH_FOUND',
  'NO_MATCH',
  'NO_ELIGIBLE_NEARBY_STOCK',
  'PARTIAL_AVAILABILITY',
] as const;

export const SEARCH_SOURCES = [
  'MEDICINE_SEARCH',
  'AVAILABILITY_CHECK',
  'PRICE_COMPARISON',
] as const;

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

export const indianPincodeSchema = z
  .string()
  .trim()
  .regex(/^[1-9][0-9]{5}$/, 'PIN code must be a valid 6-digit Indian postal code');

export const demandSignalRecordSchema = z
  .object({
    medicineId: z.string().uuid().nullable(),
    searchOutcome: z.enum(SEARCH_OUTCOMES),
    searchSource: z.enum(SEARCH_SOURCES).default('MEDICINE_SEARCH'),
    area: z.string().trim().min(2).max(120).optional(),
    city: z.string().trim().min(2).max(100).optional(),
    pincode: indianPincodeSchema.optional(),
  })
  .strict()
  .refine(
    (val) => !(val.searchOutcome !== 'NO_MATCH' && val.medicineId === null),
    {
      message: 'Canonical medicineId is required when searchOutcome is not NO_MATCH.',
      path: ['medicineId'],
    }
  );

function validateDateRange(
  data: { fromDate?: string; toDate?: string },
  ctx: z.RefinementCtx
) {
  if (data.fromDate && data.toDate) {
    if (data.fromDate > data.toDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'fromDate must be less than or equal to toDate.',
        path: ['fromDate'],
      });
      return;
    }
    const startMs = Date.parse(`${data.fromDate}T00:00:00Z`);
    const endMs = Date.parse(`${data.toDate}T00:00:00Z`);
    const diffDays = Math.round((endMs - startMs) / 86400000);
    if (diffDays > 90) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Date range cannot exceed 90 days.',
        path: ['toDate'],
      });
    }
  }
}

const baseWindowSchema = z.object({
  fromDate: dateStringSchema.optional(),
  toDate: dateStringSchema.optional(),
  granularity: z.enum(['day', 'week']).default('day'),
});

export const demandOverviewQuerySchema = baseWindowSchema
  .extend({
    area: z.string().trim().min(2).max(120).optional(),
  })
  .superRefine(validateDateRange);

export const demandTrendsQuerySchema = baseWindowSchema
  .extend({
    medicineId: z.string().uuid().optional(),
    area: z.string().trim().min(2).max(120).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .superRefine(validateDateRange);

export const demandAreasQuerySchema = z
  .object({
    medicineId: z.string().uuid().optional(),
    fromDate: dateStringSchema.optional(),
    toDate: dateStringSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .superRefine(validateDateRange);

export const demandUnmetQuerySchema = z
  .object({
    area: z.string().trim().min(2).max(120).optional(),
    fromDate: dateStringSchema.optional(),
    toDate: dateStringSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .superRefine(validateDateRange);

export const medicineInsightParamSchema = z.object({
  medicineId: z.string().uuid('medicineId must be a valid UUID'),
});

export const medicineInsightQuerySchema = baseWindowSchema
  .extend({
    area: z.string().trim().min(2).max(120).optional(),
  })
  .superRefine(validateDateRange);

export const pharmacyDemandQuerySchema = baseWindowSchema
  .extend({
    medicineId: z.string().uuid().optional(),
  })
  .superRefine(validateDateRange);
