// src/data/ai/geminiService.ts
// ⚠️ REVISAR XCODE: User Script Sandboxing debe estar en NO para que la cámara funcione

import { AppError, ErrorCode } from "@/core/errors/AppError";
import { supabase } from "@/data/supabase/supabaseClient";

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

/** Google Custom Search: CX para búsqueda de imágenes de recetas */
const GOOGLE_CSE_CX = "05886ff69208440f3";
const GOOGLE_CSE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_CSE_API_KEY || "";

/** Palabras a quitar del término para no obtener fotos de dieta/fitness */
const NOISE_WORDS = new Set([
  "proteico",
  "proteica",
  "saludable",
  "fit",
  "power",
  "integral",
  "bowl",
  "light",
  "diet",
  "bajo en calorias",
  "baja en calorias",
]);

/**
 * Refina el término de búsqueda para Google Images: platos chilenos reales y apetitosos.
 * - Churrasco → "churrasco italiano sandwich chileno"
 * - Completo → "completo italiano chileno"
 * - Resto: primeras 3 palabras (sin ruido) + "chilean food"
 */
function cleanSearchTerm(name: string, searchTerm: string): string {
  const n = (name ?? "").trim();
  const s = (searchTerm ?? "").trim();
  const combined = `${s} ${n}`.trim().toLowerCase() || "comida chilena";

  if (/churrasco/i.test(n)) return "churrasco italiano sandwich chileno";
  if (/completo/i.test(n)) return "completo italiano chileno";

  const words = combined
    .replace(/[^a-z0-9\sáéíóúüñ]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !NOISE_WORDS.has(w.toLowerCase()));

  const firstThree = words.slice(0, 3).join(" ");
  return firstThree ? `${firstThree} chilean food` : "chilean food";
}

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
      image_description?: string;
      image_search_term?: string;
    }
  | {
      type: "fallback";
      message: string;
    };

const FALLBACK_MSG =
  "No encontré algo exacto en tu historial, pero basándome en tus metas, ¿qué te parece intentar otra opción que se ajuste a lo que tienes?";

function cleanJsonString(s: string): string {
  return s
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/\\n/g, "[NL]")
    .replace(/\n/g, " ")
    .replace(/\r/g, " ")
    .replace(/\[NL\]/g, "\\n")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .trim();
}

function parseSmartCoachResponse(text: string): SmartCoachRefinementResult {
  const rawOriginal = text.trim();
  let raw = rawOriginal.replace(/```json|```/g, "").trim();
  console.log("Respuesta cruda de Gemini:", raw);

  let cleanJson = raw.match(/\{[\s\S]*\}/)?.[0] ?? raw;
  cleanJson = cleanJson
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/\\n/g, "[NL]")
    .replace(/\n/g, " ")
    .replace(/\r/g, " ")
    .replace(/\[NL\]/g, "\\n")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleanJson);
  } catch (firstErr) {
    cleanJson = cleanJsonString(cleanJson);
    try {
      parsed = JSON.parse(cleanJson);
    } catch (secondErr) {
      console.error("[geminiService] parseSmartCoachResponse falló. Raw original:", rawOriginal);
      return { type: "fallback", message: FALLBACK_MSG };
    }
  }

  // Si la IA puso type "fallback" pero devolvió nombre o ingredientes, tratarlo como comida
  if (parsed.type === "fallback" && (parsed.name != null || (Array.isArray(parsed.ingredients) && parsed.ingredients.length > 0))) {
    parsed.type = "food";
  }

  if (parsed.type === "fallback") {
    return { type: "fallback", message: typeof parsed.message === "string" ? parsed.message : FALLBACK_MSG };
  }

  const isFoodOrMeal = parsed.type === "food" || parsed.type === "meal";
  if (!isFoodOrMeal) {
    return { type: "fallback", message: FALLBACK_MSG };
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
    image_description: typeof parsed.image_description === "string" ? parsed.image_description : "",
    image_search_term: typeof parsed.image_search_term === "string" ? parsed.image_search_term : (typeof parsed.name === "string" ? parsed.name : "healthy food"),
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
    NUNCA digas que no encontraste algo. Si el usuario pide algo como "pizza", inventa una versión saludable (ej: masa de coliflor o integral) que encaje en sus macros. Sé creativo y resolutivo. Siempre devuelve una receta concreta (type: "food" o "meal"), nunca type "fallback".
    IMPORTANTE: Escribe ingredients e instructions SIEMPRE en ESPAÑOL. Usa ingredientes disponibles en Chile. El JSON SIEMPRE debe incluir los campos ingredients e instructions (arrays de strings).
    RESPUESTA: Devuelve ÚNICAMENTE un JSON con:
    type ("food" o "meal"), name, protein_100g, carbs_100g, fat_100g, kcal_100g, recommendedAmount, message,
    ingredients (array de strings en ESPAÑOL, ej: ["2 huevos", "100 g de pollo"]),
    instructions (array de strings en ESPAÑOL, pasos numerables de preparación),
    image_description (una frase corta, estética y apetitosa en ESPAÑOL, ej: "Un cremoso bowl de yogur griego con frutos rojos frescos y un toque de miel"),
    image_search_term (nombre del plato o descripción en INGLÉS para búsqueda de imagen, ej: "greek yogurt bowl berries honey").
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
    return parseSmartCoachResponse(cleanText);
  } catch (err) {
    console.error("[geminiService] askSmartCoach error:", err);
    return { type: "fallback", message: FALLBACK_MSG };
  }
}

/**
 * Obtiene una URL de imagen para una receta: primero desde caché (recipe_images_cache),
 * luego desde Google Custom Search, y guarda el resultado en caché.
 * @returns URL de la imagen o null si no hay resultados o falla la API (ej. 429).
 */
export async function getRecipeImage(
  name: string,
  searchTerm: string
): Promise<string | null> {
  const cleanTerm = cleanSearchTerm(name, searchTerm);
  const finalTerm = cleanTerm.toLowerCase().replace(/\s+/g, " ").trim();
  if (!finalTerm) return null;

  try {
    // PASO 1: Caché en Supabase
    const { data: cached } = await supabase
      .from("recipe_images_cache")
      .select("image_url")
      .eq("search_term", finalTerm)
      .maybeSingle();

    if (cached?.image_url) return cached.image_url;

    // PASO 2: API de Google Custom Search (q = término refinado + "tradicional")
    if (!GOOGLE_CSE_API_KEY) {
      console.warn("[geminiService] EXPO_PUBLIC_GOOGLE_CSE_API_KEY no configurada");
      return null;
    }

    const query = encodeURIComponent(`${cleanTerm} tradicional`);
    const apiUrl = `https://www.googleapis.com/customsearch/v1?q=${query}&searchType=image&key=${GOOGLE_CSE_API_KEY}&cx=${GOOGLE_CSE_CX}`;
    const response = await fetch(apiUrl);
    const json = (await response.json()) as {
      items?: Array<{ link?: string }>;
      error?: { code?: number; message?: string };
    };

    if (!response.ok) {
      console.error("[geminiService] Google CSE error:", response.status, json.error?.message);
      return null;
    }

    const firstLink = json.items?.[0]?.link;
    if (!firstLink) return null;

    // PASO 3: Guardar en caché para futuras consultas
    await supabase.from("recipe_images_cache").insert({
      search_term: finalTerm,
      image_url: firstLink,
    });

    return firstLink;
  } catch (err) {
    console.error("[geminiService] getRecipeImage error:", err);
    return null;
  }
}

/**
 * Vacía la caché de imágenes de recetas para forzar nuevas búsquedas (términos refinados).
 * Si RLS no permite delete: en SQL Editor de Supabase ejecutar: TRUNCATE recipe_images_cache;
 */
export async function clearRecipeImageCache(): Promise<void> {
  try {
    const { error } = await supabase
      .from("recipe_images_cache")
      .delete()
      .neq("search_term", "__never_match__");
    if (error) {
      console.warn("[geminiService] clearRecipeImageCache:", error.message);
    }
  } catch (err) {
    console.warn("[geminiService] clearRecipeImageCache error:", err);
  }
}