import { AppError, ErrorCode } from "@/core/errors/AppError";
import { Platform } from "react-native";
import { env } from "@/core/config/env";

const API_KEY = Platform.OS === "android"
  ? env.geminiApiKeyAndroid
  : env.geminiApiKeyIos;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

export type LabelReadResult = {
  productName: string | null;
  kcal_100g: number | null;
  protein_100g: number | null;
  carbs_100g: number | null;
  fat_100g: number | null;
  servingGrams: number | null;
};

const PROMPT = `Eres un lector experto de etiquetas nutricionales. Tu única tarea es leer la tabla nutricional visible en la imagen y extraer los valores EXACTOS.

REGLAS:
1. Si la tabla tiene columna "100g" o "por 100 gramos" → usa esos valores directamente.
2. Si la tabla solo tiene columna "por porción" → detecta el tamaño de porción en gramos y calcula: valor_100g = (valor_porción / gramos_porción) * 100.
3. Si hay ambas columnas → usa siempre la de 100g.
4. NO estimes ni inventes valores. Si no puedes leer un número claramente → ponlo como null.
5. Calorías: usa kcal (no kJ). Si solo aparecen kJ, convierte dividiendo por 4.184.

Responde ÚNICAMENTE con este JSON válido, sin texto adicional:
{
  "productName": "nombre del producto si aparece visible en la imagen, sino null",
  "kcal_100g": número o null,
  "protein_100g": número o null,
  "carbs_100g": número o null,
  "fat_100g": número o null,
  "servingGrams": número (tamaño de porción en gramos si aparece) o null
}`;

function parseLabelResponse(text: string): LabelReadResult {
  const clean = text.replace(/```json|```/g, "").trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Respuesta de IA inválida");
  const parsed = JSON.parse(match[0]) as Record<string, unknown>;

  const toNum = (v: unknown) => {
    const n = Number(v);
    return v != null && !isNaN(n) && n >= 0 ? n : null;
  };

  return {
    productName: typeof parsed.productName === "string" ? parsed.productName : null,
    kcal_100g: toNum(parsed.kcal_100g),
    protein_100g: toNum(parsed.protein_100g),
    carbs_100g: toNum(parsed.carbs_100g),
    fat_100g: toNum(parsed.fat_100g),
    servingGrams: toNum(parsed.servingGrams),
  };
}

export async function readNutritionLabel(base64Image: string): Promise<LabelReadResult> {
  if (!API_KEY) throw new AppError("API Key no configurada", ErrorCode.VALIDATION_ERROR);

  const normalized = base64Image.includes(",") ? base64Image.split(",")[1]! : base64Image;

  const payload = {
    contents: [{
      parts: [
        { text: PROMPT },
        { inlineData: { mimeType: "image/jpeg", data: normalized } },
      ],
    }],
  };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({})) as Record<string, unknown>;

  if (!response.ok) {
    if (response.status === 429) {
      throw new AppError("Límite de uso alcanzado. Reintenta en unos minutos.", ErrorCode.SERVER_ERROR);
    }
    const errMsg = (data as any)?.error?.message || `Error ${response.status}`;
    throw new AppError(errMsg, ErrorCode.SERVER_ERROR);
  }

  const text = (data as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("La IA no devolvió una respuesta válida");

  return parseLabelResponse(text);
}
