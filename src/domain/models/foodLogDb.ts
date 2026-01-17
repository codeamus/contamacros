export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type FoodLogDb = {
  id: string;
  user_id: string;

  day: string; // YYYY-MM-DD (local)
  meal: MealType;

  name: string;

  grams: number | null;
  source: string | null;
  off_id: string | null;

  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;

  created_at: string;
};
