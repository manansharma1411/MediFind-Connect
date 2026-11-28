import { Router } from 'express';
import {
  createIntelligenceController,
  intelligenceController,
} from '../controllers/intelligenceController.js';
import { createRequireAuth, requireAuth, TokenVerifier } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { IntelligenceService } from '../services/intelligenceService.js';

export function createIntelligenceRouter(options?: {
  service?: IntelligenceService;
  tokenVerifier?: TokenVerifier;
  signalRateLimitMax?: number;
}): Router {
  const router = Router();
  const controller = options?.service
    ? createIntelligenceController(options.service)
    : intelligenceController;
  const auth = options?.tokenVerifier
    ? createRequireAuth(options.tokenVerifier)
    : requireAuth;

  const signalLimiter = createRateLimiter({
    windowMs: 60_000,
    maxRequests: options?.signalRateLimitMax ?? 30,
    keyPrefix: 'demand-signal',
  });

  // Privacy-preserving search signal ingestion (rate-limited, never accepts counts)
  router.post('/demand/signals', signalLimiter, controller.recordSignal);

  // Authenticated & pharmacy-scoped demand intelligence endpoints
  router.use('/demand', auth);
  router.get('/demand/overview', controller.getOverview);
  router.get('/demand/trends', controller.getTrends);
  router.get('/demand/areas', controller.getAreas);
  router.get('/demand/unmet', controller.getUnmet);
  router.get('/demand/medicines/:medicineId', controller.getMedicineInsights);

  return router;
}

export default createIntelligenceRouter();
