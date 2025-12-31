import express from 'express';
import * as usageController from '../controllers/usageController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/', authenticateToken, usageController.logUsage);
router.get('/me', authenticateToken, usageController.getMyUsage);

export default router;
