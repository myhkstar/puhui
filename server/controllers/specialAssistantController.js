import { pool } from '../config/db.js';

export const getAssistants = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM special_assistants WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
        res.json(rows.map(row => ({
            id: row.id,
            name: row.name,
            role: row.role,
            personality: row.personality,
            tone: row.tone,
            task: row.task,
            steps: row.steps,
            format: row.format,
            createdAt: parseInt(row.created_at),
            updatedAt: parseInt(row.updated_at),
        })));
    } catch (err) {
        console.error('Failed to fetch special assistants:', err);
        res.status(500).json({ message: `Failed to fetch special assistants: ${err.message}` });
    }
};

export const createAssistant = async (req, res) => {
    const { name, role, personality, tone, task, steps, format } = req.body;
    const id = `sa_${Date.now()}_${req.user.id}`;
    const createdAt = Date.now();
    const updatedAt = Date.now();

    try {
        await pool.query(`
      INSERT INTO special_assistants (id, user_id, name, role, personality, tone, task, steps, format, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, req.user.id, name, role, personality || '', tone || '', task || '', steps || '', format || '', createdAt, updatedAt]);

        res.status(201).json({
            id,
            name,
            role,
            personality,
            tone,
            task,
            steps,
            format,
            createdAt,
            updatedAt,
        });
    } catch (err) {
        console.error('Failed to create special assistant:', err);
        res.status(500).json({ message: `Failed to create special assistant: ${err.message}` });
    }
};

export const updateAssistant = async (req, res) => {
    const { id } = req.params;
    const { name, role, personality, tone, task, steps, format } = req.body;
    const updatedAt = Date.now();

    try {
        const [result] = await pool.query(`
      UPDATE special_assistants
      SET name = ?, role = ?, personality = ?, tone = ?, task = ?, steps = ?, format = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `, [name, role, personality || '', tone || '', task || '', steps || '', format || '', updatedAt, id, req.user.id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Special assistant not found or unauthorized' });
        }

        res.json({
            id,
            name,
            role,
            personality,
            tone,
            task,
            steps,
            format,
            updatedAt,
        });
    } catch (err) {
        console.error('Failed to update special assistant:', err);
        res.status(500).json({ message: `Failed to update special assistant: ${err.message}` });
    }
};

export const deleteAssistant = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.query('DELETE FROM special_assistants WHERE id = ? AND user_id = ?', [id, req.user.id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Special assistant not found or unauthorized' });
        }

        res.json({ success: true, message: 'Special assistant deleted successfully' });
    } catch (err) {
        console.error('Failed to delete special assistant:', err);
        res.status(500).json({ message: `Failed to delete special assistant: ${err.message}` });
    }
};
