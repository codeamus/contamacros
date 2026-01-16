// src/presentation/utils/mealLabels.ts
import type { MealType } from "@/domain/models/foodLogDb";

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Desayuno",
  lunch: "Almuerzo",
  dinner: "Cena",
  snack: "Snack",
};
