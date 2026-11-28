import { Request, Response, NextFunction } from 'express';
import {
  adminPharmaciesListQuerySchema,
  adminPharmacyIdParamSchema,
  pendingPharmaciesQuerySchema,
  updatePharmacyOperationalStatusSchema,
  verifyPharmacyBodySchema,
} from '../validators/adminVerificationValidators.js';
import {
  AdminVerificationService,
  adminVerificationService,
} from '../services/adminVerificationService.js';
import { isAdministratorUser } from '../middleware/auth.js';
import { ApiResponse, AppError } from '../types/index.js';

function getAdminUserId(req: Request): string {
  if (!req.user?.id) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authenticated administrator context is missing.');
  }
  return req.user.id;
}

export function createAdminVerificationController(service: AdminVerificationService) {
  return {
    getAdminProfile: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const adminUserId = getAdminUserId(req);
        res.status(200).json({
          success: true,
          data: {
            userId: adminUserId,
            email: req.user?.email ?? null,
            role: req.user?.appRole ?? 'super_admin',
            isSuperAdmin: true,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    },

    listAllPharmacies: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const query = adminPharmaciesListQuerySchema.parse(req.query);
        const data = await service.listAllPharmacies(query);
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

    listPendingPharmacies: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const query = pendingPharmaciesQuerySchema.parse(req.query);
        const data = await service.listPharmacies(query);
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

    getVerificationDetails: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const { id } = adminPharmacyIdParamSchema.parse(req.params);
        const data = await service.getVerificationDetails(id);
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

    verifyPharmacy: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const adminUserId = getAdminUserId(req);
        const { id } = adminPharmacyIdParamSchema.parse(req.params);
        const body = verifyPharmacyBodySchema.parse(req.body);
        const data = await service.verifyPharmacy(id, adminUserId, body, {
          isVerifiedAdmin: Boolean(req.user && isAdministratorUser(req.user)),
        });
        const response: ApiResponse<typeof data> = {
          success: true,
          message:
            body.action === 'APPROVE'
              ? 'Pharmacy license approved and verified.'
              : 'Pharmacy license verification rejected.',
          data,
          timestamp: new Date().toISOString(),
        };
        res.status(200).json(response);
      } catch (err) {
        next(err);
      }
    },

    updatePharmacyStatus: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const adminUserId = getAdminUserId(req);
        const { id } = adminPharmacyIdParamSchema.parse(req.params);
        const body = updatePharmacyOperationalStatusSchema.parse(req.body);
        const data = await service.updatePharmacyOperationalStatus(id, adminUserId, body, {
          isVerifiedAdmin: Boolean(req.user && isAdministratorUser(req.user)),
        });
        const response: ApiResponse<typeof data> = {
          success: true,
          message:
            body.action === 'SUSPEND'
              ? 'Pharmacy suspended successfully.'
              : 'Pharmacy reactivated successfully.',
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

export const adminVerificationController = createAdminVerificationController(
  adminVerificationService
);
