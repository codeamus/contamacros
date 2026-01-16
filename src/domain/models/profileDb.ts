export type GoalDb = "deficit" | "maintain" | "surplus";

export type ProfileDb = {
  id: string;
  email: string | null;

  full_name: string | null;
  height_cm: number | null;
  weight_kg: number | null;

  goal: GoalDb | null;
  onboarding_completed: boolean;
  daily_calorie_target: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  created_at: string | null;
};
