// src/data/ai/geminiService.ts
// ⚠️ REVISAR XCODE: User Script Sandboxing debe estar en NO para que la cámara funcione

import { AppError, ErrorCode } from "@/core/errors/AppError";
import { supabase } from "@/data/supabase/supabaseClient";
import type { DietaryPreferenceDb } from "@/domain/models/profileDb";

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
  caloriesConsumed: number;
  proteinConsumed: number;
  carbsConsumed: number;
  fatConsumed: number;
  currentFoodName: string;
  currentMessage: string;
  userMessage: string;
  dietaryPreference: DietaryPreferenceDb | null;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  type?: "text" | "recipe" | "plan";
  data?: any;
};

export type SmartCoachRecipe = {
  name: string;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  kcal_100g: number;
  recommendedAmount: number;
  unitLabel?: string;
  ingredients: string[];
  instructions: string[];
  image_description?: string;
  image_search_term?: string;
};

export type SmartCoachMeal = {
  timeSlot: "Desayuno" | "Colación" | "Almuerzo" | "Once" | "Cena";
  name: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  recipe_data?: SmartCoachRecipe;
};

export type SmartCoachDayPlan = {
  dayName: string; // "Lunes", "Martes", etc.
  meals: SmartCoachMeal[];
};

export type SmartCoachMealPlan = {
  title: string;
  type: "daily" | "weekly";
  days: SmartCoachDayPlan[];
};

export type SmartCoachChatResponse =
  | { type: "text"; message: string }
  | { type: "recipe"; message: string; recipe: SmartCoachRecipe }
  | { type: "plan"; message: string; plan: SmartCoachMealPlan }
  | { type: "fallback"; message: string };

const FALLBACK_MSG =
  "Tuve un problema generando la respuesta. ¿Me lo repites y lo intento de nuevo al tiro?";

const INVALID_JSON_MSG =
  "Ups, la respuesta de la IA vino con un formato inválido y no pude interpretarla. ¿Me la pides de nuevo?";

function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(id),
  );
}

function parseSmartCoachResponse(text: string): SmartCoachChatResponse {
  const rawOriginal = text.trim();
  // Limpieza de Markdown (fences) antes de parsear
  let cleanText = rawOriginal.replace(/```json/g, "").replace(/```/g, "").trim();

  // Extraer solo lo que está entre llaves { ... } si la IA agrega texto extra
  const cleanJson = cleanText.match(/\{[\s\S]*\}/)?.[0] ?? cleanText;
  try {
    const parsed = JSON.parse(cleanJson);
    
    if (parsed.type === "recipe") {
      const ingredientsOk = Array.isArray(parsed?.recipe?.ingredients);
      const instructionsOk = Array.isArray(parsed?.recipe?.instructions);
      if (!ingredientsOk || !instructionsOk) {
        return { type: "fallback", message: INVALID_JSON_MSG };
      }
      return {
        type: "recipe",
        message: parsed.message || "",
        recipe: {
          name: parsed.recipe.name || "Receta sugerida",
          protein_100g: Number(parsed.recipe.protein_100g) || 0,
          carbs_100g: Number(parsed.recipe.carbs_100g) || 0,
          fat_100g: Number(parsed.recipe.fat_100g) || 0,
          kcal_100g: Number(parsed.recipe.kcal_100g) || 0,
          recommendedAmount: Number(parsed.recipe.recommendedAmount) || 100,
          unitLabel: parsed.recipe.unitLabel,
          ingredients: Array.isArray(parsed.recipe.ingredients) ? parsed.recipe.ingredients : [],
          instructions: Array.isArray(parsed.recipe.instructions) ? parsed.recipe.instructions : [],
          image_description: parsed.recipe.image_description,
          image_search_term: parsed.recipe.image_search_term || parsed.recipe.name,
        }
      };
    }

    if (parsed.type === "plan") {
      return {
        type: "plan",
        message: parsed.message || "",
        plan: {
          title: parsed.plan.title || "Plan de comidas",
          type: parsed.plan.type === "weekly" ? "weekly" : "daily",
          days: Array.isArray(parsed.plan.days) ? parsed.plan.days.map((d: any) => ({
            dayName: d.dayName || d.dayLabel || "Hoy",
            meals: Array.isArray(d.meals) ? d.meals.map((m: any) => ({
              ...m,
              timeSlot: m.timeSlot || m.time || "Colación"
            })) : []
          })) : [{ dayName: "Hoy", meals: [] }],
        }
      };
    }

    return {
      type: "text",
      message: parsed.message || parsed.text || cleanText
    };
  } catch (err) {
    console.error("[geminiService] parseSmartCoachResponse error:", err);
    console.error("DEBUG: Error al parsear JSON:", cleanText);
    return { type: "fallback", message: INVALID_JSON_MSG };
  }
}

export async function askSmartCoach(
  context: SmartCoachRefinementContext,
  history: ChatMessage[] = []
): Promise<SmartCoachChatResponse> {
  const apiKey = API_KEY;
  if (!apiKey) return { type: "fallback", message: "API Key no configurada" };

  // Mantener modelo estable
  const MODEL = "gemini-2.5-flash";
  const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  const historyText = history.map(m => `${m.role === 'user' ? 'Usuario' : 'Coach'}: ${m.content}`).join('\n');

  const diet = context.dietaryPreference ?? "omnivore";

  const promptText = `
    Eres un Nutricionista Pro. El perfil del usuario es ${diet}. Es ESTRICTAMENTE OBLIGATORIO que todas las recetas, ingredientes y consejos que des respeten esta dieta. Si el usuario pide algo que no encaja, ofrece la versión adaptada a su dieta automáticamente.

    IMPORTANT: Your response MUST be ONLY a valid JSON object. Do not include any introductory text, markdown code blocks, or explanations outside the JSON. Start your response with '{' and end with '}'.

    Actúa como un Coach de Salud CHILENO, optimista y técnico. Tu tono es cercano (como un coach de gimnasio en Santiago) usando expresiones sutiles como "¡Dale!", "Súper" o "Impeque" de forma natural.
    
    ESTADO ACTUAL DE MACROS (IMPORTANTE):
    - Consumido hoy: ${context.caloriesConsumed} kcal (P: ${context.proteinConsumed}g, C: ${context.carbsConsumed}g, F: ${context.fatConsumed}g)
    - Macros Restantes: ${context.calorieGap} kcal (P: ${context.proteinGap}g, C: ${context.carbsGap}g, F: ${context.fatGap}g)
    
    REGLAS DE LOCALIZACIÓN (CHILE):
    - Vocabulario: Usa "Palta", "Porotos", "Maní", "Durazno".
    - Tiempos de Comida (ESTRICTO): Usa "Desayuno", "Colación", "Almuerzo", "Once" y "Cena".
    - Alimentos sugeridos: Prioriza Lider/Jumbo (Marraqueta sin miga, Quesillo, Jamón pavo, Jurel, etc.).
    - Unidades: Usa estrictamente gramos (g) y mililitros (ml).

    HISTORIAL DE LA SESIÓN ACTUAL (NO considerar días anteriores):
    ${historyText}

    MENSAJE ACTUAL DEL USUARIO:
    "${context.userMessage}"

    REGLAS DE RESPUESTA (JSON ÚNICAMENTE):
    1. Eres plenamente consciente de los macros que le quedan al usuario para hoy. Si se ha pasado, ofrece soluciones constructivas con tu estilo chileno.
    2. Si el usuario pide comida o dice "no sé qué comer", responde type: "recipe".
    3. Si hace preguntas informativas o consejos, responde type: "text" (breve y motivador).
    4. Si pide un plan (día/semana), responde type: "plan" equilibrando macros restantes y usando alimentos locales.
    5. Idioma: ESPAÑOL CHILENO (excepto image_search_term en inglés).

    ESTRUCTURA DEL JSON:
    - Para "text": { "type": "text", "message": "Tu respuesta aquí" }
    - Para "recipe": { 
        "type": "recipe", 
        "message": "Intro corta", 
        "recipe": { 
          "name": "Nombre", "protein_100g": X, "carbs_100g": X, "fat_100g": X, "kcal_100g": X, "recommendedAmount": X,
          "ingredients": ["..."], "instructions": ["..."], "image_description": "...", "image_search_term": "..." 
        }
      }
    - Para "plan": {
        "type": "plan",
        "message": "Intro",
        "plan": {
          "title": "Título",
          "type": "daily" o "weekly",
          "days": [{
            "dayName": "Lunes",
            "meals": [{ "timeSlot": "Desayuno", "name": "...", "description": "...", "calories": X, "protein": X, "carbs": X, "fat": X }]
          }]
        }
      }
  `;

  try {
    const response = await fetchWithTimeout(
      URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
        }),
      },
      20_000,
    );

    const bodyText = await response.text().catch(() => "");
    let data: any = {};
    try {
      data = bodyText ? JSON.parse(bodyText) : {};
    } catch {
      data = { __nonJsonBody: bodyText };
    }

    if (!response.ok) {
      const apiMsg = String(data?.error?.message ?? "").trim();
      console.error("[geminiService] askSmartCoach non-ok:", {
        status: response.status,
        model: MODEL,
        apiMsg,
        data,
      });
      const debugMsg =
        apiMsg || (bodyText ? bodyText.slice(0, 240) : "Sin cuerpo de error");
      return {
        type: "fallback",
        message: __DEV__
          ? `IA error (${response.status}): ${debugMsg}`
          : FALLBACK_MSG,
      };
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!text) {
      console.error("[geminiService] Respuesta sin candidate text:", {
        status: response.status,
        model: MODEL,
        data,
      });
      return {
        type: "fallback",
        message: __DEV__
          ? "IA error: Respuesta sin texto (candidates vacíos)."
          : FALLBACK_MSG,
      };
    }
    return parseSmartCoachResponse(text);
  } catch (err) {
    const name = String((err as any)?.name ?? "");
    if (name === "AbortError") {
      return {
        type: "fallback",
        message:
          "La IA se demoró más de la cuenta. ¿Me lo repites y lo intento de nuevo?",
      };
    }
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
      items?: { link?: string }[];
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