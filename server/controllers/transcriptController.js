import { pool } from '../config/db.js';
import { genAI } from '../config/gemini.js';
import { v4 as uuidv4 } from 'uuid';

const MODEL_NAME = 'gemini-2.5-flash';

export const processAudio = async (req, res) => {
    if (!genAI) return res.status(503).json({ message: 'AI service is not available.' });

    const files = req.files;
    if (!files || files.length === 0) {
        return res.status(400).json({ message: 'No audio files uploaded.' });
    }

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

        const model = genAI.getGenerativeModel({ model: MODEL_NAME });
        const result = await model.generateContent(parts);
        const response = await result.response;
        const fullText = response.text();

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

export const deleteTranscript = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM transcripts WHERE id = ? AND user_id = ?', [id, req.user.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: `Failed to delete transcript: ${error.message}` });
    }
};
