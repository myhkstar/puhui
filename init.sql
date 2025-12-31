-- Users Table
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
);

-- Images Table
CREATE TABLE IF NOT EXISTS images (
    id VARCHAR(255) PRIMARY KEY,
    user_id INT,
    prompt TEXT,
    r2_key VARCHAR(255),
    level VARCHAR(50),
    style VARCHAR(50),
    language VARCHAR(50),
    facts TEXT,
    usage_count INT DEFAULT 0,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at BIGINT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Chat Sessions Table
CREATE TABLE IF NOT EXISTS chat_sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id INT,
    title VARCHAR(255),
    created_at BIGINT,
    updated_at BIGINT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Chat Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255),
    role VARCHAR(50),
    content TEXT,
    created_at BIGINT,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

-- Usage Logs Table
CREATE TABLE IF NOT EXISTS usage_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    feature_name VARCHAR(100),
    token_count INT DEFAULT 0,
    created_at BIGINT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Special Assistants Table
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
);
