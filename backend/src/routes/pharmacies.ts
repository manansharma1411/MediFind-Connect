import { Router } from 'express';
import { createPharmacyController, pharmacyController } from '../controllers/pharmacyController.js';
import {
  createIntelligenceController,
  intelligenceController,
} from '../controllers/intelligenceController.js';
import {
  aiIntelligenceController,
  createAiIntelligenceController,
} from '../controllers/aiIntelligenceController.js';
import { guardPrivateInventory } from '../controllers/medicineController.js';
import { createRequireAuth, requireAuth, TokenVerifier, verifySupabaseToken } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { PharmacyService } from '../services/pharmacyService.js';
import { IntelligenceService } from '../services/intelligenceService.js';
import { AiIntelligenceService } from '../services/aiIntelligenceService.js';
import { AppError } from '../types/index.js';
import type { NextFunction, Request, Response } from 'express';

export function createPharmacyRouter(options?: {
  service?: PharmacyService;
  intelligenceService?: IntelligenceService;
  aiIntelligenceService?: AiIntelligenceService;
  tokenVerifier?: TokenVerifier;
}): Router {
  const router = Router();
  const controller = options?.service
    ? createPharmacyController(options.service)
    : pharmacyController;
  const intelController = options?.intelligenceService
    ? createIntelligenceController(options.intelligenceService)
    : intelligenceController;
  const aiController = options?.aiIntelligenceService
    ? createAiIntelligenceController(options.aiIntelligenceService)
    : aiIntelligenceController;
  const auth = options?.tokenVerifier
    ? createRequireAuth(options.tokenVerifier)
    : requireAuth;

  // NOTE: GET /api/v1/pharmacies (public pharmacy directory) is still [PLANNED]
  // and must NOT be intercepted by Bearer-token authentication middleware.
  // Auth is applied strictly to registration (POST /) and protected /me/* routes.

  const registrationLimiter = createRateLimiter({
    windowMs: 60_000,
    maxRequests: 10,
    keyPrefix: 'pharmacy-register',
  });

  const optionalStrictAuth = async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return next();
    if (!authHeader.startsWith('Bearer ')) {
      return next(
        new AppError(401, 'UNAUTHORIZED', 'Missing or malformed Authorization Bearer token.')
      );
    }
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Empty Authorization Bearer token.'));
    }
    try {
      const verifier = options?.tokenVerifier ?? verifySupabaseToken;
      const user = await verifier(token);
      if (!user) {
        return next(new AppError(401, 'UNAUTHORIZED', 'Invalid or expired authentication token.'));
      }
      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  };

  // Canonical self-service & authenticated pharmacy registration
  router.post('/register', registrationLimiter, optionalStrictAuth, controller.selfRegisterPharmacy);

  // Backward-compatible authenticated registration alias
  router.post('/', auth, controller.registerPharmacy);

  // Authorized Pharmacy Profile, Operating Hours, Dashboard, Alerts, & Inventory
  router.use('/me', auth);
  router.get('/me', controller.getMyProfile);
  router.put('/me', controller.updateMyProfile);
  router.get('/me/operating-hours', controller.getMyOperatingHours);
  router.put('/me/operating-hours', controller.updateMyOperatingHours);

  router.get('/me/dashboard', controller.getDashboard);
  router.get('/me/alerts', controller.getAlerts);
  router.get('/me/intelligence/demand', intelController.getMyPharmacyDemand);
  router.get('/me/intelligence/restock', aiController.getMyRestockList);
  router.get('/me/intelligence/restock/:medicineId', aiController.getMyRestockDetail);

  router.get('/me/inventory', controller.listInventory);
  router.post('/me/inventory', controller.addInventoryItem);
  router.get('/me/inventory/:itemId', controller.getInventoryItem);
  router.put('/me/inventory/:itemId', controller.updateInventoryItem);
  router.post('/me/inventory/:itemId/adjust', controller.adjustInventory);
  router.get('/me/inventory/:itemId/history', controller.getInventoryItemHistory);

  // Block arbitrary :id/inventory manipulation (must use /me/inventory)
  router.get('/:id/inventory', auth, guardPrivateInventory);

  return router;
}

export default createPharmacyRouter();
