import dotenv from 'dotenv';
dotenv.config();

export const JWT_SECRET = process.env.JWT_SECRET || 'vision-secret-key-change-in-prod';
export const PORT = process.env.PORT || 3000;
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
