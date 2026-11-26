import { Request, Response, NextFunction } from 'express';
import {
  availabilityQuerySchema,
  medicineSearchQuerySchema,
  priceComparisonQuerySchema,
  uuidParamSchema,
} from '../validators/medicineValidators.js';
import { MedicineService } from '../services/medicineService.js';
import { SupabaseMedicineRepository } from '../repositories/medicineRepository.js';
import { ApiResponse, AppError } from '../types/index.js';

export function createMedicineController(service: MedicineService) {
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
