// src/domain/models/smartCoach.ts
/**
 * Tipo de recomendación del SmartCoach Pro
 */
export type SmartCoachRecommendation =
  | MacroRecommendation
  | CalorieRecommendation
  | ExerciseRecommendation;

/**
 * Recomendación para completar macros (ESCENARIO A)
 * Cuando faltan calorías Y faltan macros
 */
export type MacroRecommendation = {
  type: "macro";
  priorityMacro: "protein" | "carbs" | "fat";
  message: string;
  recommendedFood: {
    name: string;
    source: "history" | "generic" | "user_food";
    protein_100g: number;
    carbs_100g: number;
    fat_100g: number;
    kcal_100g: number;
    recommendedAmount: number; // Gramos o unidades recomendadas
    unitLabel?: string; // "gramos", "unidades", etc.
    lastEaten?: string;
    timesEaten?: number;
  };
  macroGaps: {
    protein: { gap: number; consumed: number; target: number };
    carbs: { gap: number; consumed: number; target: number };
    fat: { gap: number; consumed: number; target: number };
    calories: { gap: number; consumed: number; target: number };
  };
};

/**
 * Recomendación para completar calorías (ESCENARIO B)
 * Cuando faltan calorías pero macros están al día
 */
export type CalorieRecommendation = {
  type: "calorie";
  message: string;
  recommendedFood: {
    name: string;
    source: "history" | "generic" | "user_food";
    protein_100g: number;
    carbs_100g: number;
    fat_100g: number;
    kcal_100g: number;
    recommendedAmount: number;
    unitLabel?: string;
    lastEaten?: string;
    timesEaten?: number;
  };
  calorieGap: number;
};

/**
 * Recomendación de ejercicio (ESCENARIO C)
 * Cuando hay superávit calórico
 */
export type ExerciseRecommendation = {
  type: "exercise";
  message: string;
  exercises: {
    exercise: {
      id: string;
      name_es: string;
      met_value: number;
      icon_name: string | null;
    };
    minutesNeeded: number;
  }[];
  excessCalories: number;
  activityCaloriesBurned?: number; // Calorías ya quemadas desde Apple Health/Health Connect
  remainingExcess?: number; // Exceso restante después de restar actividad
};

export type SmartCoachState = {
  recommendation: SmartCoachRecommendation | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};
