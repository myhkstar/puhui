import express from 'express';
import * as adminController from '../controllers/adminController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/users', authenticateToken, adminController.getAllUsers);
router.post('/users', authenticateToken, adminController.createUser);
router.put('/users/:id', authenticateToken, adminController.updateUser);
router.delete('/users/:id', authenticateToken, adminController.deleteUser);
router.get('/usage', authenticateToken, adminController.getAllUsage);

export default router;
