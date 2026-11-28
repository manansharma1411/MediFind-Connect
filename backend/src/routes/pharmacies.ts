import { Router } from 'express';
import { createPharmacyController, pharmacyController } from '../controllers/pharmacyController.js';
import {
  createIntelligenceController,
  intelligenceController,
} from '../controllers/intelligenceController.js';
import { guardPrivateInventory } from '../controllers/medicineController.js';
import { createRequireAuth, requireAuth, TokenVerifier } from '../middleware/auth.js';
import { PharmacyService } from '../services/pharmacyService.js';
import { IntelligenceService } from '../services/intelligenceService.js';

export function createPharmacyRouter(options?: {
  service?: PharmacyService;
  intelligenceService?: IntelligenceService;
  tokenVerifier?: TokenVerifier;
}): Router {
  const router = Router();
  const controller = options?.service
    ? createPharmacyController(options.service)
    : pharmacyController;
  const intelController = options?.intelligenceService
    ? createIntelligenceController(options.intelligenceService)
    : intelligenceController;
  const auth = options?.tokenVerifier
    ? createRequireAuth(options.tokenVerifier)
    : requireAuth;

  // NOTE: GET /api/v1/pharmacies (public pharmacy directory) is still [PLANNED]
  // and must NOT be intercepted by Bearer-token authentication middleware.
  // Auth is applied strictly to registration (POST /) and protected /me/* routes.

  // Registration (authenticated user only)
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
