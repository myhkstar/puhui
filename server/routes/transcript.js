import express from 'express';
import multer from 'multer';
import * as transcriptController from '../controllers/transcriptController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 200 * 1024 * 1024, // 200MB limit per file
    }
});

router.post('/process', authenticateToken, (req, res, next) => {
    upload.array('files', 5)(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ message: '檔案太大了，請上傳較小的音訊檔案（單個限制 200MB）。' });
            }
            return res.status(400).json({ message: `上傳錯誤: ${err.message}` });
        } else if (err) {
            return res.status(500).json({ message: `伺服器錯誤: ${err.message}` });
        }
        next();
    });
}, transcriptController.processAudio);
router.post('/stream', authenticateToken, transcriptController.streamTranscript);
router.post('/:id/refine', authenticateToken, transcriptController.refineTranscript);
router.get('/history', authenticateToken, transcriptController.getHistory);
router.delete('/:id', authenticateToken, transcriptController.deleteTranscript);

export default router;
