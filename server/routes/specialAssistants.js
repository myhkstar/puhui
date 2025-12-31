import express from 'express';
import * as specialAssistantController from '../controllers/specialAssistantController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, specialAssistantController.getAssistants);
router.post('/', authenticateToken, specialAssistantController.createAssistant);
router.put('/:id', authenticateToken, specialAssistantController.updateAssistant);
router.delete('/:id', authenticateToken, specialAssistantController.deleteAssistant);

export default router;
