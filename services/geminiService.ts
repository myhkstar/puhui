
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Modality } from "@google/genai";
import { AspectRatio, ComplexityLevel, VisualStyle, ResearchResult, SearchResultItem, Language, AIResponse } from "../types";

const getAi = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const TEXT_MODEL = 'gemini-3-pro-preview';
const IMAGE_MODEL = 'gemini-3-pro-image-preview';
const EDIT_MODEL = 'gemini-3-pro-image-preview';
// CHAT_MODEL removed as a constant, will be passed dynamically
const SIMPLE_IMAGE_MODEL = 'gemini-2.5-flash-image';

const getLevelInstruction = (level: ComplexityLevel): string => {
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

const getStyleInstruction = (style: VisualStyle): string => {
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

const ensureBase64 = async (input: string): Promise<string> => {
    if (input.startsWith('data:')) {
        return input;
    }
    if (input.startsWith('http')) {
        try {
            const response = await fetch(input);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.error("Image fetch error:", e);
            throw new Error("無法編輯圖片。請重試。");
        }
    }
    return input;
};

// --- Existing Functionality ---

export const researchTopicForPrompt = async (
  topic: string, 
  level: ComplexityLevel, 
  style: VisualStyle,
  language: Language,
  aspectRatio: AspectRatio
): Promise<ResearchResult> => {
  
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

  const response = await getAi().models.generateContent({
    model: TEXT_MODEL,
    contents: systemPrompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const text = response.text || "";
  const usage = response.usageMetadata?.totalTokenCount || 0;
  
  const factsMatch = text.match(/FACTS:\s*([\s\S]*?)(?=IMAGE_PROMPT:|$)/i);
  const factsRaw = factsMatch ? factsMatch[1].trim() : "";
  const facts = factsRaw.split('\n')
    .map(f => f.replace(/^-\s*/, '').trim())
    .filter(f => f.length > 0)
    .slice(0, 3); // Changed to exactly 3 facts as per requirement

  const promptMatch = text.match(/IMAGE_PROMPT:\s*([\s\S]*?)$/i);
  const imagePrompt = promptMatch ? promptMatch[1].trim() : `Create a detailed infographic about ${topic}. ${levelInstr} ${styleInstr}. Layout: ${aspectRatio}. Important: All text labels inside the image must be in ${language}.`;

  const searchResults: SearchResultItem[] = [];
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

  return {
    imagePrompt: imagePrompt,
    facts: facts,
    searchResults: uniqueResults,
    usage: usage
  };
};

export const generateInfographicImage = async (prompt: string, aspectRatio: AspectRatio): Promise<AIResponse> => {
  const response = await getAi().models.generateContent({
    model: IMAGE_MODEL,
    contents: {
      parts: [{ text: prompt }]
    },
    config: {
      responseModalities: [Modality.IMAGE],
      imageConfig: {
        aspectRatio: aspectRatio as any, // Gemini 3 Pro uses imageConfig for aspect ratio
      }
    }
  });

  const usage = response.usageMetadata?.totalTokenCount || 0;
  const part = response.candidates?.[0]?.content?.parts?.[0];
  if (part && part.inlineData && part.inlineData.data) {
    return {
        content: `data:image/png;base64,${part.inlineData.data}`,
        usage: usage
    };
  }
  throw new Error("Failed to generate image");
};

export const editInfographicImage = async (currentImageInput: string, editInstruction: string): Promise<AIResponse> => {
  const fullBase64 = await ensureBase64(currentImageInput);
  const cleanBase64 = fullBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
  
  const response = await getAi().models.generateContent({
    model: EDIT_MODEL,
    contents: {
      parts: [
         { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
         { text: editInstruction }
      ]
    },
    config: {
      responseModalities: [Modality.IMAGE],
    }
  });
  
  const usage = response.usageMetadata?.totalTokenCount || 0;
  const part = response.candidates?.[0]?.content?.parts?.[0];
  if (part && part.inlineData && part.inlineData.data) {
    return {
        content: `data:image/png;base64,${part.inlineData.data}`,
        usage: usage
    };
  }
  throw new Error("Failed to edit image");
};

// --- New Features ---

// 3.1 圖片生成 (Text + up to 2 images)
export const generateSimpleImage = async (prompt: string, images: string[]): Promise<AIResponse> => {
  const parts: any[] = [{ text: prompt }];
  
  for (const imgBase64 of images) {
     const clean = imgBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
     parts.push({
         inlineData: { mimeType: 'image/png', data: clean }
     });
  }

  const response = await getAi().models.generateContent({
      model: SIMPLE_IMAGE_MODEL,
      contents: { parts: parts },
  });

  const usage = response.usageMetadata?.totalTokenCount || 0;

  // Loop through parts to find image
  const partsOut = response.candidates?.[0]?.content?.parts;
  if (partsOut) {
      for (const p of partsOut) {
          if (p.inlineData && p.inlineData.data) {
              return {
                  content: `data:image/png;base64,${p.inlineData.data}`,
                  usage: usage
              };
          }
      }
  }
  
  throw new Error("No image generated");
};

// 3.5 AI助手 (Chat)
export const chatWithGemini = async (
    history: { role: string, content: string }[], 
    newMessage: string,
    modelName: string,
    attachments?: { mimeType: string, data: string }[]
): Promise<AIResponse> => {
    
    // Construct system instruction
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
記住：你不是在教課，你是在交朋友的同時，順便幫忙解決問題。
讓每一次對話都讓用戶覺得「原來 AI 這麼好玩、這麼簡單！」
    `;

    // Map history to proper Gemini format
    const formattedHistory = history.map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user', // DB stores 'assistant' or 'model', SDK uses 'model'
        parts: [{ text: h.content }]
    }));

    const chat = getAi().chats.create({
        model: modelName,
        history: formattedHistory,
        config: { systemInstruction }
    });

    const parts: any[] = [{ text: newMessage }];
    if (attachments && attachments.length > 0) {
        for (const file of attachments) {
            parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });
        }
    }

    const result = await chat.sendMessage({ message: parts });
    
    return {
        content: result.text || "",
        usage: result.usageMetadata?.totalTokenCount || 0
    };
};

export const generateTitleForText = async (text: string): Promise<string> => {
    try {
        const systemPrompt = `You are a title generator. Your task is to create a very short, concise, and descriptive title (max 5 words, in the same language as the input) for the following user message. Do not add quotes or any other formatting.`;
        const response = await getAi().models.generateContent({
            model: 'gemini-1.5-flash-latest', // Use a fast model for this
            contents: `${systemPrompt}\n\nUser Message: "${text}"\n\nTitle:`,
        });
        return response.text?.trim().replace(/"/g, '') || text.substring(0, 20);
    } catch (e) {
        console.error("Title generation failed", e);
        return text.substring(0, 20); // Fallback to simple truncation
    }
};
