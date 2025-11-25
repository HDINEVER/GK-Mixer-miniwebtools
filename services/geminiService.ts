import { GoogleGenAI, Type } from "@google/genai";
import { ColorData, Language } from "../types";

// NOTE: This assumes process.env.API_KEY is available.
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const langPromptMap = {
  en: "Please answer in English.",
  zh: "请使用中文回答。",
  ja: "日本語で答えてください。"
};

export const generatePaintRecipe = async (color: ColorData, lang: Language = 'en'): Promise<string> => {
  if (!process.env.API_KEY) {
    return "API Key missing. Cannot generate intelligent recipe.";
  }

  const ai = getAI();
  const langInstruction = langPromptMap[lang];

  const prompt = `
    I am a Garage Kit (GK) model painter. I need to mix a specific color.
    
    Target Color Information:
    Hex: ${color.hex}
    RGB: ${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}
    CMYK: C${color.cmyk.c} M${color.cmyk.m} Y${color.cmyk.y} K${color.cmyk.k}

    Please provide a mixing recipe using popular hobby paint brands:
    - Mr. Hobby (Gunze)
    - Gaia Notes
    - Jumpwind (optional)
    
    Format the response as a concise, step-by-step mixing guide. 
    Explain the ratios (e.g., "Mix 70% Mr. Color C1 White + 30% Gaia 003 Red").
    Also mention if any specific additives (retarder, thinner) are recommended for this type of shade if it looks metallic or clear.
    Keep it "Programmer Style" - concise, bullet points, technical.
    
    ${langInstruction}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: "You are an expert model painter assistant.",
        thinkingConfig: { thinkingBudget: 0 } 
      }
    });
    
    return response.text || "No recipe generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error generating recipe. Please check API Key or try again.";
  }
};