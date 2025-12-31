import express from 'express';
import * as chatController from '../controllers/chatController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/sessions', authenticateToken, chatController.createSession);
router.get('/sessions', authenticateToken, chatController.getSessions);
router.put('/sessions/:id', authenticateToken, chatController.updateSession);
router.delete('/sessions/:id', authenticateToken, chatController.deleteSession);
router.post('/messages', authenticateToken, chatController.saveMessage);
router.get('/messages/:sessionId', authenticateToken, chatController.getMessages);

export default router;
