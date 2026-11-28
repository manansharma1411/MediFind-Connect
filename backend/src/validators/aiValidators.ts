import { z } from 'zod';

export const shortageListQuerySchema = z.object({
  medicineId: z.string().uuid().optional(),
  area: z.string().trim().min(2).max(120).optional(),
  riskCategory: z.enum(['LOW', 'MODERATE', 'HIGH', 'INSUFFICIENT_DATA']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const medicineIdParamSchema = z.object({
  medicineId: z.string().uuid('medicineId must be a valid UUID'),
});

export const shortageDetailQuerySchema = z.object({
  area: z.string().trim().min(2).max(120).optional(),
});

export const restockListQuerySchema = z.object({
  onlyActionable: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const forecastQuerySchema = z.object({
  medicineId: z.string().uuid('medicineId must be a valid UUID'),
  area: z.string().trim().min(2).max(120).optional(),
  horizon: z.coerce.number().int().min(1).max(14).default(7),
  granularity: z.enum(['day', 'week']).default('day'),
});

export const matchesQuerySchema = z.object({
  medicineId: z.string().uuid().optional(),
  area: z.string().trim().min(2).max(120).optional(),
  maxDistanceKm: z.coerce.number().positive().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
