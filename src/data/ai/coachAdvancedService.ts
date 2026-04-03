// src/data/ai/coachAdvancedService.ts
/**
 * Fitness Coach Pro v2 — Servicio avanzado de Gemini.
 *
 * Extiende la funcionalidad de askSmartCoach (geminiService.ts) con:
 * - System prompt dinámico basado en contexto semanal y historial
 * - Conversación multi-turn con memoria de sesión
 * - Intent detection para respuestas más precisas
 * - Fallback robusto con parsing mejorado
 *
 * Reutiliza los tipos SmartCoachChatResponse, SmartCoachRecipe, etc.
 * del geminiService.ts original para mantener compatibilidad con la UI.
 */

import type { SmartCoachChatResponse, ChatMessage } from "./geminiService";
import type { ConversationContext } from "@/domain/models/fitnessCoachChat";
import { generateSystemPrompt } from "@/domain/services/coachContextBuilder";

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";

const FALLBACK_MSG =
  "Tuve un problema generando la respuesta. ¿Me lo repites y lo intento de nuevo al tiro?";

const INVALID_JSON_MSG =
  "Ups, la respuesta vino con un formato inválido. ¿Me la pides de nuevo?";

// ─── Fetch con timeout ──────────────────────────────────────────────

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

// ─── Parser de respuesta JSON del coach ─────────────────────────────

function parseCoachResponse(text: string): SmartCoachChatResponse {
  let cleanText = text
    .trim()
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  const jsonMatch = cleanText.match(/\{[\s\S]*\}/)?.[0] ?? cleanText;

  try {
    const parsed = JSON.parse(jsonMatch);

    // ── Recipe
    if (parsed.type === "recipe") {
      const r = parsed.recipe;
      if (!Array.isArray(r?.ingredients) || !Array.isArray(r?.instructions)) {
        return { type: "fallback", message: INVALID_JSON_MSG };
      }
      return {
        type: "recipe",
        message: parsed.message || "",
        recipe: {
          name: r.name || "Receta sugerida",
          protein_100g: Number(r.protein_100g) || 0,
          carbs_100g: Number(r.carbs_100g) || 0,
          fat_100g: Number(r.fat_100g) || 0,
          kcal_100g: Number(r.kcal_100g) || 0,
          recommendedAmount: Number(r.recommendedAmount) || 100,
          unitLabel: r.unitLabel,
          ingredients: r.ingredients,
          instructions: r.instructions,
          image_description: r.image_description,
          image_search_term: r.image_search_term || r.name,
        },
      };
    }

    // ── Plan
    if (parsed.type === "plan") {
      return {
        type: "plan",
        message: parsed.message || "",
        plan: {
          title: parsed.plan?.title || "Plan de comidas",
          type: parsed.plan?.type === "weekly" ? "weekly" : "daily",
          days: Array.isArray(parsed.plan?.days)
            ? parsed.plan.days.map((d: any) => ({
                dayName: d.dayName || d.dayLabel || "Hoy",
                meals: Array.isArray(d.meals)
                  ? d.meals.map((m: any) => ({
                      ...m,
                      timeSlot: m.timeSlot || m.time || "Colación",
                    }))
                  : [],
              }))
            : [{ dayName: "Hoy", meals: [] }],
        },
      };
    }

    // ── Text (default)
    return {
      type: "text",
      message: parsed.message || parsed.text || cleanText,
    };
  } catch {
    // Si no es JSON válido pero hay texto, devolver como text
    if (cleanText.length > 10 && !cleanText.startsWith("{")) {
      return { type: "text", message: cleanText };
    }
    return { type: "fallback", message: INVALID_JSON_MSG };
  }
}

// ─── Formateo del historial de chat ─────────────────────────────────

/**
 * Convierte el historial de mensajes a texto para el prompt.
 * Limita a los últimos N mensajes para no saturar tokens.
 */
function formatChatHistory(
  history: ChatMessage[],
  maxMessages: number = 10,
): string {
  if (history.length === 0) return "(Sin mensajes previos en esta sesión)";

  const recent = history.slice(-maxMessages);
  return recent
    .map((m) => {
      const role = m.role === "user" ? "Usuario" : "Coach";
      // Truncar mensajes largos del coach (recetas/planes)
      const content =
        m.content.length > 200
          ? m.content.slice(0, 200) + "..."
          : m.content;
      return `${role}: ${content}`;
    })
    .join("\n");
}

// ─── Servicio principal ─────────────────────────────────────────────

/**
 * Envía un mensaje al Fitness Coach Pro con contexto completo.
 *
 * A diferencia de askSmartCoach (geminiService.ts), esta función:
 * 1. Usa un system prompt dinámico generado por coachContextBuilder
 * 2. Incluye análisis semanal y alimentos favoritos en el contexto
 * 3. Tiene expertise en ejercicios (RIR, RPE, alternativas)
 * 4. Proyecta si el usuario va a cumplir su meta
 *
 * @param userMessage - Mensaje actual del usuario
 * @param context - ConversationContext completo (macros, historial, perfil)
 * @param history - Historial de mensajes de la sesión actual
 * @returns SmartCoachChatResponse compatible con la UI existente
 */
export async function askFitnessCoach(
  userMessage: string,
  context: ConversationContext,
  history: ChatMessage[] = [],
): Promise<SmartCoachChatResponse> {
  const apiKey = API_KEY;
  if (!apiKey) return { type: "fallback", message: "API Key no configurada" };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  // System prompt dinámico con todo el contexto
  const systemPrompt = generateSystemPrompt(context);

  // Historial de conversación resumido
  const historyText = formatChatHistory(history);

  // Prompt final que combina system + historial + mensaje actual
  const fullPrompt = `${systemPrompt}

HISTORIAL DE ESTA SESIÓN:
${historyText}

MENSAJE ACTUAL DEL USUARIO:
"${userMessage}"`;

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
        }),
      },
      25_000, // 25s timeout (más que los 20s del original, el prompt es más largo)
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
      console.error("[coachAdvancedService] askFitnessCoach non-ok:", {
        status: response.status,
        model: MODEL,
        apiMsg,
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
      console.error("[coachAdvancedService] Respuesta sin candidate text");
      return {
        type: "fallback",
        message: __DEV__
          ? "IA error: Respuesta sin texto (candidates vacíos)."
          : FALLBACK_MSG,
      };
    }

    return parseCoachResponse(text);
  } catch (err) {
    const name = String((err as any)?.name ?? "");
    if (name === "AbortError") {
      return {
        type: "fallback",
        message:
          "La IA se demoró más de la cuenta. ¿Me lo repites y lo intento de nuevo?",
      };
    }
    console.error("[coachAdvancedService] askFitnessCoach error:", err);
    return { type: "fallback", message: FALLBACK_MSG };
  }
}
