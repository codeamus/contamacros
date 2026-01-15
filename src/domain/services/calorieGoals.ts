// src/domain/services/calorieGoals.ts
export type Gender = "male" | "female";

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "high"
  | "very_high";

export type GoalType = "deficit" | "maintenance" | "surplus";

/**
 * Factores de actividad (ver docs/calorie-goals.md)
 */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
  very_high: 1.9,
};

/**
 * Mifflin–St Jeor (ver docs/calorie-goals.md)
 */
export function calcBmr(params: {
  gender: Gender;
  weightKg: number;
  heightCm: number;
  ageYears: number;
}): number {
  const { gender, weightKg, heightCm, ageYears } = params;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return gender === "male" ? base + 5 : base - 161;
}

export function calcTdee(bmr: number, activityLevel: ActivityLevel): number {
  return bmr * ACTIVITY_FACTORS[activityLevel];
}

/**
 * Ajustes de objetivo (por defecto)
 * - deficit: -15%
 * - maintenance: 0%
 * - surplus: +10%
 */
export const DEFAULT_GOAL_ADJUSTMENT: Record<GoalType, number> = {
  deficit: -0.15,
  maintenance: 0,
  surplus: 0.1,
};

export function calcDailyTarget(params: {
  tdee: number;
  goalType: GoalType;
  goalAdjustment?: number; // opcional para premium / avanzado
}): number {
  const { tdee, goalType } = params;
  const adj =
    typeof params.goalAdjustment === "number"
      ? params.goalAdjustment
      : DEFAULT_GOAL_ADJUSTMENT[goalType];
  return tdee * (1 + adj);
}
