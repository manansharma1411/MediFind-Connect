import { z } from 'zod';

export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid UUID format'),
});

export const medicineSearchQuerySchema = z.object({
  q: z.string().trim().max(150).optional().default(''),
  form: z
    .enum(['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Inhaler', 'Drops', 'Other'])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const availabilityQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(0.5).max(100).default(15),
}).refine(
  (data) => (data.lat === undefined) === (data.lng === undefined),
  { message: 'Both lat and lng must be provided together' }
);

export const priceComparisonQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(0.5).max(100).default(25),
  sortBy: z.enum(['price_asc', 'distance_asc']).default('price_asc'),
}).refine(
  (data) => (data.lat === undefined) === (data.lng === undefined),
  { message: 'Both lat and lng must be provided together' }
);
