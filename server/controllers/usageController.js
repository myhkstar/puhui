import { pool } from '../config/db.js';
import { useMockDb } from '../services/dbService.js';
import { mockUsageLogs, mockUsers } from '../services/mockData.js';

export const logUsage = async (req, res) => {
    const { feature, tokenCount } = req.body;
    try {
        if (useMockDb) {
            mockUsageLogs.push({
                user_id: req.user.id,
                feature_name: feature,
                token_count: tokenCount || 0,
                created_at: Date.now()
            });
            const user = mockUsers.find(u => u.id === req.user.id);
            if (user) {
                user.tokens -= (tokenCount || 0);
                return res.json({ success: true, remainingTokens: user.tokens });
            }
            return res.json({ success: true });
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            await connection.query('INSERT INTO usage_logs (user_id, feature_name, token_count, created_at) VALUES (?, ?, ?, ?)',
                [req.user.id, feature, tokenCount || 0, Date.now()]);

            await connection.query('UPDATE users SET tokens = tokens - ? WHERE id = ?', [tokenCount || 0, req.user.id]);

            const [rows] = await connection.query('SELECT tokens FROM users WHERE id = ?', [req.user.id]);
            const remainingTokens = rows[0].tokens;

            await connection.commit();

            res.json({ success: true, remainingTokens });

        } catch (transactionErr) {
            await connection.rollback();
            throw transactionErr;
        } finally {
            connection.release();
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const getMyUsage = async (req, res) => {
    const { period, page = 1 } = req.query;
    const limit = 50;
    const offset = (parseInt(page) - 1) * limit;

    try {
        if (useMockDb) {
            const logs = mockUsageLogs
                .filter(l => l.user_id === req.user.id)
                .sort((a, b) => b.created_at - a.created_at)
                .map(r => ({ feature: r.feature_name, tokenCount: r.token_count, timestamp: parseInt(r.created_at) }));
            return res.json(logs);
        }

        let query = 'SELECT feature_name, token_count, created_at FROM usage_logs WHERE user_id = ?';
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
        res.json(rows.map(r => ({ feature: r.feature_name, tokenCount: r.token_count, timestamp: parseInt(r.created_at) })));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
