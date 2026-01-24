// src/data/ai/geminiService.ts
// ⚠️ REVISAR XCODE: User Script Sandboxing debe estar en NO para que la cámara funcione
// Build Settings > Enable User Script Sandboxing = NO

import { AppError, ErrorCode } from "@/core/errors/AppError";

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

// Modelo primario: gemini-2.0-flash (con facturación activada, ya no necesitamos fallbacks)
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

/**
 * Lista los modelos disponibles en la API de Google
 * Función de autodescubrimiento para debugging
 */
async function listAvailableModels(): Promise<void> {
  if (!API_KEY) return;

  try {
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
    console.log("[geminiService] 🔍 Consultando modelos disponibles...");
    
    const response = await fetch(listUrl);
    const data = await response.json();

    if (response.ok && data.models) {
      console.log("[geminiService] ✅ Modelos disponibles:");
      data.models.forEach((model: any) => {
        console.log(`  - ${model.name} (${model.displayName || "Sin nombre"})`);
      });
    } else {
      console.warn("[geminiService] ⚠️ No se pudieron listar modelos:", data);
    }
  } catch (error) {
    console.warn("[geminiService] ⚠️ Error al listar modelos:", error);
  }
}

export type MacroAnalysisResult = {
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  servingSize: string;
};

/**
 * Procesa la respuesta de la API y extrae el MacroAnalysisResult
 */
function processApiResponse(data: any): MacroAnalysisResult {
  const textResponse = data.candidates[0]?.content?.parts[0]?.text;
  
  if (!textResponse) {
    throw new Error("La API no devolvió una respuesta válida");
  }

  // Limpieza robusta del texto recibido
  let cleanJson = textResponse.replace(/```json|```/g, "").trim();

  // Extraer JSON usando regex para encontrar el contenido entre { }
  const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleanJson = jsonMatch[0].trim();
  }

  // Parsear JSON
  let parsed: any;
  try {
    parsed = JSON.parse(cleanJson);
  } catch (parseError) {
    console.error("[geminiService] Error al parsear JSON:", {
      original: textResponse,
      cleaned: cleanJson,
      error: parseError
    });
    throw new Error("No se pudo parsear la respuesta JSON de la IA");
  }

  // Validación de tipos: envolver valores en Number() para evitar strings
  return {
    foodName: parsed.foodName || "Alimento detectado",
    calories: Number(parsed.calories) || 0,
    protein: Number(parsed.protein) || 0,
    carbs: Number(parsed.carbs) || 0,
    fats: Number(parsed.fats) || 0,
    servingSize: parsed.servingSize || "1 porción"
  };
}

export const analyzeFoodImage = async (base64Image: string): Promise<MacroAnalysisResult> => {
  // Log de diagnóstico para verificar que el .env está cargando
  console.log("🔍 Verificando API Key:", API_KEY ? "Cargada ✅" : "VACÍA ❌");
  
  // Diagnóstico: primeros 4 caracteres para confirmar que Xcode lee el .env correcto
  console.log("🔑 Usando Key iniciando en:", API_KEY?.substring(0, 4) || "N/A");
  
  if (!API_KEY) {
    throw new AppError("API Key no configurada", ErrorCode.VALIDATION_ERROR);
  }

  // Autodescubrimiento: listar modelos disponibles (solo en desarrollo para no consumir tokens)
  if (__DEV__) {
    await listAvailableModels();
  }

  // Cuerpo de la petición: solo 'contents' con 'parts' (text e inlineData)
  const payload = {
    contents: [{
      parts: [
        { 
          text: "Analiza la imagen y responde ÚNICAMENTE con un JSON: { \"foodName\": string, \"calories\": number, \"protein\": number, \"carbs\": number, \"fats\": number, \"servingSize\": string }. No añadas explicaciones ni markdown." 
        },
        { 
          inlineData: { 
            mimeType: "image/jpeg", 
            data: base64Image 
          } 
        }
      ]
    }]
  };

  // Headers de control para la API de Google
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'x-goog-api-client': 'expo-react-native/1.0',
  };

  // Diagnóstico: imprimir URL final (sin la key completa)
  const urlForLog = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY?.substring(0, 4)}...`;
  console.log(`[geminiService] 🎯 Usando modelo: gemini-2.0-flash (${urlForLog})`);

  // Resiliencia: reintento automático en caso de error de red
  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[geminiService] 🔄 Reintentando... (intento ${attempt + 1}/${maxRetries})`);
      }

      const response = await fetch(API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        console.log(`[geminiService] ✅ Éxito con gemini-2.0-flash`);
        return processApiResponse(data);
      }

      // Manejo de error 429 (RESOURCE_EXHAUSTED): retry con delay
      if (response.status === 429 || 
          data.error?.status === "RESOURCE_EXHAUSTED" ||
          data.error?.message?.includes("Quota exceeded") ||
          data.error?.message?.includes("quota")) {
        if (attempt < maxRetries - 1) {
          console.warn("[geminiService] ⚠️ Error 429: Esperando 5 segundos antes de reintentar...");
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
        throw new AppError(
          "Configurando conexión con Google... Por favor, intenta escanear de nuevo en unos instantes.",
          ErrorCode.SERVER_ERROR,
          data
        );
      }

      // Si es otro error, lanzarlo inmediatamente
      console.error("❌ Error de API:", JSON.stringify(data, null, 2));
      const errorMessage = data.error?.message || `Error ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);

    } catch (err: any) {
      lastError = err;
      
      // Si es un error de red, reintentar
      if (err.message?.includes("Network") || 
          err.message?.includes("fetch") ||
          err.message?.includes("Failed to fetch") ||
          err.message?.includes("timeout")) {
        if (attempt < maxRetries - 1) {
          console.warn(`[geminiService] ⚠️ Error de red, reintentando en 2 segundos... (intento ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        throw new AppError(
          "Error de conexión. Verifica tu internet e intenta de nuevo.",
          ErrorCode.NETWORK_ERROR,
          err
        );
      }
      
      // Si es otro tipo de error, lanzarlo inmediatamente
      throw err;
    }
  }

  // Si todos los reintentos fallaron
  throw new AppError(
    `Error al analizar imagen: ${lastError?.message || "Error desconocido"}`,
    ErrorCode.SERVER_ERROR,
    lastError
  );
};
