import { GoogleGenAI } from '@google/genai';
import { GEMINI_API_KEY } from './constants.js';

let genAI = null;
if (GEMINI_API_KEY) {
    console.log('✅ Initializing Gemini AI Client...');
    genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
} else {
    console.warn('⚠️ WARNING: GEMINI_API_KEY is not set. AI features will be disabled.');
}

export { genAI };
