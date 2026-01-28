// src/data/ai/geminiService.ts
// ⚠️ REVISAR XCODE: User Script Sandboxing debe estar en NO para que la cámara funcione

import { AppError, ErrorCode } from "@/core/errors/AppError";

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

// --- Análisis de imagen (scan de comida): se mantiene con fetch ---
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

function parseRetryDelaySeconds(data: any): number | null {
  try {
    if (!data?.error?.details || !Array.isArray(data.error.details)) return null;
    const retryInfo = data.error.details.find(
      (d: any) => d["@type"]?.includes("google.rpc.RetryInfo")
    );
    if (!retryInfo?.retryDelay) return null;
    const delay = retryInfo.retryDelay;
    if (typeof delay === "string") {
      const m = delay.match(/(\d+)/);
      return m && m[1] != null ? parseInt(m[1], 10) : null;
    }
    if (typeof delay === "object" && delay.seconds != null)
      return parseInt(String(delay.seconds), 10);
    return null;
  } catch {
    return null;
  }
}

function normalizeBase64(base64: string): string {
  if (!base64) return base64;
  if (base64.includes(",")) return base64.split(",")[1] || base64;
  return base64;
}

export type MacroAnalysisResult = {
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  servingSize: string;
};

function processApiResponse(data: any): MacroAnalysisResult {
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("La API no devolvió una respuesta válida");
  let clean = text.replace(/```json|```/g, "").trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (match) clean = match[0].trim();
  const parsed = JSON.parse(clean) as any;
  return {
    foodName: parsed.foodName || "Alimento detectado",
    calories: Number(parsed.calories) || 0,
    protein: Number(parsed.protein) || 0,
    carbs: Number(parsed.carbs) || 0,
    fats: Number(parsed.fats) || 0,
    servingSize: parsed.servingSize || "1 porción",
  };
}

export const analyzeFoodImage = async (base64Image: string): Promise<MacroAnalysisResult> => {
  if (!API_KEY) throw new AppError("API Key no configurada", ErrorCode.VALIDATION_ERROR);
  const normalized = normalizeBase64(base64Image);
  const payload = {
    contents: [{
      parts: [
        { text: "Eres un nutricionista chileno. Analiza la imagen y responde SOLO JSON: { \"foodName\": string, \"calories\": number, \"protein\": number, \"carbs\": number, \"fats\": number, \"servingSize\": string }. Usa términos chilenos." },
        { inlineData: { mimeType: "image/jpeg", data: normalized } },
      ],
    }],
  };
  const headers: HeadersInit = { "Content-Type": "application/json", "x-goog-api-client": "expo-react-native/1.0" };
  const maxRetries = 2;
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(API_URL, { method: "POST", headers, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (response.ok) return processApiResponse(data);
      if (response.status === 429 || data.error?.message?.toLowerCase().includes("quota")) {
        const wait = (parseRetryDelaySeconds(data) ?? 5 + 1) * 1000;
        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        throw new AppError("Límite de cuota alcanzado. Reintenta en unos minutos.", ErrorCode.SERVER_ERROR, data);
      }
      throw new Error(data.error?.message || `Error ${response.status}`);
    } catch (err: any) {
      lastError = err;
      if (err.message?.includes("Network") && attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      throw err;
    }
  }
  throw new AppError(`Error al analizar imagen: ${lastError?.message}`, ErrorCode.SERVER_ERROR, lastError);
};

// --- Smart Coach Pro: refinamiento con @google/generative-ai ---

export type SmartCoachRefinementContext = {
  calorieGap: number;
  proteinGap: number;
  carbsGap: number;
  fatGap: number;
  currentFoodName: string;
  currentMessage: string;
  userMessage: string;
  dietaryPreference: string | null;
};

export type SmartCoachRefinementResult =
  | {
      type: "food";
      name: string;
      protein_100g: number;
      carbs_100g: number;
      fat_100g: number;
      kcal_100g: number;
      recommendedAmount: number;
      unitLabel?: string;
      message: string;
      ingredients: string[];
      instructions: string[];
      imagePrompt?: string;
    }
  | {
      type: "fallback";
      message: string;
    };

const FALLBACK_MSG =
  "No encontré algo exacto en tu historial, pero basándome en tus metas, ¿qué te parece intentar otra opción que se ajuste a lo que tienes?";

function parseSmartCoachResponse(text: string): SmartCoachRefinementResult {
  let raw = text.trim();
  // Quitar markdown si la IA envía ```json ... ``` o ```
  raw = raw.replace(/```json|```/g, "").trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) raw = jsonMatch[0].trim();
  const parsed = JSON.parse(raw) as any;

  if (parsed.type === "fallback") {
    return { type: "fallback", message: typeof parsed.message === "string" ? parsed.message : FALLBACK_MSG };
  }

  const ingredients = Array.isArray(parsed.ingredients)
    ? parsed.ingredients.filter((x: unknown) => typeof x === "string")
    : [];
  const instructions = Array.isArray(parsed.instructions)
    ? parsed.instructions.filter((x: unknown) => typeof x === "string")
    : [];

  return {
    type: "food",
    name: typeof parsed.name === "string" ? parsed.name : "Alternativa",
    protein_100g: Number(parsed.protein_100g) || 0,
    carbs_100g: Number(parsed.carbs_100g) || 0,
    fat_100g: Number(parsed.fat_100g) || 0,
    kcal_100g: Number(parsed.kcal_100g) || 0,
    recommendedAmount: Math.max(1, Math.round(Number(parsed.recommendedAmount) || 100)),
    unitLabel: typeof parsed.unitLabel === "string" ? parsed.unitLabel : undefined,
    message: typeof parsed.message === "string" ? parsed.message : "",
    ingredients,
    instructions,
    imagePrompt: typeof parsed.imagePrompt === "string" ? parsed.imagePrompt : undefined,
  };
}

/**
 * Pide a Gemini una alternativa de comida. Auto-recuperación: prueba 3 endpoints
 * (v1beta gemini-1.5-flash, v1beta gemini-pro, v1 gemini-1.5-flash) si hay 404.
 */
export async function askSmartCoach(
  context: SmartCoachRefinementContext
): Promise<SmartCoachRefinementResult> {
  const apiKey = API_KEY;
  if (!apiKey) return { type: "fallback", message: FALLBACK_MSG };

  // 1. Usamos el modelo 2.5 Flash que aparece en tus ajustes de AI Studio
  const URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const promptText = `
    Eres un Coach Nutricional Pro, motivador y enérgico.
    CONTEXTO: El usuario dice "${context.userMessage}" sobre la comida "${context.currentFoodName}".
    Déficit actual: ${context.calorieGap}kcal, ${context.proteinGap}g Proteína.
    TAREA: Sugiere una alternativa que encaje en sus macros y genera una receta breve.
    Usa ingredientes disponibles en Chile (supermercados, ferias, marcas locales).
    RESPUESTA: Devuelve ÚNICAMENTE un JSON con:
    type, name, protein_100g, carbs_100g, fat_100g, kcal_100g, recommendedAmount, message,
    ingredients (array de strings, ej: ["2 huevos", "100g de pollo"]),
    instructions (array de strings, pasos numerables de preparación),
    imagePrompt (opcional: string breve para describir el plato terminado).
    El campo message: máximo 3 frases cortas (para móvil). Usa frases como "¡Vamos máquina!" o "¡A darle con todo!".
  `;

  try {
    const response = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }]
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      // Si el 2.5 da cuota, el log nos dirá si es por saturación
      console.error("[geminiService] Error API con 2.5-flash:", data.error?.message);
      return { type: "fallback", message: "¡Estoy ajustando tu plan! Dame un segundo, campeón." };
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleanText = text.replace(/```json|```/g, "").trim();
    console.log("[geminiService] cleanText:", parseSmartCoachResponse(cleanText));
    // Usamos la función parse que ya tienes definida para asegurar consistencia
    return parseSmartCoachResponse(cleanText);
  } catch (err) {
    console.error("[geminiService] askSmartCoach error:", err);
    return { type: "fallback", message: FALLBACK_MSG };
  }
}