import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// --- Configuration ---
const JWT_SECRET = process.env.JWT_SECRET || 'vision-secret-key-change-in-prod';
const PORT = process.env.PORT || 3000;

// --- Mock Database State (For Fallback) ---
let useMockDb = false;
const mockUsers = [];
const mockImages = [];
const mockChatSessions = [];
const mockChatMessages = [];
const mockUsageLogs = [];
let nextUserId = 1;

// --- Database Connection (Aiven MySQL) ---
// Smartly determines connection method based on environment variables
let dbConfig;
if (process.env.DATABASE_URL) {
  console.log("✅ Connecting via DATABASE_URL...");
  const dbUrl = new URL(process.env.DATABASE_URL);
  dbConfig = {
    host: dbUrl.hostname,
    user: dbUrl.username,
    password: dbUrl.password,
    database: dbUrl.pathname.slice(1), // Remove leading '/'
    port: parseInt(dbUrl.port || '3306'),
    ssl: { rejectUnauthorized: false }, // Keep your existing SSL setting
    bigNumberStrings: true,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 5000
  };
} else {
  console.log("✅ Connecting via individual DB_* environment variables...");
  dbConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
    bigNumberStrings: true,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 5000
  };
}

const pool = mysql.createPool(dbConfig);

// --- Cloudflare R2 Connection ---
// Even if MySQL is blocked, HTTPS (443) for R2 usually works.
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// --- Initialization ---
const initDb = async () => {
  let connection;
  try {
    // Try to connect
    connection = await pool.getConnection();
    console.log('✅ Connected to MySQL successfully');

    // 2. Create Users Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(255),
        role ENUM('user', 'admin', 'vip') DEFAULT 'user',
        is_approved BOOLEAN DEFAULT FALSE,
        expiration_date BIGINT,
        contact_email VARCHAR(255),
        mobile VARCHAR(255),
        tokens BIGINT DEFAULT 100000,
        created_at BIGINT
      )
    `);

    // 3. Create Images Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS images (
        id VARCHAR(255) PRIMARY KEY,
        user_id INT,
        prompt TEXT,
        r2_key VARCHAR(255),
        level VARCHAR(50),
        style VARCHAR(50),
        language VARCHAR(50),
        created_at BIGINT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 4. Create Chat Tables
    await connection.query(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id VARCHAR(255) PRIMARY KEY,
        user_id INT,
        title VARCHAR(255),
        created_at BIGINT,
        updated_at BIGINT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id VARCHAR(255),
        role VARCHAR(50),
        content TEXT,
        created_at BIGINT,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
      )
    `);

    // 5. Create Usage Logs Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS usage_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        feature_name VARCHAR(100),
        token_count INT DEFAULT 0,
        created_at BIGINT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    // Add tokens column if it doesn't exist (for migration)
    try {
        await connection.query('SELECT tokens FROM users LIMIT 1');
    } catch (e) {
        if (e.code === 'ER_BAD_FIELD_ERROR') {
            console.log('🔧 Migrating users table: adding tokens column...');
            await connection.query('ALTER TABLE users ADD COLUMN tokens BIGINT DEFAULT 100000');
        }
    }

    // 6. Create Default Admin
    const [rows] = await connection.query('SELECT * FROM users WHERE username = ?', ['admin']);
    if (rows.length === 0) {
      const hash = await bcrypt.hash('gzx750403', 10);
      await connection.query(`
        INSERT INTO users (username, password_hash, display_name, role, is_approved, expiration_date, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, ['admin', hash, 'Administrator', 'admin', true, 4102444800000, Date.now()]);
      console.log('✅ Default admin account created');
    }

  } catch (err) {
    console.error('❌ FATAL: Database Connection Failed. The application cannot start.');
    console.error('   Please check your network connection and the Aiven database status.');
    console.error('   Error details:', err.message);
    process.exit(1); // Exit the process with a failure code
  } finally {
    if (connection) connection.release();
  }
};

initDb();

// --- Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- Helpers ---
const signToken = (user) => {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
};

// --- Routes ---

// Auth: Register
app.post('/api/auth/register', async (req, res) => {
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
            id: nextUserId++,
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

    const [result] = await pool.query(`
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
});

// Auth: Login
app.post('/api/auth/login', async (req, res) => {
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
      displayName: user.display_name, // Mock field name uses underscore in DB but we map consistently? In Mock we used underscore properties to match DB row shape
      role: user.role,
      isApproved: Boolean(user.is_approved),
      expirationDate: expDate,
      created_at: parseInt(user.created_at),
      contactEmail: user.contact_email,
      mobile: user.mobile,
      tokens: user.tokens,
      token
    };

    // Fix property naming diff between mock and db if any
    if (useMockDb) {
        userResponse.displayName = user.display_name;
    }

    res.json(userResponse);
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: `Login failed: ${err.message}` });
  }
});

// Auth: Me (Session Check)
app.get('/api/auth/me', authenticateToken, async (req, res) => {
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
});

// Images: Save
app.post('/api/images', authenticateToken, async (req, res) => {
  const { id, data, prompt, level, style, language, timestamp } = req.body;
  
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

    // Try Upload to R2 if config exists
    let url = data; // Default fallback to base64 if R2 fails
    if (process.env.R2_BUCKET_NAME) {
        try {
            await r2.send(new PutObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: key,
                Body: buffer,
                ContentType: 'image/png'
            }));
            // Generate signed URL
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
            data_url: url, // Store full URL in mock for simplicity
            level,
            style,
            language,
            created_at: timestamp
        });
        return res.json({ success: true, url });
    }

    await pool.query(`
      INSERT INTO images (id, user_id, prompt, r2_key, level, style, language, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, req.user.id, prompt, key, level, style, language, timestamp]);

    res.json({ success: true, url });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ message: `Upload failed: ${err.message}` });
  }
});

// Images: Get History
app.get('/api/images', authenticateToken, async (req, res) => {
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
                data: row.data_url || row.r2_key, // In mock we tried to store url
                prompt: row.prompt,
                timestamp: parseInt(row.created_at),
                level: row.level,
                style: row.style,
                language: row.language
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
        } catch (e) {}
      }
      
      return {
        id: row.id,
        data: url,
        prompt: row.prompt,
        timestamp: parseInt(row.created_at),
        level: row.level,
        style: row.style,
        language: row.language
      };
    }));

    res.json(history);
  } catch (err) {
    res.status(500).json({ message: `Fetch history failed: ${err.message}` });
  }
});

// --- Usage Logs API ---

app.post('/api/usage', authenticateToken, async (req, res) => {
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
    // Use a transaction to ensure all operations succeed or fail together
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // 1. Log the usage
      await connection.query('INSERT INTO usage_logs (user_id, feature_name, token_count, created_at) VALUES (?, ?, ?, ?)', 
        [req.user.id, feature, tokenCount || 0, Date.now()]);
      
      // 2. Deduct tokens
      await connection.query('UPDATE users SET tokens = tokens - ? WHERE id = ?', [tokenCount || 0, req.user.id]);
      
      // 3. Get the new token balance
      const [rows] = await connection.query('SELECT tokens FROM users WHERE id = ?', [req.user.id]);
      const remainingTokens = rows[0].tokens;

      await connection.commit();
      
      res.json({ success: true, remainingTokens });

    } catch (transactionErr) {
      await connection.rollback();
      throw transactionErr; // Rethrow to be caught by the outer catch block
    } finally {
      connection.release();
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/usage/me', authenticateToken, async (req, res) => {
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
});

app.get('/api/admin/usage', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  try {
    if (useMockDb) {
        // Join with users
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
});

// --- Chat API ---

app.post('/api/chat/sessions', authenticateToken, async (req, res) => {
  const { id, title, created_at } = req.body;
  try {
    if (useMockDb) {
        mockChatSessions.push({ id, user_id: req.user.id, title, created_at, updated_at: created_at });
        return res.json({ success: true });
    }
    await pool.query('INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [id, req.user.id, title, created_at, created_at]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/chat/sessions/:id', authenticateToken, async (req, res) => {
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
});

app.get('/api/chat/sessions', authenticateToken, async (req, res) => {
  try {
    if (useMockDb) {
        const sessions = mockChatSessions
            .filter(s => s.user_id === req.user.id)
            .sort((a, b) => b.updated_at - a.updated_at)
            .map(r => ({ id: r.id, title: r.title, timestamp: parseInt(r.updated_at) }));
        return res.json(sessions);
    }
    const [rows] = await pool.query('SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC', [req.user.id]);
    res.json(rows.map(r => ({ id: r.id, title: r.title, timestamp: parseInt(r.updated_at) })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/chat/sessions/:id', authenticateToken, async (req, res) => {
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
});

app.post('/api/chat/messages', authenticateToken, async (req, res) => {
  const { session_id, role, content, created_at } = req.body;
  try {
    if (useMockDb) {
        mockChatMessages.push({ id: Date.now(), session_id, role, content, created_at });
        // Update session timestamp
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
});

app.get('/api/chat/messages/:sessionId', authenticateToken, async (req, res) => {
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
});

// Admin: Get All Users
app.get('/api/admin/users', authenticateToken, async (req, res) => {
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
      history: []
    }));
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: `Admin fetch failed: ${err.message}` });
  }
});

// Admin: Update User
app.put('/api/admin/users/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  const { id } = req.params;
  const { displayName, role, isApproved, expirationDate, contactEmail, mobile, tokens } = req.body;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Get current tokens to calculate the difference
    const [rows] = await connection.query('SELECT tokens FROM users WHERE id = ?', [id]);
    const currentTokens = rows[0].tokens;
    const tokenChange = tokens - currentTokens;

    // Update the user
    await connection.query(`
      UPDATE users SET display_name = ?, role = ?, is_approved = ?, expiration_date = ?, contact_email = ?, mobile = ?, tokens = ?
      WHERE id = ?
    `, [displayName, role, isApproved, expirationDate, contactEmail, mobile, tokens, id]);

    // If tokens were added, log it
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
});

// Admin: Delete User
app.delete('/api/admin/users/:id', authenticateToken, async (req, res) => {
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
});

// Generated Images: Save (from Image Generator tool)
app.post('/api/generated-images', authenticateToken, async (req, res) => {
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

        // Upload to R2
        await r2.send(new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: 'image/png'
        }));

        // Save metadata to DB
        await pool.query(`
            INSERT INTO images (id, user_id, prompt, r2_key, level, style, language, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, req.user.id, prompt, key, 'N/A', 'ImageGenerator', 'N/A', timestamp]);

        res.json({ success: true });
    } catch (err) {
        console.error('Generated image save error:', err);
        res.status(500).json({ message: `Save failed: ${err.message}` });
    }
});

// Admin: Create User
app.post('/api/admin/users', authenticateToken, async (req, res) => {
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
    } else if (role === 'vip') {
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
            id: nextUserId++,
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
});

// --- Serve Frontend in Production ---
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
