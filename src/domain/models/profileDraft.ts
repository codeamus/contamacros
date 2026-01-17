// src/domain/models/profileDraft.ts
import type {
     ActivityLevel,
     Gender,
     GoalType,
} from "@/domain/services/calorieGoals";

export type ProfileDraft = {
  gender: Gender;
  birthDate: string; // YYYY-MM-DD

  heightCm: number;
  weightKg: number;

  activityLevel: ActivityLevel;
  goalType: GoalType;

  goalAdjustment?: number; // opcional (premium)

  // preferencias
  theme: "light" | "dark" | "system";
};
