import express, { Express } from 'express';
import { securityHeaders, corsMiddleware } from './middleware/security.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import healthRoutes from './routes/health.js';
import medicineRoutes, { createMedicineRouter } from './routes/medicines.js';
import pharmacyRoutes, { createPharmacyRouter } from './routes/pharmacies.js';
import { MedicineService } from './services/medicineService.js';
import { PharmacyService } from './services/pharmacyService.js';
import { TokenVerifier } from './middleware/auth.js';

export function createApp(options?: {
  medicineService?: MedicineService;
  pharmacyService?: PharmacyService;
  tokenVerifier?: TokenVerifier;
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
    ? createMedicineRouter(options.medicineService)
    : medicineRoutes;
  app.use('/api/v1/medicines', v1Medicines);

  // Mount v1 Pharmacy Management routes (authenticated & tenant-isolated)
  const v1Pharmacies =
    options?.pharmacyService || options?.tokenVerifier
      ? createPharmacyRouter({
          service: options.pharmacyService,
          tokenVerifier: options.tokenVerifier,
        })
      : pharmacyRoutes;
  app.use('/api/v1/pharmacies', v1Pharmacies);

  // Fallback for unmatched endpoints
  app.use(notFoundHandler);

  // Centralized error handling
  app.use(errorHandler);

  return app;
}

export const app = createApp();
