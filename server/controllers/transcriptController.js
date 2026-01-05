import { pool } from '../config/db.js';
import { genAI } from '../config/gemini.js';
import { v4 as uuidv4 } from 'uuid';

const MODEL_NAME = 'gemini-2.5-flash';
const REFINEMENT_MODEL = 'gemini-2.5-flash';

export const processAudio = async (req, res) => {
    if (!genAI) return res.status(503).json({ message: 'AI service is not available.' });

    const files = req.files;
    if (!files || files.length === 0) {
        return res.status(400).json({ message: 'No audio files uploaded.' });
    }

    console.log(`[Transcript] Received ${files.length} files for initial processing.`);

    try {
        const parts = [
            {
                text: `你是一個專業的錄音轉寫員。請對提供的音訊內容進行準確的文字轉寫。
重要要求：
1.  **識別講者**：如果音訊中有多個講者，請盡力識別並在每一段對話前標註，例如 "speaker01:", "speaker02:"。
2.  **逐字轉寫**：盡可能忠實地記錄所有口語內容，包括停頓詞、重複詞等，不要進行任何刪減或美化。
3.  **輸出格式**：直接輸出純文字格式的轉寫稿。`
            },
            ...files.map(file => ({
                inlineData: {
                    mimeType: file.mimetype,
                    data: file.buffer.toString('base64')
                }
            }))
        ];

        const model = genAI.getGenerativeModel({ model: MODEL_NAME });
        const result = await model.generateContent({ contents: [{ parts }] });
        const response = await result.response;
        const rawContent = response.text() || "音訊無法識別。";

        const transcriptId = uuidv4();
        const createdAt = Date.now();
        const title = `錄音整理 - ${new Date(createdAt).toLocaleString()}`;

        await pool.query(`
            INSERT INTO transcripts (id, user_id, title, raw_content, created_at)
            VALUES (?, ?, ?, ?, ?)
        `, [transcriptId, req.user.id, title, rawContent, createdAt]);

        res.json({
            id: transcriptId,
            title,
            rawContent,
            createdAt
        });

    } catch (error) {
        console.error('Initial transcription error:', error);
        res.status(500).json({ message: `Initial transcription failed: ${error.message}` });
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

    const { id } = req.params;
    const { refinementType } = req.body; // 'organize' or 'formalize'

    if (!refinementType) {
        return res.status(400).json({ message: 'Refinement type is required.' });
    }

    try {
        const [rows] = await pool.query('SELECT raw_content FROM transcripts WHERE id = ? AND user_id = ?', [id, req.user.id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Transcript not found.' });
        }
        const rawContent = rows[0].raw_content;

        let prompt = `你是一個專業的文稿整理專家。請基於以下提供的【原始文稿】，嚴格按照【處理要求】進行處理。

【原始文稿】
${rawContent}

【處理要求】
`;

        if (refinementType === 'organize') {
            prompt += `
1.  **核心任務：AI整理**。
2.  **精簡內容**：刪除重複、多餘、羅嗦的字詞以及無意義的語氣停頓詞（如“嗯”、“啊”等），確保文稿通順、流畅。
3.  **修正錯誤**：如果原文中有明顯的口誤或事實性錯誤，可以直接改正，但必須在改正處後面用括號注明改動，例如：“我們去了北京（原文為上海）”。
4.  **語境修正**：對一些發音不清或帶有方言口音的地方根據語境進行修正。
5.  **忠於原文**：除了上述必要的精簡、潤色和修正，不要擅自增加或刪減核心內容，不要歸納總結。
6.  **段落劃分**：根據內容的邏輯關係進行適當的段落劃分，但不要使用清單式的小標題。
7.  **關鍵詞提取**：在文稿的最前面，提煉出4-5個核心關鍵詞，每個關鍵詞前加上'#'號，並用空格分隔。關鍵詞獨佔一行，其後空一行，然後開始正文。`;
        } else if (refinementType === 'formalize') {
            prompt += `
1.  **核心任務：AI書面化**。
2.  **包含整理**：首先執行 "AI整理" 的所有要求（精簡內容、修正錯誤、語境修正、忠於原文、段落劃分、關鍵詞提取）。
3.  **書面化轉換**：在保留原意的基礎上，將過於口語化的內容轉成書面語或正式用語，並在轉換處後面用括號標註，例如：“這事兒挺靠譜的（原文：這事兒倍兒棒）”。`;
        } else {
            return res.status(400).json({ message: 'Invalid refinement type.' });
        }
        
        prompt += "\n\n請直接輸出最終文稿，不要包含任何額外的解釋。";

        const model = genAI.getGenerativeModel({ model: REFINEMENT_MODEL });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const refinedText = response.text();

        const lines = refinedText.split('\n');
        const keywordsLine = lines[0] || '';
        const content = lines.slice(2).join('\n').trim();

        const contentFieldToUpdate = refinementType === 'organize' ? 'organized_content' : 'formalized_content';

        await pool.query(`
            UPDATE transcripts
            SET keywords = ?, content = ?, ${contentFieldToUpdate} = ?
            WHERE id = ? AND user_id = ?
        `, [keywordsLine, content, content, id, req.user.id]);

        res.json({
            keywords: keywordsLine,
            content: content
        });

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
