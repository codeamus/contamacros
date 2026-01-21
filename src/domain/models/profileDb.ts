// src/domain/models/profileDb.ts
export type GoalDb = "deficit" | "maintain" | "surplus";

export type GenderDb = "male" | "female";
export type ActivityLevelDb =
  | "sedentary"
  | "light"
  | "moderate"
  | "high"
  | "very_high";

export type ProfileDb = {
  id: string;
  email: string | null;

  full_name: string | null;
  height_cm: number | null;
  weight_kg: number | null;

  goal: GoalDb | null;
  onboarding_completed: boolean;
  gender: GenderDb | null;
  birth_date: string | null; // YYYY-MM-DD
  activity_level: ActivityLevelDb | null;

  goal_adjustment: number | null;
  daily_calorie_target: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  is_premium: boolean | null;
  created_at: string | null;
};
