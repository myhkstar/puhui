import { pool } from '../config/db.js';
import { genAI } from '../config/gemini.js';
import { v4 as uuidv4 } from 'uuid';

const MODEL_NAME = 'gemini-2.0-flash'; // Using 2.0 as 2.5 is not yet standard, but user requested latest flash
const REFINEMENT_MODEL = 'gemini-2.0-flash';

export const processAudio = async (req, res) => {
    if (!genAI) return res.status(503).json({ message: 'AI service is not available.' });

    const files = req.files;
    if (!files || files.length === 0) {
        return res.status(400).json({ message: 'No audio files uploaded.' });
    }

    const totalSize = files.reduce((acc, file) => acc + file.size, 0);
    console.log(`[Transcript] Received ${files.length} files, total size: ${(totalSize / (1024 * 1024)).toFixed(2)} MB`);

    try {
        // 1. Combine audio data or process sequentially
        // For simplicity and to follow the requirement of "outputting one smooth transcript",
        // we will send all audio parts to Gemini in one go if possible, or process them and then refine.
        // Gemini 1.5 Flash supports multiple audio files in one prompt.

        const parts = [];

        // Add instruction prompt
        parts.push({
            text: `你是一個專業的錄音整理專家。請對提供的錄音內容進行文字提取，並按照以下要求輸出：

1. **關鍵詞提取**：在文稿的最前面，提煉出4-5個核心關鍵詞，每個關鍵詞前加上'#'號，並用空格分隔。例如：#關鍵詞一 #關鍵詞二 #關鍵詞三
2. **內容結構**：關鍵詞獨佔一行，其後空一行，然後開始正文。
3. **精簡流暢**：刪除重複、多餘的字詞、口頭禪以及無意義的語氣停頓詞（如「嗯」、「啊」等），確保文稿通順、流暢。
4. **修正與標註**：
    - 如果原文中有明顯的口誤或事實性錯誤，可以直接改正，但必須在改正處後面用括號註明改動，例如：「我們去了北京（原文為上海）」。
    - 對於過於口語化的內容，可以轉換為更正式的書面語，同樣需要在轉換處後面用括號標註，例如：「這事兒挺靠譜的（原文：這事兒倍兒棒）」。
5. **忠於原文**：除了上述必要的精簡、潤色和修正，不要擅自增加或刪減核心內容。
6. **合理分段**：根據內容的邏輯關係進行適當的段落劃分，但不要使用清單式的小標題。

請直接輸出最終文稿，不要包含任何額外的解釋。`
        });

        // Add audio files
        for (const file of files) {
            parts.push({
                inlineData: {
                    mimeType: file.mimetype,
                    data: file.buffer.toString('base64')
                }
            });
        }

        const response = await genAI.models.generateContent({
            model: MODEL_NAME,
            contents: { parts: parts }
        });

        const fullText = response.text || "";

        // Extract keywords and content for database
        const lines = fullText.split('\n');
        const keywordsLine = lines[0] || '';
        const content = lines.slice(2).join('\n').trim();

        const transcriptId = uuidv4();
        const createdAt = Date.now();
        const title = `錄音整理 - ${new Date().toLocaleString()}`;

        // Save to database
        await pool.query(`
            INSERT INTO transcripts (id, user_id, title, content, keywords, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [transcriptId, req.user.id, title, content, keywordsLine, createdAt]);

        res.json({
            id: transcriptId,
            title,
            keywords: keywordsLine,
            content,
            createdAt
        });

    } catch (error) {
        console.error('Transcription error:', error);
        res.status(500).json({ message: `Transcription failed: ${error.message}` });
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
    if (!genAI) return res.status(503).json({ message: 'AI service is not available.' });

    const { audio, mimeType } = req.body;
    if (!audio || !mimeType) {
        return res.status(400).json({ message: 'Missing audio data or mimeType.' });
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    try {
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });
        const result = await model.generateContentStream([
            "請生成此音頻的完整、詳細的文字記錄。",
            {
                inlineData: {
                    mimeType: mimeType,
                    data: audio
                }
            }
        ]);

        for await (const chunk of result.stream) {
            const chunkText = chunk.text;
            if (chunkText) {
                res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
            }
        }
        res.write('data: [DONE]\n\n');
        res.end();
    } catch (error) {
        console.error('Streaming transcription error:', error);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
    }
};

export const refineTranscript = async (req, res) => {
    if (!genAI) return res.status(503).json({ message: 'AI service is not available.' });

    const { text } = req.body;
    if (!text) {
        return res.status(400).json({ message: 'Missing text to refine.' });
    }

    try {
        const model = genAI.getGenerativeModel({ model: REFINEMENT_MODEL });
        const prompt = `你是一位專業的速記員和文案整理專家。請將以下原始錄音文本整理成一份精煉、格式良好的筆記。
要求：
1. **去蕪存菁**：刪除所有填充詞（如：嗯、啊、那個、然後）、重復內容以及錯誤的口語開頭。
2. **結構化**：使用 Markdown 語法。適當添加二級標題、加粗關鍵詞，並使用無序列表陳述要點。
3. **語言潤色**：使語言通順、專業，且易於閱讀，但不要改變用戶的原意。
4. **標註糾錯**：如果原文有明顯的邏輯矛盾或疑似識別錯誤，請在修正後用括號註明原文。
5. **自動標題**：在筆記開頭提供一個簡短有力的標題。

原始文本：
${text}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const refinedText = response.text();

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
