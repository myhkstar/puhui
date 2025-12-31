import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { pool } from '../config/db.js';
import { r2 } from '../config/r2.js';
import { useMockDb } from '../services/dbService.js';
import { mockImages } from '../services/mockData.js';

export const saveImage = async (req, res) => {
    const { id, data, prompt, level, style, language, facts, usage, timestamp } = req.body;

    if (!process.env.R2_BUCKET_NAME) {
        if (!useMockDb) return res.status(500).json({ message: "Server R2 Configuration Missing" });
    }

    try {
        let base64Data = data;
        if (data.includes('base64,')) {
            base64Data = data.split('base64,')[1];
        }
        const buffer = Buffer.from(base64Data, 'base64');
        const key = `users/${req.user.id}/${id}.png`;

        let url = data;
        if (process.env.R2_BUCKET_NAME) {
            try {
                await r2.send(new PutObjectCommand({
                    Bucket: process.env.R2_BUCKET_NAME,
                    Key: key,
                    Body: buffer,
                    ContentType: 'image/png'
                }));
                const command = new GetObjectCommand({
                    Bucket: process.env.R2_BUCKET_NAME,
                    Key: key,
                });
                url = await getSignedUrl(r2, command, { expiresIn: 604800 });
            } catch (r2Err) {
                console.warn("R2 Upload failed, using local data uri", r2Err.message);
            }
        }

        if (useMockDb) {
            mockImages.push({
                id,
                user_id: req.user.id,
                prompt,
                r2_key: key,
                data_url: url,
                level,
                style,
                language,
                facts: facts ? JSON.stringify(facts) : null,
                usage_count: usage || 0,
                created_at: timestamp
            });
            return res.json({ success: true, url });
        }

        await pool.query(`
      INSERT INTO images (id, user_id, prompt, r2_key, level, style, language, facts, usage_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, req.user.id, prompt, key, level, style, language, facts ? JSON.stringify(facts) : null, usage || 0, timestamp]);

        res.json({ success: true, url });
    } catch (err) {
        console.error('Image upload error:', err);
        res.status(500).json({ message: `Upload failed: ${err.message}` });
    }
};

export const getHistory = async (req, res) => {
    const { period, page = 1 } = req.query;
    const limit = 50;
    const offset = (parseInt(page) - 1) * limit;

    try {
        if (useMockDb) {
            const userImages = mockImages
                .filter(img => img.user_id === req.user.id)
                .sort((a, b) => b.created_at - a.created_at)
                .map(row => ({
                    id: row.id,
                    data: row.data_url || row.r2_key,
                    prompt: row.prompt,
                    timestamp: parseInt(row.created_at),
                    level: row.level,
                    style: row.style,
                    language: row.language,
                    facts: row.facts ? JSON.parse(row.facts) : [],
                    usage: row.usage_count || 0
                }));
            return res.json(userImages);
        }

        let query = 'SELECT * FROM images WHERE user_id = ?';
        const params = [req.user.id];

        if (period === 'week') {
            const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            query += ' AND created_at >= ?';
            params.push(oneWeekAgo);
        }

        query += ' ORDER BY created_at DESC';

        if (period !== 'week') {
            query += ' LIMIT ? OFFSET ?';
            params.push(limit, offset);
        }

        const [rows] = await pool.query(query, params);

        const history = await Promise.all(rows.map(async (row) => {
            let url = row.r2_key;
            if (process.env.R2_BUCKET_NAME && row.r2_key && !row.r2_key.startsWith('http')) {
                try {
                    const command = new GetObjectCommand({
                        Bucket: process.env.R2_BUCKET_NAME,
                        Key: row.r2_key,
                    });
                    url = await getSignedUrl(r2, command, { expiresIn: 3600 });
                } catch (e) { }
            }

            return {
                id: row.id,
                data: url,
                prompt: row.prompt,
                timestamp: parseInt(row.created_at),
                level: row.level,
                style: row.style,
                language: row.language,
                facts: row.facts ? JSON.parse(row.facts) : [],
                usage: row.usage_count || 0
            };
        }));

        res.json(history);
    } catch (err) {
        res.status(500).json({ message: `Fetch history failed: ${err.message}` });
    }
};

export const saveGeneratedImage = async (req, res) => {
    const { id, data, prompt, timestamp } = req.body;

    if (!process.env.R2_BUCKET_NAME) {
        return res.status(500).json({ message: "Server R2 Configuration Missing" });
    }

    try {
        let base64Data = data;
        if (data.includes('base64,')) {
            base64Data = data.split('base64,')[1];
        }
        const buffer = Buffer.from(base64Data, 'base64');
        const key = `users/${req.user.id}/generated/${id}.png`;

        await r2.send(new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: 'image/png'
        }));

        await pool.query(`
            INSERT INTO images (id, user_id, prompt, r2_key, level, style, language, facts, usage_count, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, req.user.id, prompt, key, 'N/A', 'ImageGenerator', 'N/A', null, 0, timestamp]);

        res.json({ success: true });
    } catch (err) {
        console.error('Generated image save error:', err);
        res.status(500).json({ message: `Save failed: ${err.message}` });
    }
};
