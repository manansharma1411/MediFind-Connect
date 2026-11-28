import { Request, Response, NextFunction } from 'express';
import {
  demandAreasQuerySchema,
  demandOverviewQuerySchema,
  demandSignalRecordSchema,
  demandTrendsQuerySchema,
  demandUnmetQuerySchema,
  medicineInsightParamSchema,
  medicineInsightQuerySchema,
  pharmacyDemandQuerySchema,
} from '../validators/intelligenceValidators.js';
import {
  IntelligenceService,
  intelligenceService,
} from '../services/intelligenceService.js';
import { ApiResponse, AppError } from '../types/index.js';

function getAuthUserId(req: Request): string {
  if (!req.user?.id) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authenticated user context is missing.');
  }
  return req.user.id;
}

export function createIntelligenceController(service: IntelligenceService) {
  return {
    recordSignal: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const body = demandSignalRecordSchema.parse(req.body);
        const fingerprint = req.ip || 'anonymous-client';
        const result = await service.recordSearchSignal(body, fingerprint);

        const response: ApiResponse<typeof result> = {
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        };
        res.status(202).json(response);
      } catch (err) {
        next(err);
      }
    },

    getOverview: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = getAuthUserId(req);
        const query = demandOverviewQuerySchema.parse(req.query);
        const data = await service.getDemandOverview(userId, query);

        const response: ApiResponse<typeof data> = {
          success: true,
          data,
          timestamp: new Date().toISOString(),
        };
        res.status(200).json(response);
      } catch (err) {
        next(err);
      }
    },

    getTrends: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = getAuthUserId(req);
        const query = demandTrendsQuerySchema.parse(req.query);
        const data = await service.getDemandTrends(userId, query);

        const response: ApiResponse<typeof data> = {
          success: true,
          data,
          timestamp: new Date().toISOString(),
        };
        res.status(200).json(response);
      } catch (err) {
        next(err);
      }
    },

    getAreas: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = getAuthUserId(req);
        const query = demandAreasQuerySchema.parse(req.query);
        const data = await service.getAreaDemand(userId, query);

        const response: ApiResponse<typeof data> = {
          success: true,
          data,
          timestamp: new Date().toISOString(),
        };
        res.status(200).json(response);
      } catch (err) {
        next(err);
      }
    },

    getUnmet: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = getAuthUserId(req);
        const query = demandUnmetQuerySchema.parse(req.query);
        const data = await service.getUnmetDemand(userId, query);

        const response: ApiResponse<typeof data> = {
          success: true,
          data,
          timestamp: new Date().toISOString(),
        };
        res.status(200).json(response);
      } catch (err) {
        next(err);
      }
    },

    getMedicineInsights: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const userId = getAuthUserId(req);
        const { medicineId } = medicineInsightParamSchema.parse(req.params);
        const query = medicineInsightQuerySchema.parse(req.query);
        const data = await service.getMedicineInsights(userId, medicineId, query);

        const response: ApiResponse<typeof data> = {
          success: true,
          data,
          timestamp: new Date().toISOString(),
        };
        res.status(200).json(response);
      } catch (err) {
        next(err);
      }
    },

    getMyPharmacyDemand: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const userId = getAuthUserId(req);
        const query = pharmacyDemandQuerySchema.parse(req.query);
        const data = await service.getMyPharmacyDemandInsights(userId, query);

        const response: ApiResponse<typeof data> = {
          success: true,
          data,
          timestamp: new Date().toISOString(),
        };
        res.status(200).json(response);
      } catch (err) {
        next(err);
      }
    },
  };
}

export const intelligenceController = createIntelligenceController(intelligenceService);
