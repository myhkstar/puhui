import express from 'express';
import multer from 'multer';
import * as transcriptController from '../controllers/transcriptController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit per file
    }
});

router.post('/process', authenticateToken, upload.array('files', 5), transcriptController.processAudio);
router.get('/history', authenticateToken, transcriptController.getHistory);
router.delete('/:id', authenticateToken, transcriptController.deleteTranscript);

export default router;
