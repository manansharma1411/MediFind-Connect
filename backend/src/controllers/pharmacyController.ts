import { Request, Response, NextFunction } from 'express';
import {
  addInventoryItemSchema,
  adjustInventorySchema,
  alertsQuerySchema,
  inventoryQuerySchema,
  itemIdParamSchema,
  registerPharmacySchema,
  selfRegisterPharmacySchema,
  updateInventoryItemSchema,
  updateOperatingHoursSchema,
  updatePharmacyProfileSchema,
} from '../validators/pharmacyValidators.js';
import { PharmacyService } from '../services/pharmacyService.js';
import { SupabasePharmacyRepository } from '../repositories/pharmacyRepository.js';
import { ApiResponse, AppError } from '../types/index.js';

function getAuthenticatedUserId(req: Request): string {
  if (!req.user?.id) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
  }
  return req.user.id;
}

export function createPharmacyController(service: PharmacyService) {
  return {
    registerPharmacy: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = getAuthenticatedUserId(req);
        const input = registerPharmacySchema.parse(req.body);
        const pharmacy = await service.registerPharmacy(userId, input);

        const response: ApiResponse<typeof pharmacy> = {
          success: true,
          message: 'Pharmacy profile registered successfully.',
          data: pharmacy,
          timestamp: new Date().toISOString(),
        };
        res.status(201).json(response);
      } catch (err) {
        next(err);
      }
    },

    selfRegisterPharmacy: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const input = selfRegisterPharmacySchema.parse(req.body);
        const idempotencyKey =
          typeof req.headers['idempotency-key'] === 'string'
            ? req.headers['idempotency-key'].trim()
            : undefined;
        const result = await service.selfRegisterPharmacy(input, {
          authenticatedUserId: req.user?.id,
          idempotencyKey,
        });

        const response: ApiResponse<typeof result> = {
          success: true,
          message: 'Pharmacy registration submitted successfully. Verification is pending.',
          data: result,
          timestamp: new Date().toISOString(),
        };
        res.status(201).json(response);
      } catch (err) {
        next(err);
      }
    },

    getMyProfile: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = getAuthenticatedUserId(req);
        const pharmacy = await service.getMyProfile(userId);
        res.status(200).json({
          success: true,
          data: pharmacy,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    },

    updateMyProfile: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = getAuthenticatedUserId(req);
        const input = updatePharmacyProfileSchema.parse(req.body);
        const pharmacy = await service.updateMyProfile(userId, input);
        res.status(200).json({
          success: true,
          message: 'Pharmacy profile updated successfully.',
          data: pharmacy,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    },

    getMyOperatingHours: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const userId = getAuthenticatedUserId(req);
        const hours = await service.getMyOperatingHours(userId);
        res.status(200).json({
          success: true,
          data: { hours },
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    },

    updateMyOperatingHours: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const userId = getAuthenticatedUserId(req);
        const { hours } = updateOperatingHoursSchema.parse(req.body);
        const updated = await service.updateMyOperatingHours(userId, hours);
        res.status(200).json({
          success: true,
          message: 'Operating hours updated successfully.',
          data: { hours: updated },
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    },

    getDashboard: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = getAuthenticatedUserId(req);
        const dashboard = await service.getDashboard(userId);
        res.status(200).json({
          success: true,
          data: dashboard,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    },

    listInventory: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = getAuthenticatedUserId(req);
        const query = inventoryQuerySchema.parse(req.query);
        const result = await service.listInventory(userId, query);
        res.status(200).json({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    },

    addInventoryItem: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = getAuthenticatedUserId(req);
        const input = addInventoryItemSchema.parse(req.body);
        const item = await service.addInventoryItem(userId, input);
        res.status(201).json({
          success: true,
          message: 'Inventory item added successfully.',
          data: item,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    },

    getInventoryItem: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = getAuthenticatedUserId(req);
        const { itemId } = itemIdParamSchema.parse(req.params);
        const item = await service.getInventoryItem(userId, itemId);
        res.status(200).json({
          success: true,
          data: item,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    },

    updateInventoryItem: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const userId = getAuthenticatedUserId(req);
        const { itemId } = itemIdParamSchema.parse(req.params);
        const input = updateInventoryItemSchema.parse(req.body);
        const item = await service.updateInventoryItem(userId, itemId, input);
        res.status(200).json({
          success: true,
          message: 'Inventory item updated successfully.',
          data: item,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    },

    adjustInventory: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = getAuthenticatedUserId(req);
        const { itemId } = itemIdParamSchema.parse(req.params);
        const input = adjustInventorySchema.parse(req.body);
        const result = await service.adjustInventory(userId, itemId, input);
        res.status(200).json({
          success: true,
          message: 'Stock adjustment recorded atomically.',
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    },

    getInventoryItemHistory: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const userId = getAuthenticatedUserId(req);
        const { itemId } = itemIdParamSchema.parse(req.params);
        const history = await service.getInventoryItemHistory(userId, itemId);
        res.status(200).json({
          success: true,
          data: { history },
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    },

    getAlerts: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = getAuthenticatedUserId(req);
        const { nearExpiryDays } = alertsQuerySchema.parse(req.query);
        const result = await service.getAlerts(userId, nearExpiryDays);
        res.status(200).json({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    },
  };
}

const defaultPharmacyService = new PharmacyService(new SupabasePharmacyRepository());
export const pharmacyController = createPharmacyController(defaultPharmacyService);
