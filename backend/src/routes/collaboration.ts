import { Router } from 'express';
import {
  collaborationController,
  createCollaborationController,
} from '../controllers/collaborationController.js';
import { createRequireAuth, requireAuth, TokenVerifier } from '../middleware/auth.js';
import { CollaborationService } from '../services/collaborationService.js';

export function createCollaborationRouter(options?: {
  service?: CollaborationService;
  tokenVerifier?: TokenVerifier;
}): Router {
  const router = Router();
  const controller = options?.service
    ? createCollaborationController(options.service)
    : collaborationController;
  const auth = options?.tokenVerifier
    ? createRequireAuth(options.tokenVerifier)
    : requireAuth;

  // All pharmacy-to-pharmacy collaboration routes require authenticated pharmacy staff
  router.use(auth);

  // Eligible Stock Discovery
  router.get('/stock', controller.discoverStock);

  // Transfer Lifecycle
  router.get('/transfers', controller.listTransfers);
  router.post('/transfers', controller.createTransfer);
  router.get('/transfers/:transferId', controller.getTransferDetails);
  router.post('/transfers/:transferId/approve', controller.approveTransfer);
  router.post('/transfers/:transferId/reject', controller.rejectTransfer);
  router.post('/transfers/:transferId/dispatch', controller.dispatchTransfer);
  router.post('/transfers/:transferId/receive', controller.receiveTransfer);
  router.post('/transfers/:transferId/cancel', controller.cancelTransfer);

  return router;
}

export default createCollaborationRouter();
