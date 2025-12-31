import express from 'express';
import * as imageController from '../controllers/imageController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/', authenticateToken, imageController.saveImage);
router.get('/', authenticateToken, imageController.getHistory);
router.post('/generated-images', authenticateToken, imageController.saveGeneratedImage);

export default router;
