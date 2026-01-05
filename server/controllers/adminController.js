import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { useMockDb } from '../services/dbService.js';
import { mockUsers, incrementNextUserId, mockUsageLogs } from '../services/mockData.js';

export const getAllUsers = async (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    try {
        if (useMockDb) {
            const users = mockUsers.sort((a, b) => b.created_at - a.created_at).map(u => ({
                uid: u.id.toString(),
                username: u.username,
                displayName: u.display_name,
                role: u.role,
                isApproved: Boolean(u.is_approved),
                expirationDate: u.expiration_date ? parseInt(u.expiration_date) : null,
                created_at: parseInt(u.created_at),
                contactEmail: u.contact_email,
                mobile: u.mobile,
                tokens: u.tokens,
                history: []
            }));
            return res.json(users);
        }
        const [rows] = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
        const users = rows.map(u => ({
            uid: u.id.toString(),
            username: u.username,
            displayName: u.display_name,
            role: u.role,
            isApproved: Boolean(u.is_approved),
            expirationDate: u.expiration_date ? parseInt(u.expiration_date) : null,
            created_at: parseInt(u.created_at),
            contactEmail: u.contact_email,
            mobile: u.mobile,
            tokens: u.tokens,
            history: []
        }));
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: `Admin fetch failed: ${err.message}` });
    }
};

export const updateUser = async (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { id } = req.params;
    const { displayName, role, isApproved, expirationDate, contactEmail, mobile, tokens } = req.body;

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [rows] = await connection.query('SELECT tokens FROM users WHERE id = ?', [id]);
        const currentTokens = rows[0].tokens;
        const tokenChange = tokens - currentTokens;

        await connection.query(`
      UPDATE users SET display_name = ?, role = ?, is_approved = ?, expiration_date = ?, contact_email = ?, mobile = ?, tokens = ?
      WHERE id = ?
    `, [displayName, role, isApproved, expirationDate, contactEmail, mobile, tokens, id]);

        if (tokenChange > 0) {
            await connection.query(
                'INSERT INTO usage_logs (user_id, feature_name, token_count, created_at) VALUES (?, ?, ?, ?)',
                [id, '管理員手動充值', tokenChange, Date.now()]
            );
        }

        await connection.commit();
        res.json({ success: true });

    } catch (err) {
        await connection.rollback();
        res.status(500).json({ message: `Update failed: ${err.message}` });
    } finally {
        connection.release();
    }
};

export const deleteUser = async (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    try {
        if (useMockDb) {
            const idx = mockUsers.findIndex(u => u.id.toString() === req.params.id);
            if (idx !== -1) mockUsers.splice(idx, 1);
            return res.json({ success: true });
        }
        await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: `Delete failed: ${err.message}` });
    }
};

export const createUser = async (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { username, password, displayName, role } = req.body;

    try {
        const hash = await bcrypt.hash(password, 10);
        const createdAt = Date.now();
        let expirationDate = null;

        const now = new Date();
        if (role === 'user') {
            now.setDate(now.getDate() + 7);
            expirationDate = now.getTime();
        } else if (role === 'vip' || role === 'thinker') {
            now.setMonth(now.getMonth() + 1);
            expirationDate = now.getTime();
        } else if (role === 'admin') {
            expirationDate = 4102444800000;
        }

        if (useMockDb) {
            if (mockUsers.find(u => u.username === username)) {
                return res.json({ success: false, message: 'User exists' });
            }
            mockUsers.push({
                id: incrementNextUserId(),
                username,
                password_hash: hash,
                display_name: displayName || username,
                role,
                is_approved: true,
                expiration_date: expirationDate,
                created_at: createdAt
            });
            return res.json({ success: true });
        }

        await pool.query(`
      INSERT INTO users (username, password_hash, display_name, role, is_approved, expiration_date, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [username, hash, displayName || username, role, true, expirationDate, createdAt]);

        res.json({ success: true });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.json({ success: false, message: 'User exists' });
        res.status(500).json({ message: `Create failed: ${err.message}` });
    }
};

export const getAllUsage = async (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    try {
        if (useMockDb) {
            const logs = mockUsageLogs
                .map(l => {
                    const u = mockUsers.find(user => user.id === l.user_id);
                    return {
                        username: u ? u.username : 'Unknown',
                        feature: l.feature_name,
                        tokenCount: l.token_count,
                        timestamp: l.created_at
                    };
                })
                .sort((a, b) => b.timestamp - a.timestamp);
            return res.json(logs);
        }
        const [rows] = await pool.query(`
      SELECT u.username, l.feature_name, l.token_count, l.created_at 
      FROM usage_logs l 
      JOIN users u ON l.user_id = u.id 
      ORDER BY l.created_at DESC
    `);
        res.json(rows.map(r => ({ username: r.username, feature: r.feature_name, tokenCount: r.token_count, timestamp: parseInt(r.created_at) })));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
