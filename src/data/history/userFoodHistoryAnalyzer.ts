// src/data/history/userFoodHistoryAnalyzer.ts
/**
 * Analiza el historial de comidas del usuario para detectar patrones,
 * alimentos favoritos, consistencia y proyecciones.
 * Alimenta al Fitness Coach Pro con contexto inteligente.
 */

import { supabase } from "@/data/supabase/supabaseClient";
import type {
  DailySummary,
  FoodFrequency,
  GoalProjection,
  WeeklyAnalysis,
} from "@/domain/models/fitnessCoachChat";

// ─── Helpers ────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0] as string;
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0] as string;
}

async function getUid(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ─── Top Foods por Frecuencia ───────────────────────────────────────

/**
 * Detecta los alimentos más frecuentes del usuario en un rango de días.
 * Opcionalmente filtra por comida del día (breakfast, lunch, etc.)
 */
export async function detectFavoriteFoods(
  days: number = 30,
  mealFilter?: "breakfast" | "lunch" | "snack" | "dinner",
  limit: number = 5,
): Promise<FoodFrequency[]> {
  const uid = await getUid();
  if (!uid) return [];

  const startDate = daysAgo(days);

  let query = supabase
    .from("food_logs")
    .select("name, calories, protein_g, carbs_g, fat_g, day, meal")
    .eq("user_id", uid)
    .gte("day", startDate)
    .order("day", { ascending: false });

  if (mealFilter) {
    query = query.eq("meal", mealFilter);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  // Agrupar por nombre de alimento
  const grouped: Record<
    string,
    {
      frequency: number;
      lastEaten: string;
      totalCalories: number;
      totalProtein: number;
      totalCarbs: number;
      totalFat: number;
    }
  > = {};

  for (const log of data) {
    const name = (log.name as string) ?? "";
    if (!name) continue;
    const nameLower = name.toLowerCase().trim();

    if (!grouped[nameLower]) {
      grouped[nameLower] = {
        frequency: 0,
        lastEaten: log.day as string,
        totalCalories: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFat: 0,
      };
    }

    const entry = grouped[nameLower]!;
    entry.frequency += 1;
    entry.totalCalories += (log.calories as number) || 0;
    entry.totalProtein += (log.protein_g as number) || 0;
    entry.totalCarbs += (log.carbs_g as number) || 0;
    entry.totalFat += (log.fat_g as number) || 0;

    // Actualizar última vez comido
    if ((log.day as string) > entry.lastEaten) {
      entry.lastEaten = log.day as string;
    }
  }

  // Ordenar por frecuencia y devolver top N
  const sorted = Object.entries(grouped)
    .sort(([, a], [, b]) => b.frequency - a.frequency)
    .slice(0, limit)
    .map(([name, info]) => ({
      name,
      frequency: info.frequency,
      lastEaten: info.lastEaten,
      avgCalories: Math.round(info.totalCalories / info.frequency),
      avgProtein: Math.round(info.totalProtein / info.frequency),
      avgCarbs: Math.round(info.totalCarbs / info.frequency),
      avgFat: Math.round(info.totalFat / info.frequency),
    }));

  return sorted;
}

// ─── Resúmenes Diarios con Macros ───────────────────────────────────

/**
 * Obtiene resúmenes diarios de macros para un rango de días.
 * Incluye calorías, proteína, carbos, grasas y número de comidas.
 */
export async function getDailyMacroSummaries(
  days: number = 7,
): Promise<DailySummary[]> {
  const uid = await getUid();
  if (!uid) return [];

  const startDate = daysAgo(days);
  const endDate = todayStr();

  const { data, error } = await supabase
    .from("food_logs")
    .select("day, calories, protein_g, carbs_g, fat_g")
    .eq("user_id", uid)
    .gte("day", startDate)
    .lte("day", endDate)
    .order("day", { ascending: true });

  if (error || !data) return [];

  // Agrupar por día
  const grouped: Record<
    string,
    {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      mealsLogged: number;
    }
  > = {};

  for (const log of data) {
    const day = log.day as string;
    if (!grouped[day]) {
      grouped[day] = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        mealsLogged: 0,
      };
    }
    const entry = grouped[day]!;
    entry.calories += (log.calories as number) || 0;
    entry.protein += (log.protein_g as number) || 0;
    entry.carbs += (log.carbs_g as number) || 0;
    entry.fat += (log.fat_g as number) || 0;
    entry.mealsLogged += 1;
  }

  return Object.entries(grouped).map(([day, info]) => ({
    day,
    calories: Math.round(info.calories),
    protein: Math.round(info.protein),
    carbs: Math.round(info.carbs),
    fat: Math.round(info.fat),
    mealsLogged: info.mealsLogged,
  }));
}

// ─── Consistencia de Macros ─────────────────────────────────────────

/**
 * Calcula qué porcentaje de días el usuario estuvo dentro del ±10% del target.
 */
function calculateConsistency(
  dailyValues: number[],
  target: number,
): number {
  if (dailyValues.length === 0 || target <= 0) return 0;
  const tolerance = target * 0.1; // ±10%
  const withinRange = dailyValues.filter(
    (v) => v >= target - tolerance && v <= target + tolerance,
  ).length;
  return Math.round((withinRange / dailyValues.length) * 100);
}

// ─── Streak de Días Consecutivos ────────────────────────────────────

/**
 * Calcula cuántos días consecutivos (hasta hoy) el usuario ha registrado comidas.
 */
function calculateStreak(dailySummaries: DailySummary[]): number {
  if (dailySummaries.length === 0) return 0;

  // Ordenar de más reciente a más antiguo
  const sorted = [...dailySummaries].sort(
    (a, b) => new Date(b.day).getTime() - new Date(a.day).getTime(),
  );

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < sorted.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().split("T")[0];

    if (sorted[i]?.day === expectedStr && (sorted[i]?.mealsLogged ?? 0) > 0) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

// ─── Proyección de Meta ─────────────────────────────────────────────

/**
 * Proyecta si el usuario cumplirá su meta basándose en tendencias de 7 días.
 */
function calculateProjection(
  dailyData: DailySummary[],
  targets: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  },
  goal: "lose_weight" | "maintain" | "gain_weight",
): GoalProjection {
  if (dailyData.length < 3) {
    return {
      willMeetGoal: false,
      confidence: 0,
      message: "Necesito al menos 3 días de datos para hacer una proyección.",
      suggestedAdjustments: ["Sigue registrando tus comidas diariamente."],
    };
  }

  const avgCal = dailyData.reduce((s, d) => s + d.calories, 0) / dailyData.length;
  const avgProt = dailyData.reduce((s, d) => s + d.protein, 0) / dailyData.length;
  const avgCarbs = dailyData.reduce((s, d) => s + d.carbs, 0) / dailyData.length;
  const avgFat = dailyData.reduce((s, d) => s + d.fat, 0) / dailyData.length;

  const adjustments: string[] = [];
  let score = 0;
  const maxScore = 4;

  // Evaluar calorías
  const calDiff = avgCal - targets.calories;
  const calTolerance = targets.calories * 0.1;
  if (Math.abs(calDiff) <= calTolerance) {
    score++;
  } else if (goal === "lose_weight" && calDiff > calTolerance) {
    adjustments.push(
      `Reduce ${Math.round(calDiff - calTolerance)} kcal/día para cumplir tu meta.`,
    );
  } else if (goal === "gain_weight" && calDiff < -calTolerance) {
    adjustments.push(
      `Aumenta ${Math.round(Math.abs(calDiff) - calTolerance)} kcal/día para ganar peso.`,
    );
  } else {
    score += 0.5;
  }

  // Evaluar proteína
  const protDiff = avgProt - targets.protein;
  if (protDiff >= -5) {
    score++;
  } else {
    adjustments.push(
      `Agrega ${Math.round(Math.abs(protDiff))}g de proteína/día (ej: 1 huevo extra o 50g pechuga).`,
    );
  }

  // Evaluar carbos
  const carbDiff = avgCarbs - targets.carbs;
  if (Math.abs(carbDiff) <= targets.carbs * 0.15) {
    score++;
  } else if (carbDiff > 0) {
    adjustments.push(
      `Reduce carbohidratos en ${Math.round(carbDiff)}g/día.`,
    );
  } else {
    adjustments.push(
      `Aumenta carbohidratos en ${Math.round(Math.abs(carbDiff))}g/día.`,
    );
  }

  // Evaluar grasas
  const fatDiff = avgFat - targets.fat;
  if (Math.abs(fatDiff) <= targets.fat * 0.15) {
    score++;
  } else if (fatDiff > 0) {
    adjustments.push(
      `Reduce grasas en ${Math.round(fatDiff)}g/día.`,
    );
  }

  const confidence = Math.round((score / maxScore) * 100);
  const willMeetGoal = confidence >= 60;

  let message: string;
  if (confidence >= 80) {
    message =
      "Vas muy bien. A este ritmo, cumplirás tu meta sin problemas. ¡Sigue así!";
  } else if (confidence >= 60) {
    message =
      "Vas por buen camino, pero hay ajustes menores que te acercarán más a tu meta.";
  } else if (confidence >= 40) {
    message =
      "Necesitas algunos ajustes para cumplir tu meta. Aquí van mis sugerencias:";
  } else {
    message =
      "Estás lejos de tu meta actual. Vamos a reenfocar tu alimentación esta semana.";
  }

  if (adjustments.length === 0) {
    adjustments.push("¡Mantén el ritmo actual!");
  }

  return { willMeetGoal, confidence, message, suggestedAdjustments: adjustments };
}

// ─── Análisis Semanal Completo ──────────────────────────────────────

/**
 * Genera un análisis completo de los últimos 7 días del usuario.
 * Incluye: promedios, consistencia, streak, top foods, proyección.
 */
export async function generateWeeklyAnalysis(
  targets: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  },
  goal: "lose_weight" | "maintain" | "gain_weight",
): Promise<WeeklyAnalysis | null> {
  try {
    // Obtener datos diarios
    const dailyData = await getDailyMacroSummaries(7);
    if (dailyData.length === 0) return null;

    // Promedios
    const avgCalories =
      Math.round(dailyData.reduce((s, d) => s + d.calories, 0) / dailyData.length);
    const avgProtein =
      Math.round(dailyData.reduce((s, d) => s + d.protein, 0) / dailyData.length);
    const avgCarbs =
      Math.round(dailyData.reduce((s, d) => s + d.carbs, 0) / dailyData.length);
    const avgFat =
      Math.round(dailyData.reduce((s, d) => s + d.fat, 0) / dailyData.length);

    // Consistencia
    const calorieConsistency = calculateConsistency(
      dailyData.map((d) => d.calories),
      targets.calories,
    );
    const proteinConsistency = calculateConsistency(
      dailyData.map((d) => d.protein),
      targets.protein,
    );
    const carbsConsistency = calculateConsistency(
      dailyData.map((d) => d.carbs),
      targets.carbs,
    );
    const fatConsistency = calculateConsistency(
      dailyData.map((d) => d.fat),
      targets.fat,
    );

    // Streak
    const streak = calculateStreak(dailyData);

    // Top foods (últimos 30 días, global y por comida)
    const [topFoods, topBreakfast, topLunch, topSnack, topDinner] =
      await Promise.all([
        detectFavoriteFoods(30, undefined, 5),
        detectFavoriteFoods(30, "breakfast", 3),
        detectFavoriteFoods(30, "lunch", 3),
        detectFavoriteFoods(30, "snack", 3),
        detectFavoriteFoods(30, "dinner", 3),
      ]);

    // Proyección
    const projection = calculateProjection(dailyData, targets, goal);

    return {
      avgCalories,
      avgProtein,
      avgCarbs,
      avgFat,
      calorieConsistency,
      proteinConsistency,
      carbsConsistency,
      fatConsistency,
      streak,
      topFoods,
      topFoodsByMeal: {
        breakfast: topBreakfast,
        lunch: topLunch,
        snack: topSnack,
        dinner: topDinner,
      },
      dailyData,
      projection,
    };
  } catch (err) {
    console.error("[userFoodHistoryAnalyzer] Error:", err);
    return null;
  }
}
