import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

let dbConfig;
if (process.env.DATABASE_URL) {
    const dbUrl = new URL(process.env.DATABASE_URL);
    dbConfig = {
        host: dbUrl.hostname,
        user: dbUrl.username,
        password: dbUrl.password,
        database: dbUrl.pathname.slice(1),
        port: parseInt(dbUrl.port || '3306'),
        ssl: { rejectUnauthorized: false },
        bigNumberStrings: true,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 5000
    };
} else {
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

export const pool = mysql.createPool(dbConfig);
