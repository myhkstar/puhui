import { Modality } from '@google/genai';
import { genAI } from '../config/gemini.js';

const TEXT_MODEL = 'gemini-3-pro-preview';
const IMAGE_MODEL = 'gemini-3-pro-image-preview';
const EDIT_MODEL = 'gemini-3-pro-image-preview';
const SIMPLE_IMAGE_MODEL = 'gemini-2.5-flash-image';

const getLevelInstruction = (level) => {
    switch (level) {
        case 'Elementary':
            return "Target Audience: Elementary School (Ages 6-10). Style: Bright, simple, fun. Use large clear icons and very minimal text labels.";
        case 'High School':
            return "Target Audience: High School. Style: Standard Textbook. Clean lines, clear labels, accurate maps or diagrams. Avoid cartoony elements.";
        case 'College':
            return "Target Audience: University. Style: Academic Journal. High detail, data-rich, precise cross-sections or complex schematics.";
        case 'Expert':
            return "Target Audience: Industry Expert. Style: Technical Blueprint/Schematic. Extremely dense detail, monochrome or technical coloring, precise annotations.";
        default:
            return "Target Audience: General Public. Style: Clear and engaging.";
    }
};

const getStyleInstruction = (style) => {
    switch (style) {
        case 'Minimalist': return "Aesthetic: Bauhaus Minimalist. Flat vector art, limited color palette (2-3 colors), reliance on negative space and simple geometric shapes.";
        case 'Realistic': return "Aesthetic: Photorealistic Composite. Cinematic lighting, 8k resolution, highly detailed textures. Looks like a photograph.";
        case 'Cartoon': return "Aesthetic: Educational Comic. Vibrant colors, thick outlines, expressive cel-shaded style.";
        case 'Vintage': return "Aesthetic: 19th Century Scientific Lithograph. Engraving style, sepia tones, textured paper background, fine hatch lines.";
        case 'Futuristic': return "Aesthetic: Cyberpunk HUD. Glowing neon blue/cyan lines on dark background, holographic data visualization, 3D wireframes.";
        case '3D Render': return "Aesthetic: 3D Isometric Render. Claymorphism or high-gloss plastic texture, studio lighting, soft shadows, looks like a physical model.";
        case 'Sketch': return "Aesthetic: Da Vinci Notebook. Ink on parchment sketch, handwritten annotations style, rough but accurate lines.";
        default: return "Aesthetic: High-quality digital scientific illustration. Clean, modern, highly detailed.";
    }
};

export const research = async (req, res) => {
    if (!genAI) return res.status(503).json({ message: 'AI service is not available.' });

    const { topic, level, style, language, aspectRatio } = req.body;

    try {
        const levelInstr = getLevelInstruction(level);
        const styleInstr = getStyleInstruction(style);

        const systemPrompt = `
      You are an expert visual researcher.
      Your goal is to research the topic: "${topic}" and create a plan for an infographic.
      
      **INSTRUCTIONS:**
      1. **Research Phase**: You MAY use English for your internal research and Google Search queries to get the most accurate and up-to-date scientific or historical facts.
      2. **Fact Output**: The 'FACTS' section should be in the user's requested language (${language}) if possible, or simple English if that is better for clarity.
      3. **Image Prompt Phase**: The 'IMAGE_PROMPT' section is for the image generator. 
         **CRITICAL RULE**: You MUST explicitly instruct the image generator that ANY text, labels, titles, or annotations visualised inside the image MUST be in "${language}".
         If the user's prompt did not specify a language, default to ${language}.
      
      Context:
      ${levelInstr}
      ${styleInstr}
      Target Output Language: ${language}
      Target Aspect Ratio: ${aspectRatio}

      Please provide your response in the following format EXACTLY:
      
      FACTS:
      - [Fact 1]
      - [Fact 2]
      - [Fact 3]
      
      IMAGE_PROMPT:
      [A highly detailed image generation prompt describing the visual composition, colors, and layout. The layout should be optimized for a ${aspectRatio} aspect ratio. END the prompt with this exact sentence: "All text, labels, and titles inside the image must be written in ${language}."]
    `;

        const model = genAI.getGenerativeModel({
            model: TEXT_MODEL,
            tools: [{ googleSearch: {} }],
        });

        const result = await model.generateContent(systemPrompt);
        const response = await result.response;
        const text = response.text() || "";
        const usage = response.usageMetadata?.totalTokenCount || 0;

        const factsMatch = text.match(/FACTS:\s*([\s\S]*?)(?=IMAGE_PROMPT:|$)/i);
        const factsRaw = factsMatch ? factsMatch[1].trim() : "";
        const facts = factsRaw.split('\n')
            .map(f => f.replace(/^-\s*/, '').trim())
            .filter(f => f.length > 0)
            .slice(0, 3);

        const promptMatch = text.match(/IMAGE_PROMPT:\s*([\s\S]*?)$/i);
        const imagePrompt = promptMatch ? promptMatch[1].trim() : `Create a detailed infographic about ${topic}. ${levelInstr} ${styleInstr}. Layout: ${aspectRatio}. Important: All text labels inside the image must be in ${language}.`;

        const searchResults = [];
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;

        if (chunks) {
            chunks.forEach(chunk => {
                if (chunk.web?.uri && chunk.web?.title) {
                    searchResults.push({
                        title: chunk.web.title,
                        url: chunk.web.uri
                    });
                }
            });
        }

        const uniqueResults = Array.from(new Map(searchResults.map(item => [item.url, item])).values());

        res.json({
            imagePrompt: imagePrompt,
            facts: facts,
            searchResults: uniqueResults,
            usage: usage
        });

    } catch (error) {
        console.error('Gemini research error:', error);
        res.status(500).json({ message: 'An error occurred during the research process.' });
    }
};

export const generateImage = async (req, res) => {
    if (!genAI) return res.status(503).json({ message: 'AI service is not available.' });
    const { prompt, aspectRatio } = req.body;
    try {
        const model = genAI.getGenerativeModel({ model: IMAGE_MODEL });
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                responseModalities: [Modality.IMAGE],
                imageConfig: { aspectRatio: aspectRatio },
            }
        });
        const response = await result.response;
        const usage = response.usageMetadata?.totalTokenCount || 0;
        const part = response.candidates?.[0]?.content?.parts?.[0];
        if (part && part.inlineData && part.inlineData.data) {
            res.json({
                content: `data:image/png;base64,${part.inlineData.data}`,
                usage: usage
            });
        } else {
            throw new Error("Failed to generate image from API response");
        }
    } catch (error) {
        console.error('Gemini image generation error:', error);
        res.status(500).json({ message: 'An error occurred during image generation.' });
    }
};

export const editImage = async (req, res) => {
    if (!genAI) return res.status(503).json({ message: 'AI service is not available.' });
    const { currentImageInput, editInstruction } = req.body;
    try {
        const cleanBase64 = currentImageInput.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
        const model = genAI.getGenerativeModel({ model: EDIT_MODEL });
        const result = await model.generateContent({
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
                    { text: editInstruction }
                ]
            }],
            generationConfig: {
                responseModalities: [Modality.IMAGE],
            }
        });
        const response = await result.response;
        const usage = response.usageMetadata?.totalTokenCount || 0;
        const part = response.candidates?.[0]?.content?.parts?.[0];
        if (part && part.inlineData && part.inlineData.data) {
            res.json({
                content: `data:image/png;base64,${part.inlineData.data}`,
                usage: usage
            });
        } else {
            throw new Error("Failed to edit image from API response");
        }
    } catch (error) {
        console.error('Gemini image edit error:', error);
        res.status(500).json({ message: 'An error occurred during image editing.' });
    }
};

export const generateSimpleImage = async (req, res) => {
    if (!genAI) return res.status(503).json({ message: 'AI service is not available.' });
    const { prompt, images } = req.body;
    try {
        const parts = [{ text: prompt }];
        for (const imgBase64 of images) {
            const clean = imgBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
            parts.push({
                inlineData: { mimeType: 'image/png', data: clean }
            });
        }
        const model = genAI.getGenerativeModel({ model: SIMPLE_IMAGE_MODEL });
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: parts }],
        });
        const response = await result.response;
        const usage = response.usageMetadata?.totalTokenCount || 0;
        const partsOut = response.candidates?.[0]?.content?.parts;
        if (partsOut) {
            for (const p of partsOut) {
                if (p.inlineData && p.inlineData.data) {
                    return res.json({
                        content: `data:image/png;base64,${p.inlineData.data}`,
                        usage: usage
                    });
                }
            }
        }
        throw new Error("No image generated from API response");
    } catch (error) {
        console.error('Gemini simple image generation error:', error);
        res.status(500).json({ message: 'An error occurred during simple image generation.' });
    }
};

export const chat = async (req, res) => {
    if (!genAI) return res.status(503).json({ message: 'AI service is not available.' });
    const { history, newMessage, modelName, attachments, isSearchEnabled } = req.body;

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const systemInstruction = `
    你是一個溫暖、耐心、對初學者極度友好的通用型 AI 助手，名字叫「普普」。你的主要目標是讓不懂 AI 的人也能輕鬆愉快地和你聊天、解決問題，並慢慢喜歡上使用 AI。
    請永遠遵守以下原則：
    3.5.1. 用戶使用什麽語言/文字問你，你就用什麽語言/文字回答，除非用戶指定你用什麽語言思考、用什麽語言回答。比如，用戶用簡體中文和你聊天，你也要用簡體中文回復；如果用戶是中英文夾雜，你也可以試著用這樣的方式聊天。
    3.5.2. 絕對不要丟出一堆技術細節嚇人，除非用戶主動說「我想知道更深入的」。
    3.5.3. 回答要像一個熱情又不煩人的鄰家姐姐/哥哥一樣，語氣親切、帶一點鼓勵和幽默。
    3.5.4 每當用戶成功完成一件事（不管多小），都要真心誇獎他，例如「哇！你剛剛那個問題問得超棒！」「第一次用就這麼厲害，我好驕傲喔～」
    3.5.5 如果用戶卡住了，要主動提供超詳細、一步一步的指引（一步一步用編號），並在每一步結束後問「這一步你完成了嗎？卡在哪里我陪你一起解決！」
    3.5.6 允許用戶用任何方式表達（打字亂、錯字、語句不完整、方言都 OK），你要能完全理解並用標準但溫柔的語氣回應。
    3.5.7 當用戶表達挫折、害怕或對 AI 有疑慮時，先共情再安慰，例如「我知道一開始用 AI 會覺得怪怪的，我當初也被嚇到呢！其實我就是個超級聽話的聊天夥伴而已啦～」
    3.5.8 結尾經常加一點溫暖的結語，例如「有什麼問題隨時呼喚我喔！我一直在這裡陪你～」「今天又學到新東西了，真開心能陪著你！」
    3.5.9 如果你使用了 Google 搜索工具，請務必在回答中整合搜索到的信息，並確保信息的準確性。
    記住：你不是在教課，你是在交朋友的同時，順便幫忙解決問題。
    讓每一次對話都讓用戶覺得「原來 AI 這麼好玩、這麼簡單！」
    `;
        const formattedHistory = history.map(h => ({
            role: h.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: h.content }]
        }));

        const tools = [];
        const toolConfig = {};

        if (isSearchEnabled) {
            tools.push({ googleSearch: {} });
            toolConfig.googleSearchRetrieval = {
                dynamicRetrievalConfig: {
                    mode: "MODE_DYNAMIC",
                    dynamicThreshold: 0.7,
                }
            };
        }

        const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction,
            tools: tools.length > 0 ? tools : undefined,
            toolConfig: Object.keys(toolConfig).length > 0 ? toolConfig : undefined,
        });

        const chat = model.startChat({
            history: formattedHistory,
        });

        const parts = [{ text: newMessage }];
        if (attachments && attachments.length > 0) {
            for (const file of attachments) {
                parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });
            }
        }

        const result = await chat.sendMessageStream(parts);

        let aggregatedGroundingMetadata = null;

        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
                res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
            }
            // Correct path for groundingMetadata in streaming response
            const metadata = chunk.candidates?.[0]?.groundingMetadata;
            if (metadata) {
                aggregatedGroundingMetadata = metadata;
            }
        }

        if (aggregatedGroundingMetadata) {
            const searchResults = [];
            const chunks = aggregatedGroundingMetadata.groundingChunks;

            if (chunks) {
                chunks.forEach(chunk => {
                    if (chunk.web?.uri && chunk.web?.title) {
                        searchResults.push({
                            title: chunk.web.title,
                            url: chunk.web.uri
                        });
                    }
                });
            }
            const uniqueResults = Array.from(new Map(searchResults.map(item => [item.url, item])).values());
            res.write(`data: ${JSON.stringify({ groundingMetadata: { searchResults: uniqueResults } })}\n\n`);
        }

        res.write('data: [DONE]\n\n');
        res.end();

    } catch (error) {
        console.error('Gemini chat error:', error);
        res.write(`data: ${JSON.stringify({ error: 'An error occurred during the chat session.' })}\n\n`);
        res.end();
    }
};

export const generateTitle = async (req, res) => {
    if (!genAI) return res.status(503).json({ message: 'AI service is not available.' });
    const { text } = req.body;
    try {
        const systemPrompt = `You are a title generator. Your task is to create a very short, concise, and descriptive title (max 5 words, in the same language as the input) for the following user message. Do not add quotes or any other formatting.`;
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(`${systemPrompt}\n\nUser Message: "${text}"\n\nTitle:`);
        const response = await result.response;
        const title = response.text()?.trim().replace(/"/g, '') || text.substring(0, 20);
        res.json({ title });
    } catch (error) {
        console.error('Gemini title generation error:', error);
        res.status(500).json({ message: 'An error occurred during title generation.' });
    }
};

export const beautifyImage = async (req, res) => {
    if (!genAI) return res.status(503).json({ message: 'AI service is not available.' });
    const { image, prompt } = req.body;
    try {
        const cleanBase64 = image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
        const model = genAI.getGenerativeModel({ model: EDIT_MODEL });
        const result = await model.generateContent({
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
                    { text: prompt }
                ]
            }],
            generationConfig: {
                responseModalities: [Modality.IMAGE],
            }
        });
        const response = await result.response;
        const usage = response.usageMetadata?.totalTokenCount || 0;
        const part = response.candidates?.[0]?.content?.parts?.[0];
        if (part && part.inlineData && part.inlineData.data) {
            res.json({
                content: `data:image/png;base64,${part.inlineData.data}`,
                usage: usage
            });
        } else {
            throw new Error("Failed to beautify image from API response");
        }
    } catch (error) {
        console.error('Gemini image beautify error:', error);
        res.status(500).json({ message: 'An error occurred during image beautification.' });
    }
};

export const analyzeImage = async (req, res) => {
    if (!genAI) return res.status(503).json({ message: 'AI service is not available.' });
    const { image } = req.body;
    try {
        const cleanBase64 = image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
        const prompt = `Analyze this image and classify it into one of these three categories: "person", "object", or "other". 
        - "person": If the main subject is one or more people (portraits, group photos, etc.).
        - "object": If the main subject is a specific item, food, product, or toy where details and textures are important.
        - "other": If it's a landscape, abstract art, or doesn't fit the above.
        Return ONLY the category name in lowercase.`;

        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent({
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
                    { text: prompt }
                ]
            }]
        });
        const response = await result.response;
        const category = response.text()?.trim().toLowerCase() || 'other';
        res.json({ category });
    } catch (error) {
        console.error('Gemini image analysis error:', error);
        res.status(500).json({ message: 'An error occurred during image analysis.' });
    }
};
