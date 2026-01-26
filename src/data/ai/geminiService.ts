// src/data/ai/geminiService.ts
// ⚠️ REVISAR XCODE: User Script Sandboxing debe estar en NO para que la cámara funcione
// Build Settings > Enable User Script Sandboxing = NO

import { AppError, ErrorCode } from "@/core/errors/AppError";

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

// Modelo primario: gemini-1.5-flash (costo-eficiente para producción)
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

// Flag para ejecutar listAvailableModels solo una vez por sesión
let didListModels = false;

/**
 * Lista los modelos disponibles en la API de Google
 * Función de autodescubrimiento para debugging
 * Se ejecuta solo una vez por sesión para evitar requests extra
 */
async function listAvailableModels(): Promise<void> {
  if (!API_KEY || didListModels) return;

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
      didListModels = true; // Marcar como ejecutado
    } else {
      console.warn("[geminiService] ⚠️ No se pudieron listar modelos:", data);
      didListModels = true; // Marcar como ejecutado incluso si falla para no reintentar
    }
  } catch (error) {
    console.warn("[geminiService] ⚠️ Error al listar modelos:", error);
    didListModels = true; // Marcar como ejecutado para no reintentar
  }
}

/**
 * Extrae el retryDelay en segundos del payload de error de Google
 * Busca en data.error.details el objeto con @type que contiene "google.rpc.RetryInfo"
 * y extrae el retryDelay (ej: "38s" -> 38)
 */
function parseRetryDelaySeconds(data: any): number | null {
  try {
    if (!data?.error?.details || !Array.isArray(data.error.details)) {
      return null;
    }

    // Buscar el objeto con @type que contiene RetryInfo
    const retryInfo = data.error.details.find(
      (detail: any) => detail["@type"]?.includes("google.rpc.RetryInfo")
    );

    if (!retryInfo?.retryDelay) {
      return null;
    }

    // retryDelay puede venir como "38s" o como objeto con seconds/nanos
    const retryDelay = retryInfo.retryDelay;
    
    if (typeof retryDelay === "string") {
      // Formato "38s" -> extraer número
      const match = retryDelay.match(/(\d+)/);
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
      return null;
    }
    
    if (typeof retryDelay === "object" && retryDelay.seconds) {
      // Formato { seconds: 38, nanos: 0 }
      return parseInt(retryDelay.seconds, 10);
    }

    return null;
  } catch (error) {
    console.warn("[geminiService] Error al parsear retryDelay:", error);
    return null;
  }
}

/**
 * Normaliza el string base64 eliminando el prefijo data:image si existe
 */
function normalizeBase64(base64: string): string {
  if (!base64) return base64;
  if (base64.includes(",")) {
    // Tiene prefijo data:image/...;base64,
    const parts = base64.split(",");
    return parts[1] || base64;
  }
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

  // Autodescubrimiento: listar modelos disponibles (solo en desarrollo, una vez por sesión)
  if (__DEV__) {
    await listAvailableModels();
  }

  // Normalizar base64 (eliminar prefijo data:image si existe)
  const normalizedBase64 = normalizeBase64(base64Image);

  // Cuerpo de la petición: solo 'contents' con 'parts' (text e inlineData)
  const payload = {
    contents: [{
      parts: [
        { 
          text: "Eres un nutricionista chileno. Analiza la imagen y responde SOLO JSON: { \"foodName\": string, \"calories\": number, \"protein\": number, \"carbs\": number, \"fats\": number, \"servingSize\": string }. Usa nombres de alimentos en español y términos chilenos (ej: 'Palta' no 'Aguacate', 'Zapallo italiano' no 'Calabacín', 'Marraqueta' en lugar de 'pan francés')." 
        },
        { 
          inlineData: { 
            mimeType: "image/jpeg", 
            data: normalizedBase64 
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
  const urlForLog = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY?.substring(0, 4)}...`;
  console.log(`[geminiService] 🎯 Usando modelo: gemini-1.5-flash (${urlForLog})`);

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

      // Manejar respuestas no-JSON
      let data: any;
      try {
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          data = await response.json();
        } else {
          const text = await response.text();
          console.warn("[geminiService] Respuesta no-JSON recibida:", text);
          data = { error: { message: "Respuesta no-JSON del servidor" } };
        }
      } catch (parseError) {
        console.error("[geminiService] Error al parsear respuesta:", parseError);
        data = { error: { message: "Error al procesar respuesta del servidor" } };
      }

      // Logs de debugging temporales
      console.log("[geminiService] status:", response?.status);
      console.log("[geminiService] data:", JSON.stringify(data, null, 2));

      if (response.ok) {
        console.log(`[geminiService] ✅ Éxito con gemini-1.5-flash`);
        return processApiResponse(data);
      }

      // Manejo de error 429 (RESOURCE_EXHAUSTED): retry con delay respetando retryDelay
      if (response.status === 429 || 
          data.error?.status === "RESOURCE_EXHAUSTED" ||
          data.error?.message?.includes("Quota exceeded") ||
          data.error?.message?.includes("quota")) {
        
        // Intentar extraer retryDelay del payload
        const retryDelaySeconds = parseRetryDelaySeconds(data);
        const waitTime = retryDelaySeconds ? (retryDelaySeconds + 1) * 1000 : 5000; // +1s de margen, default 5s
        
        if (attempt < maxRetries - 1) {
          console.warn(`[geminiService] ⚠️ Error 429: Esperando ${waitTime / 1000}s antes de reintentar... (retryDelay: ${retryDelaySeconds || "N/A"}s)`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        // Si ya se agotaron los reintentos, lanzar error con mensaje mejorado
        const retryMessage = retryDelaySeconds 
          ? `Límite de cuota alcanzado. Reintenta en ~${retryDelaySeconds}s. Si persiste, revisa billing/plan.`
          : "Límite de cuota alcanzado. Reintenta en unos momentos. Si persiste, revisa billing/plan.";
        
        console.log("[geminiService] status:", response?.status);
        console.log("[geminiService] data:", JSON.stringify(data, null, 2));
        throw new AppError(
          retryMessage,
          ErrorCode.SERVER_ERROR,
          data
        );
      }

      // Si es otro error, lanzarlo inmediatamente
      console.error("❌ Error de API:", JSON.stringify(data, null, 2));
      console.log("[geminiService] status:", response?.status);
      console.log("[geminiService] data:", JSON.stringify(data, null, 2));
      const errorMessage = data.error?.message || `Error ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);

    } catch (err: any) {
      lastError = err;
      
      // Logs de debugging temporales en catch
      console.log("[geminiService] catch - error:", err);
      if (err.response) {
        console.log("[geminiService] catch - response.status:", err.response?.status);
        console.log("[geminiService] catch - response.data:", JSON.stringify(err.response?.data, null, 2));
      }
      
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
        console.log("[geminiService] catch - lanzando AppError de red");
        throw new AppError(
          "Error de conexión. Verifica tu internet e intenta de nuevo.",
          ErrorCode.NETWORK_ERROR,
          err
        );
      }
      
      // Si es otro tipo de error, lanzarlo inmediatamente
      console.log("[geminiService] catch - lanzando error genérico");
      throw err;
    }
  }

  // Si todos los reintentos fallaron
  console.log("[geminiService] Todos los reintentos fallaron - lastError:", lastError);
  throw new AppError(
    `Error al analizar imagen: ${lastError?.message || "Error desconocido"}`,
    ErrorCode.SERVER_ERROR,
    lastError
  );
};
