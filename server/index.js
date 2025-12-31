import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { PORT } from './config/constants.js';
import { initDb } from './services/dbService.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import adminRoutes from './routes/admin.js';
import imageRoutes from './routes/images.js';
import usageRoutes from './routes/usage.js';
import chatRoutes from './routes/chat.js';
import geminiRoutes from './routes/gemini.js';
import specialAssistantRoutes from './routes/specialAssistants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Initialize Database
initDb();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/gemini', geminiRoutes);
app.use('/api/special-assistants', specialAssistantRoutes);

// Serve Frontend in Production
const clientBuildPath = path.join(__dirname, '../dist');
app.use(express.static(clientBuildPath));

// Frontend Routing Fallback
app.get(/^(?!\/api).*/, (req, res) => {
    if (path.extname(req.path)) {
        res.status(404).end();
        return;
    }
    const indexPath = path.join(clientBuildPath, 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            res.status(500).send(err);
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
