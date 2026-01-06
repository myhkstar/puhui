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
        'Connection': 'keep-alive'
    });

    const tempFiles = [];
    const uploadedFiles = [];

    try {
        // 1. Save to temp and Upload to File API
        for (const file of files) {
            const tempPath = path.join(os.tmpdir(), `upload_${uuidv4()}_${file.originalname}`);
            await fs.writeFile(tempPath, file.buffer);
            tempFiles.push(tempPath);

            console.log(`[Transcript] Uploading ${file.originalname} to Gemini File API...`);
            const uploadResult = await fileManager.uploadFile(tempPath, {
                mimeType: file.mimetype,
                displayName: file.originalname,
            });
            uploadedFiles.push(uploadResult.file);
        }

        // 2. Wait for files to be ready
        await waitForFilesActive(uploadedFiles);

        // 3. Prepare prompt and parts
        const prompt = `你是一個專業的錄音整理專家。請對提供的錄音內容進行文字提取，並按照以下要求輸出：

1. **關鍵詞提取**：在文稿的最前面，提煉出4-5個核心關鍵詞，每個關鍵詞前加上'#'號，並用空格分隔。例如：#關鍵詞一 #關鍵詞二 #關鍵詞三
2. **內容結構**：關鍵詞獨佔一行，其後空一行，然後開始正文。
3. **講者識別**：請識別不同的講者，並在每一段發言前標註講者（例如：Speaker 1, Speaker 2...）。
4. **逐字稿**：請輸出包含講者標註的逐字稿，盡量保留原意。

請直接輸出最終文稿，不要包含任何額外的解釋。`;

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
        const lines = fullText.split('\n');
        const keywordsLine = lines[0]?.startsWith('#') ? lines[0] : '';
        const contentStartIndex = keywordsLine ? (lines[1]?.trim() === '' ? 2 : 1) : 0;
        const content = lines.slice(contentStartIndex).join('\n').trim();

        const transcriptId = uuidv4();
        const createdAt = Date.now();
        const title = `錄音整理 - ${new Date(createdAt).toLocaleString()}`;

        await pool.query(`
            INSERT INTO transcripts (id, user_id, title, content, original_content, keywords, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [transcriptId, req.user.id, title, content, content, keywordsLine, createdAt]);

        // Send metadata at the end
        res.write(`data: ${JSON.stringify({
            done: true,
            id: transcriptId,
            title,
            keywords: keywordsLine,
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
            prompt = `你是一位專業的文案整理專家。請對以下錄音逐字稿進行「AI整理」，要求如下：
1. **刪除冗詞**：刪除重複、多餘、囉嗦的字詞以及無意義的語氣停頓詞（如「嗯」、「啊」等），確保文稿通順、流暢。
2. **修正與標註**：如果原文中有明顯的口誤或事實性錯誤，可以直接改正，但必須在改正處後面用括號註明改動，例如：「我們去了北京（原文為上海）」。
3. **語音修正**：對一些發音不清或帶有方言口音的地方根據語境進行修正。
4. **忠於原文**：除了上述必要的精簡、潤色和修正，不要擅自增加或刪減核心內容，不要歸納總結。
5. **段落劃分**：根據內容的邏輯關係進行適當的段落劃分，但不要使用清單式的小標題。
6. **保留講者**：如果原文有講者標註，請盡量保留或合理整合。

原始文本：
${originalText}`;
        } else if (refinementType === 'formalize') {
            prompt = `你是一位專業的文案整理專家。請對以下錄音逐字稿進行「AI書面化」，要求如下：
1. **基於整理**：首先執行「AI整理」的所有步驟（刪除冗詞、修正口誤等）。
2. **書面化轉換**：在保留原意的基礎上，把一些過於口語化的內容轉成書面語或正式用語。
3. **標註轉換**：必須在轉換處後面用括號標註，例如：「這事兒挺靠譜的（原文：這事兒倍兒棒）」。
4. **忠於原文**：不要擅自增加或刪減核心內容，不要歸納總結。
5. **段落劃分**：根據內容的邏輯關係進行適當的段落劃分。

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
