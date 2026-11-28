import { Router } from 'express';
import {
  adminVerificationController,
  createAdminVerificationController,
} from '../controllers/adminVerificationController.js';
import { createRequireAdmin, requireAdmin, TokenVerifier } from '../middleware/auth.js';
import { AdminVerificationService } from '../services/adminVerificationService.js';

export function createAdminRouter(options?: {
  verificationService?: AdminVerificationService;
  tokenVerifier?: TokenVerifier;
}): Router {
  const router = Router();
  const controller = options?.verificationService
    ? createAdminVerificationController(options.verificationService)
    : adminVerificationController;
  const adminGuard = options?.tokenVerifier
    ? createRequireAdmin(options.tokenVerifier)
    : requireAdmin;

  // All admin routes strictly require verified JWT + administrator role
  router.use(adminGuard);

  router.get('/pharmacies/pending', controller.listPendingPharmacies);
  router.get('/pharmacies/:id/verification', controller.getVerificationDetails);
  router.patch('/pharmacies/:id/verification', controller.verifyPharmacy);

  return router;
}

export default createAdminRouter();
