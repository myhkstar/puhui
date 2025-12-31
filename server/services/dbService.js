import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';

export let useMockDb = false;

export const initDb = async () => {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('✅ Connected to MySQL successfully');

        // Users Table
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
        avatar_r2_key VARCHAR(255),
        created_at BIGINT
      )
    `);

        // Images Table
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

        // Chat Tables
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

        // Usage Logs Table
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

        // Special Assistants Table
        await connection.query(`
      CREATE TABLE IF NOT EXISTS special_assistants (
        id VARCHAR(255) PRIMARY KEY,
        user_id INT,
        name VARCHAR(255) NOT NULL,
        role TEXT NOT NULL,
        personality TEXT,
        tone TEXT,
        task TEXT NOT NULL,
        steps TEXT NOT NULL,
        format TEXT,
        created_at BIGINT,
        updated_at BIGINT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

        // Migration: Add tokens column
        try {
            await connection.query('SELECT tokens FROM users LIMIT 1');
        } catch (e) {
            if (e.code === 'ER_BAD_FIELD_ERROR') {
                console.log('🔧 Migrating users table: adding tokens column...');
                await connection.query('ALTER TABLE users ADD COLUMN tokens BIGINT DEFAULT 100000');
            }
        }

        // Default Admin
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
        console.error('❌ Database Connection Failed during initialization.');
        console.error('   Error details:', err.message);
        useMockDb = true;
    } finally {
        if (connection) connection.release();
    }
};
