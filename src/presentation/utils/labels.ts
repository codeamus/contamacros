// src/presentation/utils/labels.ts
/**
 * Utilidades para labels y traducciones
 * Centraliza todos los textos de la UI
 */

import type { ActivityLevelDb, GoalDb } from "@/domain/models/profileDb";
import type { MealType } from "@/domain/models/foodLogDb";

/**
 * Labels para tipos de objetivos
 */
export function getGoalLabel(goal: string | null | undefined): string {
  if (!goal) return "—";
  
  switch (goal) {
    case "deficit":
    case "Déficit calórico":
      return "Déficit calórico";
    case "maintain":
    case "maintenance":
    case "Mantenimiento":
      return "Mantenimiento";
    case "surplus":
    case "Superávit calórico":
      return "Superávit calórico";
    default:
      return goal;
  }
}

/**
 * Labels para niveles de actividad
 */
export function getActivityLabel(
  level: ActivityLevelDb | string | null | undefined,
): string {
  if (!level) return "—";
  
  switch (level) {
    case "sedentary":
      return "Sedentario";
    case "light":
      return "Ligera";
    case "moderate":
      return "Moderada";
    case "high":
      return "Alta";
    case "very_high":
      return "Muy alta";
    default:
      return String(level);
  }
}

/**
 * Labels para géneros
 */
export function getGenderLabel(gender: string | null | undefined): string {
  if (!gender) return "—";
  
  switch (gender) {
    case "male":
      return "Masculino";
    case "female":
      return "Femenino";
    default:
      return String(gender);
  }
}

/**
 * Labels para comidas
 */
export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Desayuno",
  lunch: "Almuerzo",
  dinner: "Cena",
  snack: "Snack",
} as const;

/**
 * Obtiene el label de una comida
 */
export function getMealLabel(meal: MealType | string): string {
  return MEAL_LABELS[meal as MealType] || String(meal);
}
