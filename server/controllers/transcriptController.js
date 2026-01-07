import { pool } from '../config/db.js';
import { genAI, fileManager } from '../config/gemini.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const MODEL_NAME = 'gemini-2.0-flash';
const REFINEMENT_MODEL = 'gemini-2.0-flash';

async function waitForFilesActive(files) {
    console.log(`[Transcript] Waiting for ${files.length} files to be active...`);
    for (const file of files) {
        let fileStatus = await fileManager.getFile(file.name);
        while (fileStatus.state === "PROCESSING") {
            process.stdout.write(".");
            await new Promise((resolve) => setTimeout(resolve, 2000));
            fileStatus = await fileManager.getFile(file.name);
        }
        if (fileStatus.state !== "ACTIVE") {
            throw new Error(`File ${file.name} failed to process: ${fileStatus.state}`);
        }
    }
    console.log("\n[Transcript] All files are active.");
}

export const processAudio = async (req, res) => {
    if (!genAI || !fileManager) return res.status(503).json({ message: 'AI service is not available.' });

    const files = req.files;
    if (!files || files.length === 0) {
        return res.status(400).json({ message: 'No audio files uploaded.' });
    }

    console.log(`[Transcript] Received ${files.length} files for processing.`);

    // Set headers for SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no'
    });

    const tempFiles = [];
    const uploadedFiles = [];

    try {
        // 1. Upload to Gemini File API
        for (const file of files) {
            const filePath = file.path;
            tempFiles.push(filePath); // For cleanup later

            console.log(`[Transcript] Uploading ${file.originalname} to Gemini File API...`);
            const uploadResult = await fileManager.uploadFile(filePath, {
                mimeType: file.mimetype,
                displayName: file.originalname,
            });
            uploadedFiles.push(uploadResult.file);
        }

        // 2. Wait for files to be ready
        await waitForFilesActive(uploadedFiles);

        // 3. Prepare prompt and parts
        const prompt = `你是一個專業的錄音轉寫專家。請對提供的錄音內容進行初步文字識別，並按照以下要求輸出：

1. **講者識別**：請識別不同的講者，並在每一段發言前標註講者（例如：講者 1, 講者 2...）。
2. **逐字稿**：請輸出包含講者標註的逐字稿，盡量保留原意，不要進行任何刪減或潤色。

請直接輸出轉寫結果，不要包含任何額外的解釋。`;

        const parts = [
            { text: prompt },
            ...uploadedFiles.map(file => ({
                fileData: {
                    mimeType: file.mimeType,
                    fileUri: file.uri
                }
            }))
        ];

        // 4. Stream generation
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });
        const result = await model.generateContentStream({ contents: [{ role: 'user', parts }] });

        let fullText = "";
        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
                fullText += chunkText;
                res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
            }
        }

        // 5. Finalize and Save to DB
        const content = fullText.trim();

        const transcriptId = uuidv4();
        const createdAt = Date.now();
        const title = `錄音整理 - ${new Date(createdAt).toLocaleString()}`;

        await pool.query(`
            INSERT INTO transcripts (id, user_id, title, content, original_content, keywords, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [transcriptId, req.user.id, title, content, content, '', createdAt]);

        // Send metadata at the end
        res.write(`data: ${JSON.stringify({
            done: true,
            id: transcriptId,
            title,
            keywords: '',
            content,
            createdAt
        })}\n\n`);
        res.end();

    } catch (error) {
        console.error('Transcription error:', error);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
    } finally {
        // Cleanup temp files
        for (const tempPath of tempFiles) {
            try { await fs.unlink(tempPath); } catch (e) { }
        }
        // Note: We don't delete from Gemini File API here to allow potential reuse or just let them expire (auto-delete after 48h)
    }
};

export const getHistory = async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM transcripts WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: `Failed to fetch history: ${error.message}` });
    }
};

export const streamTranscript = async (req, res) => {
    // This is now redundant but kept for compatibility if needed, 
    // or we can redirect it to processAudio logic.
    res.status(410).json({ message: 'This endpoint is deprecated. Use /process instead.' });
};

export const refineTranscript = async (req, res) => {
    if (!genAI) return res.status(503).json({ message: 'AI service is not available.' });

    const { id } = req.params;
    const { refinementType } = req.body; // 'organize' or 'formalize'

    if (!id || !refinementType) {
        return res.status(400).json({ message: 'Missing transcript ID or type.' });
    }

    try {
        const [rows] = await pool.query('SELECT original_content, keywords FROM transcripts WHERE id = ? AND user_id = ?', [id, req.user.id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Transcript not found.' });
        }

        const originalText = rows[0].original_content || rows[0].content;
        if (!originalText) {
            return res.status(400).json({ message: 'Content not found for this transcript.' });
        }

        const model = genAI.getGenerativeModel({ model: REFINEMENT_MODEL });

        let prompt = "";
        if (refinementType === 'organize') {
            prompt = `你是一位專業的文案整理專家。請對以下錄音逐字稿進行深度整理，要求如下：
1. **去噪**：刪除「嗯、啊、那個、就是、然後」等無意義的口癖和冗餘詞彙。
2. **書面化**：在不改變原意的基礎上，將口語轉化為正式用語或書面語。
3. **糾錯**：識別並標註可能的語音識別錯誤（例如：用括號註明原文，如「我們去了北京（原文：背景）」）。
4. **語言潤色**：使語言通順、專業且易於閱讀，優化句式結構，但絕對不要改變用戶的原意。
5. **自動標題**：在文稿的最開頭提供一個簡短有力、概括全文的標題，標題後換行並空一行。

原始文本：
${originalText}`;
        } else {
            return res.status(400).json({ message: 'Invalid refinement type.' });
        }

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const refinedText = response.text();

        await pool.query('UPDATE transcripts SET content = ? WHERE id = ?', [refinedText, id]);

        res.json({ refinedText });
    } catch (error) {
        console.error('Refinement error:', error);
        res.status(500).json({ message: `Refinement failed: ${error.message}` });
    }
};

export const deleteTranscript = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM transcripts WHERE id = ? AND user_id = ?', [id, req.user.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: `Failed to delete transcript: ${error.message}` });
    }
};
