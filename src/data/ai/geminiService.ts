// src/data/ai/geminiService.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "@/core/config/env";
import { AppError, ErrorCode } from "@/core/errors/AppError";
import { handleError } from "@/core/errors/errorHandler";

export type MacroAnalysisResult = {
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  servingSize: string;
};

type GeminiResponse = {
  foodName?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  servingSize?: string;
};

/**
 * Analiza una imagen de alimento usando Gemini 1.5 Flash
 * y extrae información nutricional estructurada
 */
export async function analyzeFoodImage(
  imageBase64: string,
): Promise<MacroAnalysisResult> {
  try {
    if (!env.geminiApiKey) {
      throw new AppError(
        "API Key de Gemini no configurada",
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const genAI = new GoogleGenerativeAI(env.geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Analiza esta imagen de alimento y extrae la información nutricional. 
Responde SOLO con un JSON válido en este formato exacto (sin markdown, sin código, solo JSON):
{
  "foodName": "nombre del alimento en español",
  "calories": número_de_calorías,
  "protein": gramos_de_proteína,
  "carbs": gramos_de_carbohidratos,
  "fats": gramos_de_grasas,
  "servingSize": "tamaño de porción (ej: '100g', '1 unidad', '250ml')"
}

Si no puedes identificar algún valor, usa 0. El servingSize debe ser descriptivo y en español.
Solo responde con el JSON, nada más.`;

    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: "image/jpeg",
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    // Limpiar la respuesta (puede venir con markdown o espacios)
    let cleanedText = text.trim();
    
    // Remover markdown code blocks si existen
    cleanedText = cleanedText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    cleanedText = cleanedText.trim();

    // Parsear JSON
    let parsed: GeminiResponse;
    try {
      parsed = JSON.parse(cleanedText);
    } catch (parseError) {
      // Intentar extraer JSON del texto si está embebido
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new AppError(
          "No se pudo parsear la respuesta de Gemini",
          ErrorCode.VALIDATION_ERROR,
          parseError,
        );
      }
    }

    // Validar y normalizar la respuesta
    const analysis: MacroAnalysisResult = {
      foodName: parsed.foodName || "Alimento no identificado",
      calories: typeof parsed.calories === "number" ? parsed.calories : 0,
      protein: typeof parsed.protein === "number" ? parsed.protein : 0,
      carbs: typeof parsed.carbs === "number" ? parsed.carbs : 0,
      fats: typeof parsed.fats === "number" ? parsed.fats : 0,
      servingSize: parsed.servingSize || "100g",
    };

    return analysis;
  } catch (error) {
    const appError = handleError(error, "geminiService.analyzeFoodImage");
    
    // Errores específicos de red
    if (appError.code === ErrorCode.NETWORK_ERROR) {
      throw new AppError(
        "Error de conexión con el servicio de IA. Verifica tu internet.",
        ErrorCode.NETWORK_ERROR,
        error,
      );
    }

    // Errores de API
    if (error instanceof Error && error.message.includes("API")) {
      throw new AppError(
        "Error al procesar la imagen. Intenta de nuevo.",
        ErrorCode.SERVER_ERROR,
        error,
      );
    }

    throw appError;
  }
}
