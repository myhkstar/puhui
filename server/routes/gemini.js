import multer from 'multer';
import os from 'os';

const router = express.Router();
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, os.tmpdir());
        },
        filename: (req, file, cb) => {
            cb(null, `chat_${Date.now()}_${file.originalname}`);
        }
    }),
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
    }
});

router.post('/research', authenticateToken, geminiController.research);
router.post('/generate-image', authenticateToken, geminiController.generateImage);
router.post('/edit-image', authenticateToken, geminiController.editImage);
router.post('/generate-simple-image', authenticateToken, geminiController.generateSimpleImage);
router.post('/chat', authenticateToken, upload.array('files', 5), geminiController.chat);
router.post('/generate-title', authenticateToken, geminiController.generateTitle);
router.post('/beautify-image', authenticateToken, geminiController.beautifyImage);
router.post('/analyze-image', authenticateToken, geminiController.analyzeImage);

export default router;
