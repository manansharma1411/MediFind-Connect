import { Router } from 'express';
import { medicineController, createMedicineController } from '../controllers/medicineController.js';
import { MedicineService } from '../services/medicineService.js';

export function createMedicineRouter(service?: MedicineService): Router {
  const router = Router();
  const controller = service ? createMedicineController(service) : medicineController;

  router.get('/', controller.searchMedicines);
  router.get('/:id', controller.getMedicineById);
  router.get('/:id/availability', controller.getMedicineAvailability);
  router.get('/:id/prices', controller.getMedicinePrices);

  return router;
}

export default createMedicineRouter();
