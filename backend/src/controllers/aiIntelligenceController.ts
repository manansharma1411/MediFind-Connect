import { Request, Response, NextFunction } from 'express';
import {
  forecastQuerySchema,
  matchesQuerySchema,
  medicineIdParamSchema,
  restockListQuerySchema,
  shortageDetailQuerySchema,
  shortageListQuerySchema,
} from '../validators/aiValidators.js';
import {
  AiIntelligenceService,
  aiIntelligenceService,
} from '../services/aiIntelligenceService.js';
import { ApiResponse, AppError } from '../types/index.js';

function getAuthUserId(req: Request): string {
  if (!req.user?.id) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authenticated user context is missing.');
  }
  return req.user.id;
}

export function createAiIntelligenceController(service: AiIntelligenceService) {
  return {
    getShortages: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = getAuthUserId(req);
        const query = shortageListQuerySchema.parse(req.query);
        const data = await service.getShortageRadar(userId, query);
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

    getShortageDetail: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const userId = getAuthUserId(req);
        const { medicineId } = medicineIdParamSchema.parse(req.params);
        const query = shortageDetailQuerySchema.parse(req.query);
        const data = await service.getShortageDetail(userId, medicineId, query);
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

    getMyRestockList: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const userId = getAuthUserId(req);
        const query = restockListQuerySchema.parse(req.query);
        const data = await service.getMyRestockRecommendations(userId, query);
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

    getMyRestockDetail: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const userId = getAuthUserId(req);
        const { medicineId } = medicineIdParamSchema.parse(req.params);
        const data = await service.getMyMedicineRestockDetail(userId, medicineId);
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

    getForecast: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = getAuthUserId(req);
        const query = forecastQuerySchema.parse(req.query);
        const data = await service.getDemandForecast(userId, query);
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

    getMatches: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = getAuthUserId(req);
        const query = matchesQuerySchema.parse(req.query);
        const data = await service.getSupplyDemandMatches(userId, query);
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

export const aiIntelligenceController = createAiIntelligenceController(
  aiIntelligenceService
);
