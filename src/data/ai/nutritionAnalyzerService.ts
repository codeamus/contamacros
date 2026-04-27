// src/data/ai/nutritionAnalyzerService.ts

import { AppError, ErrorCode } from "@/core/errors/AppError";

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

export type NutritionAnalysisResult = {
  productName: string;
  healthScore: number;       // 0-10
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  servingSize: string;
  warnings: string[];        // ej. ["Alto en azúcar", "Ultra-procesado"]
  recommendation: string;    // Mensaje personalizado según metas del usuario
  fitsGoal: boolean;         // ¿Cabe en las kcal restantes de hoy?
};

export type UserNutritionContext = {
  remainingCalories: number;
  remainingProtein: number;
  remainingCarbs: number;
  remainingFat: number;
  dailyCalorieGoal: number;
};

function normalizeBase64(base64: string): string {
  if (!base64) return base64;
  if (base64.includes(",")) return base64.split(",")[1] || base64;
  return base64;
}

function parseAnalysisResponse(text: string): NutritionAnalysisResult {
  let clean = text.replace(/```json|```/g, "").trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (match) clean = match[0].trim();
  const parsed = JSON.parse(clean) as any;

  return {
    productName: parsed.productName || "Producto detectado",
    healthScore: Math.min(10, Math.max(0, Number(parsed.healthScore) || 5)),
    calories: Number(parsed.calories) || 0,
    protein: Number(parsed.protein) || 0,
    carbs: Number(parsed.carbs) || 0,
    fats: Number(parsed.fats) || 0,
    servingSize: parsed.servingSize || "1 porción",
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    recommendation: parsed.recommendation || "",
    fitsGoal: Boolean(parsed.fitsGoal),
  };
}

export async function analyzeProductNutrition(
  base64Image: string,
  userContext: UserNutritionContext
): Promise<NutritionAnalysisResult> {
  if (!API_KEY) throw new AppError("API Key no configurada", ErrorCode.VALIDATION_ERROR);

  const normalized = normalizeBase64(base64Image);

  const promptText = `Eres un nutricionista chileno experto en análisis de productos alimenticios. Tienes acceso a tu conocimiento de miles de productos del mercado chileno y latinoamericano.

Analiza la imagen del producto y responde ÚNICAMENTE con un JSON válido. La imagen puede mostrar: la tabla nutricional, el frente del packaging, o el código de barras.

REGLA CRÍTICA SOBRE MACROS:
- Si la tabla nutricional es visible en la imagen → lee los valores directamente
- Si solo ves el frente del packaging o el nombre → USA TU CONOCIMIENTO del producto para estimar los macros. NUNCA retornes 0 en calories, protein, carbs o fats si reconoces el producto. Un yogurt siempre tiene calorías, un pan siempre tiene carbohidratos, etc.
- Si no reconoces absolutamente nada → solo entonces retorna calories: 0

ESTRUCTURA JSON REQUERIDA (sin texto adicional, solo el JSON):
{
  "productName": "nombre exacto del producto",
  "healthScore": número entero del 0 al 10,
  "calories": número (kcal por porción típica del producto),
  "protein": número en gramos,
  "carbs": número en gramos,
  "fats": número en gramos,
  "servingSize": "porción típica (ej: 150g, 1 unidad 200ml)",
  "warnings": [],
  "recommendation": "2-3 oraciones personalizadas",
  "fitsGoal": true o false
}

CONTEXTO DEL USUARIO HOY:
- Calorías restantes: ${userContext.remainingCalories} kcal
- Proteína restante: ${userContext.remainingProtein}g
- Carbohidratos restantes: ${userContext.remainingCarbs}g
- Grasas restantes: ${userContext.remainingFat}g
- Meta calórica diaria: ${userContext.dailyCalorieGoal} kcal

CRITERIOS PARA healthScore — aplica estas reglas numéricas en orden, la primera que aplique define el rango base:

REGLAS POSITIVAS (suben el score):
- Proteína >= 10g/100g → base mínima de 7
- Proteína >= 10g/100g Y grasa total <= 3g/100g Y sin azúcar añadida → score debe ser 8 o 9
- Proteína >= 15g/100g Y grasa total <= 3g/100g Y sin azúcar añadida → score debe ser 9 o 10
- Ingrediente principal es vegetal, legumbre, huevo o lácteo sin procesar → +1 punto

REGLAS NEGATIVAS (bajan el score):
- Grasas trans > 0g → score máximo 4
- Azúcar añadida > 15g/porción → score máximo 4
- Azúcar añadida 10-15g/porción → score máximo 6
- Sodio > 800mg/porción → restar 1 punto
- Lista de ingredientes con más de 10 aditivos artificiales → score máximo 5

ESCALA GENERAL (cuando no aplican las reglas anteriores):
- 9-10: Excelente (yogurt proteico sin azúcar añadida, legumbres, huevo, fruta entera)
- 7-8: Muy bueno (leche, queso fresco, avena, pan integral real)
- 5-6: Aceptable (pan blanco, cereales sin azúcar, productos lácteos estándar)
- 3-4: Pobre (galletas, jugos con azúcar, embutidos procesados)
- 1-2: Malo (snacks ultra-procesados, bebidas azucaradas, dulces)
- 0: Dañino (grasas trans altas, sin valor nutricional)

EJEMPLOS CONCRETOS para calibrar:
- Yogurt proteico (12g prot/100g, 0.8g grasa, lactosa natural) → 8/10
- Leche entera → 7/10
- Pan marraqueta → 5/10
- Coca-Cola → 2/10
- Pechuga de pollo → 9/10
- Papas fritas de bolsa → 3/10

CRITERIOS PARA warnings (sé estricto, solo incluir si realmente se supera el umbral):
- "Alto en azúcar añadida" SOLO si contiene azúcar añadida (sacarosa, jarabe de maíz, etc.) Y supera 10g por porción. El azúcar natural de la fruta (fructosa) o la leche (lactosa) NO cuenta como alto en azúcar.
- "Alto en sodio" SOLO si supera 600mg por porción
- "Alto en grasas saturadas" SOLO si supera 5g por porción
- "Contiene grasas trans" SOLO si grasas trans > 0g
- "Ultra-procesado" SOLO si tiene lista larga de aditivos, colorantes, saborizantes artificiales
- "Bajo en proteínas" SOLO si tiene menos de 3g de proteína por porción y el producto se vende como nutritivo
- "Alto en calorías" SOLO si supera 400 kcal por porción

CRITERIOS PARA recommendation:
- Tono amigable, directo, sin alarmar innecesariamente
- Menciona si cabe en las metas del día
- Usa lenguaje chileno (palta, porotos, marraqueta, etc.)
- Máximo 2-3 oraciones`;

  const payload = {
    contents: [{
      parts: [
        { text: promptText },
        { inlineData: { mimeType: "image/jpeg", data: normalized } },
      ],
    }],
  };

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "x-goog-api-client": "expo-react-native/1.0",
  };

  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("La API no devolvió una respuesta válida");
        return parseAnalysisResponse(text);
      }

      if (response.status === 429 || data.error?.message?.toLowerCase().includes("quota")) {
        const wait = 6000;
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

  throw new AppError(
    `Error al analizar producto: ${lastError?.message}`,
    ErrorCode.SERVER_ERROR,
    lastError
  );
}
