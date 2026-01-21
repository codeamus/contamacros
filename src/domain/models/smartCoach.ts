// src/domain/models/smartCoach.ts
import type { ExerciseDb } from "@/data/exercise/exercisesRepository";
import type { GenericFoodDb } from "@/data/food/genericFoodsRepository";

export type RecommendationType = "food" | "exercise";

export type FoodRecommendation = {
  type: "food";
  message: string;
  foods: GenericFoodDb[];
  remainingCalories: number;
};

export type ExerciseRecommendation = {
  type: "exercise";
  message: string;
  exercises: Array<{
    exercise: ExerciseDb;
    minutesNeeded: number;
  }>;
  excessCalories: number;
};

export type SmartCoachRecommendation = FoodRecommendation | ExerciseRecommendation;

export type SmartCoachState = {
  recommendation: SmartCoachRecommendation | null;
  loading: boolean;
  error: string | null;
};
