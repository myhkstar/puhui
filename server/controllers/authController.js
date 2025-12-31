import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { signToken } from '../middleware/auth.js';
import { useMockDb } from '../services/dbService.js';
import { mockUsers, incrementNextUserId } from '../services/mockData.js';

export const register = async (req, res) => {
    const { username, password, displayName, contactEmail, mobile } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password required' });
    }

    try {
        const hash = await bcrypt.hash(password, 10);
        const isApproved = false;
        const role = 'user';
        const createdAt = Date.now();

        if (useMockDb) {
            if (mockUsers.find(u => u.username === username)) {
                return res.status(409).json({ message: 'Username already exists' });
            }
            const newUser = {
                id: incrementNextUserId(),
                username,
                password_hash: hash,
                display_name: displayName || username,
                role,
                is_approved: isApproved,
                contact_email: contactEmail,
                mobile,
                created_at: createdAt,
                expiration_date: null
            };
            mockUsers.push(newUser);
            return res.json({ success: true, message: 'Registration successful (Mock). Waiting for approval.' });
        }

        await pool.query(`
      INSERT INTO users (username, password_hash, display_name, role, is_approved, contact_email, mobile, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [username, hash, displayName || username, role, isApproved, contactEmail, mobile, createdAt]);

        res.json({ success: true, message: 'Registration successful. Waiting for approval.' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Username already exists' });
        }
        res.status(500).json({ message: `Register failed: ${err.message}` });
    }
};

export const login = async (req, res) => {
    const { username, password } = req.body;

    try {
        let user;
        if (useMockDb) {
            user = mockUsers.find(u => u.username === username);
        } else {
            const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
            user = users[0];
        }

        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(400).json({ message: 'Invalid password' });
        }

        if (user.role !== 'admin' && !user.is_approved) {
            return res.status(403).json({ message: 'Account pending approval' });
        }

        const expDate = user.expiration_date ? parseInt(user.expiration_date) : null;
        if (user.role !== 'admin' && expDate && Date.now() > expDate) {
            return res.status(403).json({ message: 'Account expired' });
        }

        const token = signToken(user);

        const userResponse = {
            uid: user.id.toString(),
            username: user.username,
            displayName: user.display_name,
            role: user.role,
            isApproved: Boolean(user.is_approved),
            expirationDate: expDate,
            created_at: parseInt(user.created_at),
            contactEmail: user.contact_email,
            mobile: user.mobile,
            tokens: user.tokens,
            token
        };

        res.json(userResponse);
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ message: `Login failed: ${err.message}` });
    }
};

export const me = async (req, res) => {
    try {
        let user;
        if (useMockDb) {
            user = mockUsers.find(u => u.id === req.user.id);
        } else {
            const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
            user = users[0];
        }

        if (!user) return res.status(404).json({ message: 'User not found' });

        const userResponse = {
            uid: user.id.toString(),
            username: user.username,
            displayName: user.display_name,
            role: user.role,
            isApproved: Boolean(user.is_approved),
            expirationDate: user.expiration_date ? parseInt(user.expiration_date) : null,
            created_at: parseInt(user.created_at),
            contactEmail: user.contact_email,
            mobile: user.mobile,
            tokens: user.tokens
        };

        res.json(userResponse);
    } catch (err) {
        res.status(500).json({ message: `Session check failed: ${err.message}` });
    }
};
