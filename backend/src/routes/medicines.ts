import { Router } from 'express';
import { medicineController, createMedicineController } from '../controllers/medicineController.js';
import { MedicineService } from '../services/medicineService.js';
import { IntelligenceService } from '../services/intelligenceService.js';

export function createMedicineRouter(
  service?: MedicineService,
  signalService?: IntelligenceService
): Router {
  const router = Router();
  const controller = service
    ? createMedicineController(service, signalService)
    : medicineController;

  router.get('/', controller.searchMedicines);
  router.get('/:id', controller.getMedicineById);
  router.get('/:id/availability', controller.getMedicineAvailability);
  router.get('/:id/prices', controller.getMedicinePrices);

  return router;
}

export default createMedicineRouter();
