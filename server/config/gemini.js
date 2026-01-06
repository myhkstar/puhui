import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { GEMINI_API_KEY } from './constants.js';

let genAI = null;
let fileManager = null;

if (GEMINI_API_KEY) {
    console.log('✅ Initializing Gemini AI Client (Official SDK)...');
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    fileManager = new GoogleAIFileManager(GEMINI_API_KEY);
} else {
    console.warn('⚠️ WARNING: GEMINI_API_KEY is not set. AI features will be disabled.');
}

export { genAI, fileManager };
