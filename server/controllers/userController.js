import bcrypt from 'bcryptjs';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { pool } from '../config/db.js';
import { r2 } from '../config/r2.js';

export const updateProfile = async (req, res) => {
    const { displayName, contactEmail, mobile } = req.body;
    try {
        await pool.query(
            'UPDATE users SET display_name = ?, contact_email = ?, mobile = ? WHERE id = ?',
            [displayName, contactEmail, mobile, req.user.id]
        );
        res.json({ success: true, message: 'Profile updated successfully.' });
    } catch (err) {
        res.status(500).json({ message: `Profile update failed: ${err.message}` });
    }
};

export const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    try {
        const [users] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
        const user = users[0];

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const match = await bcrypt.compare(currentPassword, user.password_hash);
        if (!match) {
            return res.status(400).json({ message: 'Invalid current password' });
        }

        const hash = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);

        res.json({ success: true, message: 'Password changed successfully.' });
    } catch (err) {
        res.status(500).json({ message: `Password change failed: ${err.message}` });
    }
};

export const getAvatarUploadUrl = async (req, res) => {
    const { fileName, fileType } = req.body;
    const key = `avatars/${req.user.id}/${Date.now()}-${fileName}`;

    try {
        const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            ContentType: fileType,
        });
        const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 3600 });

        await pool.query('UPDATE users SET avatar_r2_key = ? WHERE id = ?', [key, req.user.id]);

        res.json({ success: true, uploadUrl, key });
    } catch (err) {
        console.error('Avatar upload URL error:', err);
        res.status(500).json({ message: `Could not get upload URL: ${err.message}` });
    }
};
