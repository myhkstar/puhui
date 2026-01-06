import { pool } from '../config/db.js';

const migrate = async () => {
    try {
        console.log('Checking transcripts table schema...');
        const [columns] = await pool.query("SHOW COLUMNS FROM transcripts LIKE 'original_content'");

        if (columns.length === 0) {
            console.log('Adding original_content column...');
            await pool.query('ALTER TABLE transcripts ADD COLUMN original_content LONGTEXT');
            console.log('Successfully added original_content column.');
        } else {
            console.log('original_content column already exists.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrate();
