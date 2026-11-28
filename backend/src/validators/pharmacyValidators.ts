import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const indianPincodeRegex = /^[1-9][0-9]{5}$/;
const licenseRegex = /^[A-Za-z0-9\-\/\s]{4,100}$/;

export const operatingHourEntrySchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    openTime: z.string().regex(timeRegex, 'Use HH:MM or HH:MM:SS format').nullable(),
    closeTime: z.string().regex(timeRegex, 'Use HH:MM or HH:MM:SS format').nullable(),
    isClosed: z.boolean(),
    timezone: z.string().default('Asia/Kolkata'),
  })
  .refine(
    (entry) => entry.isClosed || (entry.openTime !== null && entry.closeTime !== null),
    { message: 'openTime and closeTime are required when isClosed is false' }
  );

export const selfRegisterPharmacySchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    phone: z.string().trim().min(7).max(30),
    email: z.string().trim().email('Enter a valid manager email address').max(150),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128)
      .optional(),
    licenseNumber: z
      .string()
      .trim()
      .regex(licenseRegex, 'Valid drug license number (4-100 alphanumeric characters) is required'),
    is24x7: z.boolean().optional().default(false),
    tier: z.enum(['standard', 'hub', 'hospital_attached']).optional().default('standard'),
    // Flat location fields (used by frontend /pharmacy/register)
    address: z.string().trim().min(5).max(500).optional(),
    area: z.string().trim().min(2).max(120).optional(),
    city: z.string().trim().min(2).max(100).optional(),
    state: z.string().trim().min(2).max(100).optional(),
    pincode: z
      .string()
      .trim()
      .regex(indianPincodeRegex, 'Must be a valid 6-digit Indian PIN code')
      .optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    // Optional nested location (backward-compatible)
    location: z
      .object({
        address: z.string().trim().min(5).max(500),
        area: z.string().trim().min(2).max(120),
        city: z.string().trim().min(2).max(100),
        state: z.string().trim().min(2).max(100),
        pincode: z
          .string()
          .trim()
          .regex(indianPincodeRegex, 'Must be a valid 6-digit Indian PIN code'),
        lat: z.number().min(-90).max(90).optional().default(0),
        lng: z.number().min(-180).max(180).optional().default(0),
      })
      .optional(),
    operatingHours: z.array(operatingHourEntrySchema).min(1).max(7).optional(),
  })
  .superRefine((val, ctx) => {
    const hasFlat =
      Boolean(val.address) &&
      Boolean(val.area) &&
      Boolean(val.city) &&
      Boolean(val.state) &&
      Boolean(val.pincode);
    if (!val.location && !hasFlat) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Complete address, area, city, state, and 6-digit PIN code are required.',
        path: ['address'],
      });
    }
  });

export const registerPharmacySchema = z.object({
  name: z.string().trim().min(2).max(200),
  phone: z.string().trim().min(7).max(30),
  email: z.string().trim().email().max(150).nullable().optional(),
  licenseNumber: z.string().trim().min(3).max(100).nullable().optional(),
  is24x7: z.boolean().optional().default(false),
  tier: z.enum(['standard', 'hub', 'hospital_attached']).optional().default('standard'),
  location: z.object({
    address: z.string().trim().min(5).max(500),
    area: z.string().trim().min(2).max(120),
    city: z.string().trim().min(2).max(100),
    state: z.string().trim().min(2).max(100),
    pincode: z.string().trim().regex(indianPincodeRegex, 'Must be a valid 6-digit Indian PIN code'),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
});

export const updatePharmacyProfileSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  phone: z.string().trim().min(7).max(30).optional(),
  email: z.string().trim().email().max(150).nullable().optional(),
  licenseNumber: z.string().trim().min(3).max(100).nullable().optional(),
  is24x7: z.boolean().optional(),
  location: z
    .object({
      address: z.string().trim().min(5).max(500).optional(),
      area: z.string().trim().min(2).max(120).optional(),
      city: z.string().trim().min(2).max(100).optional(),
      state: z.string().trim().min(2).max(100).optional(),
      pincode: z
        .string()
        .trim()
        .regex(indianPincodeRegex, 'Must be a valid 6-digit Indian PIN code')
        .optional(),
      lat: z.number().min(-90).max(90).optional(),
      lng: z.number().min(-180).max(180).optional(),
    })
    .optional(),
});

export const updateOperatingHoursSchema = z.object({
  hours: z.array(operatingHourEntrySchema).min(1).max(7),
});

export const addInventoryItemSchema = z
  .object({
    medicineId: z.string().uuid('Invalid medicineId UUID'),
    batchNumber: z.string().trim().min(1).max(100),
    expiryDate: z.string().regex(dateRegex, 'Use YYYY-MM-DD date format'),
    quantityAvailable: z.number().int().min(0),
    quantityReserved: z.number().int().min(0).optional().default(0),
    mrp: z.number().min(0),
    sellingPrice: z.number().min(0),
    unitCostPrice: z.number().min(0).nullable().optional(),
    reorderThreshold: z.number().int().min(0).optional().default(10),
  })
  .refine((d) => d.sellingPrice <= d.mrp, {
    message: 'sellingPrice cannot exceed MRP',
    path: ['sellingPrice'],
  });

export const updateInventoryItemSchema = z
  .object({
    expiryDate: z.string().regex(dateRegex, 'Use YYYY-MM-DD date format').optional(),
    mrp: z.number().min(0).optional(),
    sellingPrice: z.number().min(0).optional(),
    unitCostPrice: z.number().min(0).nullable().optional(),
    reorderThreshold: z.number().int().min(0).optional(),
  })
  .refine(
    (d) =>
      d.mrp === undefined || d.sellingPrice === undefined || d.sellingPrice <= d.mrp,
    {
      message: 'sellingPrice cannot exceed MRP',
      path: ['sellingPrice'],
    }
  );

export const adjustInventorySchema = z.object({
  deltaQuantity: z
    .number()
    .int()
    .refine((n) => n !== 0, { message: 'deltaQuantity cannot be zero' }),
  movementType: z.enum([
    'ADD',
    'RESTOCK',
    'SALE',
    'ADJUSTMENT',
    'RETURN',
    'EXPIRY_DISPOSAL',
    'RESERVATION',
  ]),
  reason: z.enum([
    'INITIAL_STOCK',
    'SALE',
    'SALE_RETURN',
    'RESERVATION_HOLD',
    'RESERVATION_RELEASE',
    'TRANSFER_DISPATCH',
    'TRANSFER_RECEIPT',
    'STOCK_AUDIT',
    'EXPIRY_DISPOSAL',
  ]),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const inventoryQuerySchema = z.object({
  q: z.string().trim().max(150).optional().default(''),
  status: z.enum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'ALL']).optional().default('ALL'),
  expiry: z.enum(['ALL', 'NEAR_EXPIRY', 'EXPIRED', 'VALID']).optional().default('ALL'),
  sortBy: z
    .enum(['updated_desc', 'quantity_asc', 'expiry_asc', 'name_asc'])
    .optional()
    .default('updated_desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const alertsQuerySchema = z.object({
  nearExpiryDays: z.coerce.number().int().min(1).max(365).default(30),
});

export const itemIdParamSchema = z.object({
  itemId: z.string().uuid('Invalid inventory itemId UUID'),
});
