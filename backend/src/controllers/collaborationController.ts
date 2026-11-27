import { Request, Response, NextFunction } from 'express';
import {
  approveTransferSchema,
  cancelTransferSchema,
  collaborationStockQuerySchema,
  createTransferSchema,
  dispatchTransferSchema,
  listTransfersQuerySchema,
  receiveTransferSchema,
  rejectTransferSchema,
  transferIdParamSchema,
} from '../validators/collaborationValidators.js';
import { CollaborationService } from '../services/collaborationService.js';
import { SupabaseCollaborationRepository } from '../repositories/collaborationRepository.js';
import { SupabasePharmacyRepository } from '../repositories/pharmacyRepository.js';
import { AppError } from '../types/index.js';

function getAuthUserId(req: Request): string {
  if (!req.user?.id) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
  }
  return req.user.id;
}

function getIdempotencyKey(req: Request): string | undefined {
  const raw = req.headers['idempotency-key'];
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim().slice(0, 128);
  }
  return undefined;
}

export function createCollaborationController(service: CollaborationService) {
  return {
    discoverStock: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = getAuthUserId(req);
        const query = collaborationStockQuerySchema.parse(req.query);
        const result = await service.discoverTransferStock(userId, query);
        res.status(200).json({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    },

    createTransfer: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = getAuthUserId(req);
        const input = createTransferSchema.parse(req.body);
        const transfer = await service.createTransferRequest(userId, input);
        res.status(201).json({
          success: true,
          message: 'Stock transfer request created.',
          data: transfer,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    },

    listTransfers: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = getAuthUserId(req);
        const query = listTransfersQuerySchema.parse(req.query);
        const result = await service.listTransfers(userId, query);
        res.status(200).json({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    },

    getTransferDetails: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = getAuthUserId(req);
        const { transferId } = transferIdParamSchema.parse(req.params);
        const result = await service.getTransferDetails(userId, transferId);
        res.status(200).json({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    },

    approveTransfer: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = getAuthUserId(req);
        const { transferId } = transferIdParamSchema.parse(req.params);
        const { approvedQuantity } = approveTransferSchema.parse(req.body ?? {});
        const result = await service.approveTransfer(
          userId,
          transferId,
          approvedQuantity,
          getIdempotencyKey(req)
        );
        res.status(200).json({
          success: true,
          message: 'Transfer approved and stock reserved.',
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    },

    rejectTransfer: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = getAuthUserId(req);
        const { transferId } = transferIdParamSchema.parse(req.params);
        const { reason } = rejectTransferSchema.parse(req.body);
        const result = await service.rejectTransfer(
          userId,
          transferId,
          reason,
          getIdempotencyKey(req)
        );
        res.status(200).json({
          success: true,
          message: 'Transfer request rejected.',
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    },

    dispatchTransfer: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = getAuthUserId(req);
        const { transferId } = transferIdParamSchema.parse(req.params);
        const { dispatchReference } = dispatchTransferSchema.parse(req.body ?? {});
        const result = await service.dispatchTransfer(
          userId,
          transferId,
          dispatchReference,
          getIdempotencyKey(req)
        );
        res.status(200).json({
          success: true,
          message: 'Transfer marked as dispatched.',
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    },

    receiveTransfer: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = getAuthUserId(req);
        const { transferId } = transferIdParamSchema.parse(req.params);
        const { receivedQuantity, discrepancyNotes } = receiveTransferSchema.parse(req.body);
        const result = await service.receiveTransfer(
          userId,
          transferId,
          receivedQuantity,
          discrepancyNotes,
          getIdempotencyKey(req)
        );
        res.status(200).json({
          success: true,
          message: result.hasDiscrepancy
            ? 'Transfer received and settled with recorded discrepancy.'
            : 'Transfer received and settled.',
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    },

    cancelTransfer: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = getAuthUserId(req);
        const { transferId } = transferIdParamSchema.parse(req.params);
        const { reason } = cancelTransferSchema.parse(req.body ?? {});
        const result = await service.cancelTransfer(
          userId,
          transferId,
          reason,
          getIdempotencyKey(req)
        );
        res.status(200).json({
          success: true,
          message: 'Transfer cancelled.',
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        next(err);
      }
    },
  };
}

const defaultCollabService = new CollaborationService(
  new SupabaseCollaborationRepository(),
  new SupabasePharmacyRepository()
);
export const collaborationController = createCollaborationController(defaultCollabService);
