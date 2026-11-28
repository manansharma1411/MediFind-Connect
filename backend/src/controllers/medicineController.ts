import { Request, Response, NextFunction } from 'express';
import {
  availabilityQuerySchema,
  medicineSearchQuerySchema,
  priceComparisonQuerySchema,
  uuidParamSchema,
} from '../validators/medicineValidators.js';
import { MedicineService } from '../services/medicineService.js';
import { SupabaseMedicineRepository } from '../repositories/medicineRepository.js';
import { IntelligenceService, intelligenceService } from '../services/intelligenceService.js';
import { env } from '../config/env.js';
import { ApiResponse, AppError } from '../types/index.js';

export function createMedicineController(
  service: MedicineService,
  signalService?: IntelligenceService
) {
  const tryRecordSignal = async (
    req: Request,
    payload: {
      medicineId: string | null;
      searchOutcome:
        | 'MATCH_FOUND'
        | 'NO_MATCH'
        | 'NO_ELIGIBLE_NEARBY_STOCK'
        | 'PARTIAL_AVAILABILITY';
      searchSource: 'MEDICINE_SEARCH' | 'AVAILABILITY_CHECK' | 'PRICE_COMPARISON';
      area?: string;
      city?: string;
      pincode?: string;
    }
  ): Promise<void> => {
    const targetService =
      signalService ?? (env.SUPABASE_SERVICE_ROLE_KEY ? intelligenceService : undefined);
    if (!targetService) return;
    try {
      await targetService.recordSearchSignal(payload, req.ip || 'anonymous-client');
    } catch {
      // Never block or fail public medicine discovery on telemetry errors
    }
  };

  return {
    searchMedicines: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const parsed = medicineSearchQuerySchema.parse(req.query);
        const result = await service.searchMedicines({
          q: parsed.q,
          form: parsed.form,
          page: parsed.page,
          limit: parsed.limit,
        });

        const area = typeof req.query.area === 'string' ? req.query.area : undefined;
        const city = typeof req.query.city === 'string' ? req.query.city : undefined;
        const pincode = typeof req.query.pincode === 'string' ? req.query.pincode : undefined;

        if (result.items.length === 1) {
          void tryRecordSignal(req, {
            medicineId: result.items[0].id,
            searchOutcome: 'MATCH_FOUND',
            searchSource: 'MEDICINE_SEARCH',
            area,
            city,
            pincode,
          });
        } else if (result.items.length === 0) {
          void tryRecordSignal(req, {
            medicineId: null,
            searchOutcome: 'NO_MATCH',
            searchSource: 'MEDICINE_SEARCH',
            area,
            city,
            pincode,
          });
        }

        const response: ApiResponse<typeof result> = {
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        };
        res.status(200).json(response);
      } catch (err) {
        next(err);
      }
    },

    getMedicineById: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const { id } = uuidParamSchema.parse(req.params);
        const medicine = await service.getMedicineById(id);

        const response: ApiResponse<typeof medicine> = {
          success: true,
          data: medicine,
          timestamp: new Date().toISOString(),
        };
        res.status(200).json(response);
      } catch (err) {
        next(err);
      }
    },

    getMedicineAvailability: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { id } = uuidParamSchema.parse(req.params);
        const query = availabilityQuerySchema.parse(req.query);

        const result = await service.getMedicineAvailability(id, {
          lat: query.lat,
          lng: query.lng,
          radiusKm: query.radiusKm,
        });

        const topLocation = result.pharmacies[0];
        const hasOutOrLow = result.pharmacies.some(
          (p) => p.status === 'OUT_OF_STOCK' || p.status === 'LOW_STOCK'
        );
        const searchOutcome =
          result.pharmacies.length === 0
            ? 'NO_ELIGIBLE_NEARBY_STOCK'
            : hasOutOrLow
              ? 'PARTIAL_AVAILABILITY'
              : 'MATCH_FOUND';

        void tryRecordSignal(req, {
          medicineId: id,
          searchOutcome,
          searchSource: 'AVAILABILITY_CHECK',
          area:
            (typeof req.query.area === 'string' ? req.query.area : undefined) ??
            topLocation?.area,
          city:
            (typeof req.query.city === 'string' ? req.query.city : undefined) ??
            topLocation?.city,
          pincode:
            (typeof req.query.pincode === 'string' ? req.query.pincode : undefined) ??
            topLocation?.pincode,
        });

        const response: ApiResponse<typeof result> = {
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        };
        res.status(200).json(response);
      } catch (err) {
        next(err);
      }
    },

    getMedicinePrices: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const { id } = uuidParamSchema.parse(req.params);
        const query = priceComparisonQuerySchema.parse(req.query);

        const result = await service.getMedicinePrices(id, {
          lat: query.lat,
          lng: query.lng,
          radiusKm: query.radiusKm,
          sortBy: query.sortBy,
        });

        const response: ApiResponse<typeof result> = {
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        };
        res.status(200).json(response);
      } catch (err) {
        next(err);
      }
    },
  };
}

/**
 * Authorization guard for private pharmacy inventory operations.
 * Full Supabase Auth + pharmacy_staff membership is planned for Phase 5B;
 * until then, private inventory endpoints strictly reject unauthenticated
 * and unauthorized requests with 401/403.
 */
export function guardPrivateInventory(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(
      new AppError(
        401,
        'UNAUTHORIZED',
        'Authentication required to access private pharmacy inventory.'
      )
    );
  }

  return next(
    new AppError(
      403,
      'FORBIDDEN',
      'Private pharmacy inventory access requires Phase 5B pharmacy staff membership verification.'
    )
  );
}

const defaultService = new MedicineService(new SupabaseMedicineRepository());
export const medicineController = createMedicineController(defaultService);
