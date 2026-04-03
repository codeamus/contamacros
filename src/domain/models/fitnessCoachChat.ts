// src/domain/models/fitnessCoachChat.ts
/**
 * Tipos para el sistema de chat conversacional de Fitness Coach Pro v2.
 * Incluye: mensajes, contexto de conversación, análisis semanal,
 * patrones de historial y respuestas del coach.
 */

// ─── Mensajes de Chat ───────────────────────────────────────────────
export type FitnessCoachChatMessage = {
  id: string;
  role: "user" | "coach";
  content: string;
  timestamp: Date;
  metadata?: ChatMessageMetadata;
};

export type ChatMessageMetadata = {
  /** Intención detectada del mensaje del usuario */
  intent?: ChatIntent;
  /** Snapshot de macros en el momento del mensaje */
  macrosAtTime?: MacroSnapshot;
  /** Si el coach recomendó algo, tipo de recomendación */
  recommendationType?: "food" | "exercise" | "plan" | "analysis";
};

/** Intenciones posibles detectadas en mensajes del usuario */
export type ChatIntent =
  | "ask_food"           // ¿Puedo comer X? / ¿Qué como?
  | "ask_exercise"       // ¿Qué ejercicio hago? / Me duele la rodilla
  | "ask_analysis"       // ¿Cómo voy? / ¿Voy bien?
  | "ask_replacement"    // Reemplazo de ejercicio o comida
  | "declare_excess"     // "Hoy tengo asado" / "Me voy a pasar"
  | "declare_skip"       // "Hoy no voy a entrenar" / "Me salté el desayuno"
  | "request_recipe"     // "Dame una receta" / "Quiero cocinar algo"
  | "request_plan"       // "Hazme un plan semanal"
  | "general_question"   // Pregunta informativa general
  | "greeting";          // Saludo

// ─── Snapshot de Macros ─────────────────────────────────────────────
export type MacroSnapshot = {
  calories: { consumed: number; target: number; gap: number };
  protein: { consumed: number; target: number; gap: number };
  carbs: { consumed: number; target: number; gap: number };
  fat: { consumed: number; target: number; gap: number };
};

// ─── Análisis Semanal ───────────────────────────────────────────────
export type WeeklyAnalysis = {
  /** Promedios diarios de los últimos 7 días */
  avgCalories: number;
  avgProtein: number;
  avgCarbs: number;
  avgFat: number;
  /** Porcentaje de días que estuvo dentro de ±10% del target */
  calorieConsistency: number;
  proteinConsistency: number;
  carbsConsistency: number;
  fatConsistency: number;
  /** Streak de días consecutivos con registros */
  streak: number;
  /** Top 5 alimentos más frecuentes (últimos 30 días) */
  topFoods: FoodFrequency[];
  /** Top 3 alimentos por comida del día */
  topFoodsByMeal: {
    breakfast: FoodFrequency[];
    lunch: FoodFrequency[];
    snack: FoodFrequency[];
    dinner: FoodFrequency[];
  };
  /** Datos diarios para gráficos */
  dailyData: DailySummary[];
  /** Proyección: ¿cumplirá su meta? */
  projection: GoalProjection;
};

export type FoodFrequency = {
  name: string;
  frequency: number;
  lastEaten: string;
  avgCalories: number;
  avgProtein: number;
  avgCarbs: number;
  avgFat: number;
};

export type DailySummary = {
  day: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealsLogged: number;
};

export type GoalProjection = {
  /** Si sigue así, ¿cumplirá meta en 7 días? */
  willMeetGoal: boolean;
  /** Confianza de la proyección (0-100) */
  confidence: number;
  /** Mensaje descriptivo */
  message: string;
  /** Ajustes sugeridos (ej: "Aumenta proteína en 15g/día") */
  suggestedAdjustments: string[];
};

// ─── Contexto de Conversación ───────────────────────────────────────
export type ConversationContext = {
  /** Perfil del usuario (nombre, objetivo, peso, preferencia dietética) */
  userGoal: "lose_weight" | "maintain" | "gain_weight";
  userName: string;
  weightKg: number;
  dietaryPreference: string;
  /** Macros actuales del día */
  currentMacros: MacroSnapshot;
  /** Análisis semanal (últimos 7 días) */
  weeklyAnalysis: WeeklyAnalysis | null;
  /** Alimentos favoritos del usuario (historial) */
  favoriteFoods: FoodFrequency[];
  /** Hora actual del día (para contexto de comidas) */
  timeOfDay: "morning" | "midday" | "afternoon" | "evening" | "night";
  /** Calorías quemadas hoy (Apple Health / Health Connect) */
  caloriesBurnedToday: number;
  /** ¿Es premium? */
  isPremium: boolean;
};

// ─── Guía de Ejercicios ─────────────────────────────────────────────
export type ExerciseGuide = {
  name: string;
  sets: string;
  reps: string;
  rir: number;
  rpe: number;
  muscleGroup: string;
  notes: string;
  alternatives: string[];
  sport?: "strength" | "crossfit" | "running" | "soccer" | "cycling" | "swimming" | "general";
};

// ─── Respuesta del Coach (extendida) ────────────────────────────────
export type CoachAnalysisResponse = {
  /** Análisis de si un alimento cabe en macros */
  fitsInMacros: boolean;
  /** Impacto en macros restantes */
  macrosAfter: MacroSnapshot;
  /** Advertencias (ej: "Estarás al límite de calorías") */
  warnings: string[];
  /** Sugerencias alternativas */
  alternatives: string[];
  /** Consejo para el resto del día */
  restOfDayAdvice: string;
};
