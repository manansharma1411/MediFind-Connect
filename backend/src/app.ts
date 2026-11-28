import express, { Express } from 'express';
import { securityHeaders, corsMiddleware } from './middleware/security.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import healthRoutes from './routes/health.js';
import medicineRoutes, { createMedicineRouter } from './routes/medicines.js';
import pharmacyRoutes, { createPharmacyRouter } from './routes/pharmacies.js';
import collaborationRoutes, { createCollaborationRouter } from './routes/collaboration.js';
import intelligenceRoutes, { createIntelligenceRouter } from './routes/intelligence.js';
import adminRoutes, { createAdminRouter } from './routes/admin.js';
import { MedicineService } from './services/medicineService.js';
import { PharmacyService } from './services/pharmacyService.js';
import { CollaborationService } from './services/collaborationService.js';
import { IntelligenceService } from './services/intelligenceService.js';
import { AiIntelligenceService } from './services/aiIntelligenceService.js';
import { AdminVerificationService } from './services/adminVerificationService.js';
import { AdminRoleChecker, TokenVerifier } from './middleware/auth.js';

export function createApp(options?: {
  medicineService?: MedicineService;
  pharmacyService?: PharmacyService;
  collaborationService?: CollaborationService;
  intelligenceService?: IntelligenceService;
  aiIntelligenceService?: AiIntelligenceService;
  adminVerificationService?: AdminVerificationService;
  tokenVerifier?: TokenVerifier;
  adminRoleChecker?: AdminRoleChecker;
  signalRateLimitMax?: number;
}): Express {
  const app = express();

  // Apply security headers
  app.use(securityHeaders);

  // Apply CORS middleware before all routes
  app.use(corsMiddleware);

  // Handle explicit preflight OPTIONS requests across all routes
  app.options('*', corsMiddleware);

  // Apply JSON body parsing with strict size limitation (1MB)
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Mount health & readiness routes at both /api and /
  app.use('/api', healthRoutes);
  app.use('/', healthRoutes);

  // Mount v1 Medicine Discovery routes (public)
  const v1Medicines = options?.medicineService
    ? createMedicineRouter(options.medicineService, options.intelligenceService)
    : medicineRoutes;
  app.use('/api/v1/medicines', v1Medicines);

  // Mount v1 Pharmacy Management routes (authenticated & tenant-isolated)
  const v1Pharmacies =
    options?.pharmacyService ||
    options?.intelligenceService ||
    options?.aiIntelligenceService ||
    options?.tokenVerifier
      ? createPharmacyRouter({
          service: options.pharmacyService,
          intelligenceService: options.intelligenceService,
          aiIntelligenceService: options.aiIntelligenceService,
          tokenVerifier: options.tokenVerifier,
        })
      : pharmacyRoutes;
  app.use('/api/v1/pharmacies', v1Pharmacies);

  // Mount v1 Pharmacy Collaboration routes (authenticated & participant-isolated)
  const v1Collaboration =
    options?.collaborationService || options?.tokenVerifier
      ? createCollaborationRouter({
          service: options.collaborationService,
          tokenVerifier: options.tokenVerifier,
        })
      : collaborationRoutes;
  app.use('/api/v1/collaboration', v1Collaboration);

  // Mount v1 Local Demand Intelligence routes (k-anonymous & pharmacy-scoped)
  const v1Intelligence =
    options?.intelligenceService ||
    options?.aiIntelligenceService ||
    options?.tokenVerifier ||
    options?.signalRateLimitMax
      ? createIntelligenceRouter({
          service: options.intelligenceService,
          aiService: options.aiIntelligenceService,
          tokenVerifier: options.tokenVerifier,
          signalRateLimitMax: options.signalRateLimitMax,
        })
      : intelligenceRoutes;
  app.use('/api/v1/intelligence', v1Intelligence);

  // Mount v1 Administrator Verification routes (strictly admin-only)
  const v1Admin =
    options?.adminVerificationService || options?.tokenVerifier || options?.adminRoleChecker
      ? createAdminRouter({
          verificationService: options.adminVerificationService,
          tokenVerifier: options.tokenVerifier,
          adminRoleChecker: options.adminRoleChecker,
        })
      : adminRoutes;
  app.use('/api/v1/admin', v1Admin);

  // Fallback for unmatched endpoints
  app.use(notFoundHandler);

  // Centralized error handling
  app.use(errorHandler);

  return app;
}

export const app = createApp();
