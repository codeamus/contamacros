// src/domain/services/coachContextBuilder.ts
/**
 * Construye el contexto completo de conversación para Fitness Coach Pro v2.
 * Arma el ConversationContext y genera el system prompt dinámico para Gemini.
 * Resume información inteligentemente para no saturar el token limit.
 */

import type {
  ConversationContext,
  MacroSnapshot,
  WeeklyAnalysis,
  FoodFrequency,
} from "@/domain/models/fitnessCoachChat";
import type { DietaryPreferenceDb } from "@/domain/models/profileDb";

// ─── Helpers ────────────────────────────────────────────────────────

/** Determina el momento del día basado en la hora actual */
function getTimeOfDay(): ConversationContext["timeOfDay"] {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 10) return "morning";
  if (hour >= 10 && hour < 13) return "midday";
  if (hour >= 13 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

/** Sugiere la comida del día según la hora */
function suggestMealByTime(
  timeOfDay: ConversationContext["timeOfDay"],
): string {
  switch (timeOfDay) {
    case "morning":
      return "Desayuno";
    case "midday":
      return "Almuerzo";
    case "afternoon":
      return "Once";
    case "evening":
      return "Cena";
    case "night":
      return "Snack nocturno";
  }
}

/** Mapea preferencia dietética a texto legible */
function dietLabel(pref: DietaryPreferenceDb | string | null): string {
  const map: Record<string, string> = {
    omnivore: "Omnívoro",
    flexitarian: "Flexitariano",
    pescatarian: "Pescatariano",
    vegetarian: "Vegetariano",
    vegan: "Vegano",
    paleo: "Paleo",
    keto: "Keto",
    gluten_free: "Sin gluten",
  };
  return map[pref ?? "omnivore"] ?? "Omnívoro";
}

/** Formatea top foods en texto resumido para el prompt */
function formatTopFoods(foods: FoodFrequency[], label: string): string {
  if (foods.length === 0) return "";
  const items = foods
    .slice(0, 3)
    .map(
      (f) =>
        `${f.name} (${f.frequency}x, ~${f.avgCalories}kcal, P:${f.avgProtein}g)`,
    )
    .join(", ");
  return `${label}: ${items}`;
}

// ─── Build Conversation Context ─────────────────────────────────────

export type BuildContextParams = {
  userName: string;
  userGoal: "lose_weight" | "maintain" | "gain_weight";
  weightKg: number;
  dietaryPreference: DietaryPreferenceDb | string | null;
  /** Macros consumidos hoy */
  consumed: { calories: number; protein: number; carbs: number; fat: number };
  /** Targets diarios */
  targets: { calories: number; protein: number; carbs: number; fat: number };
  /** Análisis semanal (puede ser null si no hay datos) */
  weeklyAnalysis: WeeklyAnalysis | null;
  /** Alimentos favoritos del historial */
  favoriteFoods: FoodFrequency[];
  /** Calorías quemadas hoy (Apple Health / Health Connect) */
  caloriesBurnedToday: number;
  /** ¿Usuario premium? */
  isPremium: boolean;
};

/**
 * Construye el ConversationContext completo a partir de datos del perfil,
 * macros del día y análisis semanal.
 */
export function buildConversationContext(
  params: BuildContextParams,
): ConversationContext {
  const {
    userName,
    userGoal,
    weightKg,
    dietaryPreference,
    consumed,
    targets,
    weeklyAnalysis,
    favoriteFoods,
    caloriesBurnedToday,
    isPremium,
  } = params;

  const currentMacros: MacroSnapshot = {
    calories: {
      consumed: consumed.calories,
      target: targets.calories,
      gap: targets.calories - consumed.calories,
    },
    protein: {
      consumed: consumed.protein,
      target: targets.protein,
      gap: targets.protein - consumed.protein,
    },
    carbs: {
      consumed: consumed.carbs,
      target: targets.carbs,
      gap: targets.carbs - consumed.carbs,
    },
    fat: {
      consumed: consumed.fat,
      target: targets.fat,
      gap: targets.fat - consumed.fat,
    },
  };

  return {
    userGoal,
    userName,
    weightKg,
    dietaryPreference: dietLabel(dietaryPreference),
    currentMacros,
    weeklyAnalysis,
    favoriteFoods,
    timeOfDay: getTimeOfDay(),
    caloriesBurnedToday,
    isPremium,
  };
}

// ─── Generate System Prompt ─────────────────────────────────────────

/**
 * Genera el system prompt dinámico para Gemini basado en el contexto
 * completo del usuario. Incluye: perfil, macros, historial, ejercicios,
 * análisis semanal y reglas de comportamiento.
 *
 * Optimizado para no exceder ~2000 tokens de contexto.
 */
export function generateSystemPrompt(
  ctx: ConversationContext,
): string {
  const { currentMacros: m, weeklyAnalysis: wa } = ctx;
  const timeOfDay = ctx.timeOfDay;
  const mealSuggestion = suggestMealByTime(timeOfDay);

  // ── Sección: Perfil del usuario
  const goalLabel =
    ctx.userGoal === "lose_weight"
      ? "BAJAR DE PESO"
      : ctx.userGoal === "gain_weight"
        ? "SUBIR DE PESO / GANAR MASA"
        : "MANTENER PESO";

  const profileSection = `
PERFIL DEL USUARIO:
${ctx.userName ? `- Nombre: ${ctx.userName}` : "- Nombre: (no definido — NO uses 'Usuario', dirígete directamente sin nombre)"}
- Objetivo: ${goalLabel}
- Peso actual: ${ctx.weightKg}kg
- Dieta: ${ctx.dietaryPreference}
- Hora actual: ${timeOfDay} → Próxima comida sugerida: ${mealSuggestion}
- Calorías quemadas hoy (actividad): ${ctx.caloriesBurnedToday} kcal`.trim();

  // ── Sección: Macros actuales
  const macrosSection = `
MACROS DE HOY:
- Consumido: ${m.calories.consumed} kcal (P: ${m.protein.consumed}g | C: ${m.carbs.consumed}g | F: ${m.fat.consumed}g)
- Target: ${m.calories.target} kcal (P: ${m.protein.target}g | C: ${m.carbs.target}g | F: ${m.fat.target}g)
- Restante: ${m.calories.gap} kcal (P: ${m.protein.gap}g | C: ${m.carbs.gap}g | F: ${m.fat.gap}g)
${m.calories.gap < 0 ? `⚠️ SUPERÁVIT: El usuario se pasó ${Math.abs(m.calories.gap)} kcal.` : ""}
${m.protein.gap > m.protein.target * 0.5 ? `⚠️ PROTEÍNA BAJA: Falta más del 50% del target de proteína.` : ""}`.trim();

  // ── Sección: Análisis semanal (solo si hay datos)
  let weeklySection = "";
  if (wa) {
    const topFoodsGlobal = formatTopFoods(wa.topFoods, "Top global");
    const topBreakfast = formatTopFoods(
      wa.topFoodsByMeal.breakfast,
      "Desayuno habitual",
    );
    const topLunch = formatTopFoods(wa.topFoodsByMeal.lunch, "Almuerzo habitual");
    const topDinner = formatTopFoods(
      wa.topFoodsByMeal.dinner,
      "Cena habitual",
    );

    weeklySection = `
ANÁLISIS ÚLTIMOS 7 DÍAS:
- Promedios: ${wa.avgCalories} kcal/día (P: ${wa.avgProtein}g | C: ${wa.avgCarbs}g | F: ${wa.avgFat}g)
- Consistencia: Calorías ${wa.calorieConsistency}% | Proteína ${wa.proteinConsistency}% | Carbs ${wa.carbsConsistency}% | Grasas ${wa.fatConsistency}%
- Streak: ${wa.streak} días consecutivos registrando
- Proyección: ${wa.projection.message}
${wa.projection.suggestedAdjustments.length > 0 ? `- Ajustes sugeridos: ${wa.projection.suggestedAdjustments.join(" | ")}` : ""}

ALIMENTOS FAVORITOS DEL USUARIO:
${topFoodsGlobal}
${topBreakfast}
${topLunch}
${topDinner}`.trim();
  }

  // ── Sección: Reglas según objetivo
  let goalRules = "";
  if (ctx.userGoal === "lose_weight") {
    goalRules = `
REGLAS PARA BAJAR DE PESO:
- Prioriza opciones bajas en calorías y altas en proteína (saciedad)
- Si hay superávit, sugiere compensación: ejercicio HOY o déficit mañana
- Sugiere más cardio/HIIT si se pasa de calorías
- Evita recomendar comidas densas en calorías innecesariamente
- Si pregunta "¿puedo comer X?", evalúa impacto en meta diaria y semanal`;
  } else if (ctx.userGoal === "gain_weight") {
    goalRules = `
REGLAS PARA SUBIR DE PESO:
- Prioriza opciones densas en calorías y proteína (masa muscular)
- Si hay déficit calórico grande, recomienda agregar calorías urgentemente
- Sugiere más strength training, menos cardio excesivo
- Recomienda snacks calóricos entre comidas si faltan muchas calorías
- Motiva a comer más si el usuario está por debajo de su target`;
  } else {
    goalRules = `
REGLAS PARA MANTENER PESO:
- Equilibra macros de forma consistente
- Si hay desviación >15%, sugiere ajuste suave sin alarma
- Prioriza variedad nutricional y adherencia al plan`;
  }

  // ── Prompt completo
  return `Eres Fitness Coach Pro, un agente de nutrición y fitness ultra-experto para usuarios chilenos. Eres conversacional, directo, motivador y técnico cuando toca.

${profileSection}

${macrosSection}

${weeklySection}

${goalRules}

EXPERTISE EN EJERCICIOS:
- Conoces RIR (Reps In Reserve), RPE (Rate of Perceived Exertion)
- Puedes recomendar alternativas a ejercicios si hay lesiones
- Multi-deporte: strength, crossfit, running, fútbol, ciclismo, natación
- Puedes crear rutinas semanales adaptadas al objetivo
- Si hay superávit calórico, proactivamente sugiere ejercicio específico (no genérico)

REGLAS DE LOCALIZACIÓN CHILENA:
- Vocabulario: "Palta", "Porotos", "Maní", "Durazno", "Choclo"
- Tiempos de comida: "Desayuno", "Colación", "Almuerzo", "Once", "Cena"
- Productos: Prioriza lo que se encuentra en Jumbo/Lider (Marraqueta, Quesillo, Jamón pavo, Jurel, etc.)
- Unidades: gramos (g) y mililitros (ml) exclusivamente
- Tono: Cercano como coach de gimnasio en Santiago. Usa "¡Dale!", "Súper", "Impeque" de forma natural y sutil

COMPORTAMIENTO:
1. SIEMPRE contextualiza según el objetivo del usuario (${goalLabel})
2. Si preguntan sobre comida: analiza si cabe en macros, proyecta impacto, ofrece alternativas
3. Si el usuario dice que se va a pasar (asado, salida), NO juzgues: da opciones de compensación
4. Recomienda PRIMERO alimentos del historial del usuario (confianza), luego alternativas nuevas
5. Si detectas que falta proteína, menciónalo proactivamente
6. En ejercicios: da sets, reps, RIR/RPE, alternativas para lesiones
7. Sé directo y conciso. No repitas info que el usuario ya sabe

FORMATO DE RESPUESTA (JSON):
IMPORTANT: Your response MUST be ONLY a valid JSON object. Do not include any introductory text, markdown code blocks, or explanations outside the JSON. Start with '{' and end with '}'.

Tipos de respuesta:
- "text": { "type": "text", "message": "Tu respuesta aquí" }
- "recipe": { "type": "recipe", "message": "Intro corta", "recipe": { "name": "...", "protein_100g": X, "carbs_100g": X, "fat_100g": X, "kcal_100g": X, "recommendedAmount": X, "ingredients": [...], "instructions": [...], "image_description": "...", "image_search_term": "..." } }
- "plan": { "type": "plan", "message": "Intro", "plan": { "title": "...", "type": "daily"|"weekly", "days": [{ "dayName": "...", "meals": [{ "timeSlot": "Desayuno"|"Colación"|"Almuerzo"|"Once"|"Cena", "name": "...", "description": "...", "calories": X, "protein": X, "carbs": X, "fat": X }] }] } }

DIETA DEL USUARIO: ${ctx.dietaryPreference}. Es OBLIGATORIO que todas las recetas, ingredientes y consejos respeten esta dieta. Si algo no encaja, ofrece versión adaptada automáticamente.`;
}
