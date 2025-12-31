import { pool } from '../config/db.js';
import { useMockDb } from '../services/dbService.js';
import { mockChatSessions, mockChatMessages } from '../services/mockData.js';

export const createSession = async (req, res) => {
    const { id, title, special_assistant_id, created_at } = req.body;
    try {
        if (useMockDb) {
            mockChatSessions.push({ id, user_id: req.user.id, title, special_assistant_id, created_at, updated_at: created_at });
            return res.json({ success: true });
        }
        await pool.query('INSERT INTO chat_sessions (id, user_id, title, special_assistant_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            [id, req.user.id, title, special_assistant_id, created_at, created_at]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const updateSession = async (req, res) => {
    const { id } = req.params;
    const { title } = req.body;
    try {
        if (useMockDb) {
            const session = mockChatSessions.find(s => s.id === id && s.user_id === req.user.id);
            if (session) session.title = title;
            return res.json({ success: true });
        }
        await pool.query('UPDATE chat_sessions SET title = ? WHERE id = ? AND user_id = ?', [title, id, req.user.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const getSessions = async (req, res) => {
    try {
        if (useMockDb) {
            const sessions = mockChatSessions
                .filter(s => s.user_id === req.user.id)
                .sort((a, b) => b.updated_at - a.updated_at)
                .map(r => ({ id: r.id, title: r.title, special_assistant_id: r.special_assistant_id, timestamp: parseInt(r.updated_at) }));
            return res.json(sessions);
        }
        const [rows] = await pool.query('SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC', [req.user.id]);
        res.json(rows.map(r => ({ id: r.id, title: r.title, special_assistant_id: r.special_assistant_id, timestamp: parseInt(r.updated_at) })));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const deleteSession = async (req, res) => {
    try {
        if (useMockDb) {
            const idx = mockChatSessions.findIndex(s => s.id === req.params.id && s.user_id === req.user.id);
            if (idx !== -1) mockChatSessions.splice(idx, 1);
            return res.json({ success: true });
        }
        await pool.query('DELETE FROM chat_sessions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const saveMessage = async (req, res) => {
    const { session_id, role, content, created_at } = req.body;
    try {
        if (useMockDb) {
            mockChatMessages.push({ id: Date.now(), session_id, role, content, created_at });
            const s = mockChatSessions.find(s => s.id === session_id);
            if (s) s.updated_at = created_at;
            return res.json({ success: true });
        }
        await pool.query('INSERT INTO chat_messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)',
            [session_id, role, content, created_at]);
        await pool.query('UPDATE chat_sessions SET updated_at = ? WHERE id = ?', [created_at, session_id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const getMessages = async (req, res) => {
    try {
        if (useMockDb) {
            const session = mockChatSessions.find(s => s.id === req.params.sessionId);
            if (!session || session.user_id !== req.user.id) return res.status(403).json({ message: 'Access denied' });

            const msgs = mockChatMessages
                .filter(m => m.session_id === req.params.sessionId)
                .sort((a, b) => a.created_at - b.created_at)
                .map(r => ({ id: r.id, role: r.role, content: r.content, timestamp: parseInt(r.created_at) }));
            return res.json(msgs);
        }
        const [session] = await pool.query('SELECT user_id FROM chat_sessions WHERE id = ?', [req.params.sessionId]);
        if (session.length === 0 || session[0].user_id !== req.user.id) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const [rows] = await pool.query('SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC', [req.params.sessionId]);
        res.json(rows.map(r => ({ id: r.id, role: r.role, content: r.content, timestamp: parseInt(r.created_at) })));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
