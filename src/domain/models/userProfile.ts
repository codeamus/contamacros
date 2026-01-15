// src/domain/models/userProfile.ts
import type {
     ActivityLevel,
     Gender,
     GoalType,
} from "@/domain/services/calorieGoals";
import type { ThemeMode } from "@/presentation/theme/colors";

export type UserSubscription = {
  plan: "free" | "premium";
  provider?: "apple" | "google";
  expiresAt?: string; // ISO string
};

export type UserHealth = {
  appleHealthEnabled: boolean;
  lastSyncAt?: string; // ISO string
};

export type UserProfile = {
  id: string;
  email: string;
  createdAt: string; // ISO string

  gender: Gender;
  birthDate: string; // YYYY-MM-DD
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;

  goalType: GoalType;
  goalAdjustment: number; // -0.15 | 0 | +0.10 etc
  dailyCalorieTarget: number;

  units: "metric";
  theme: ThemeMode;

  subscription: UserSubscription;
  health: UserHealth;
};

export function isProfileComplete(
  p: Partial<UserProfile> | null | undefined
): p is UserProfile {
  if (!p) return false;
  return (
    typeof p.email === "string" &&
    typeof p.gender === "string" &&
    typeof p.birthDate === "string" &&
    typeof p.heightCm === "number" &&
    typeof p.weightKg === "number" &&
    typeof p.activityLevel === "string" &&
    typeof p.goalType === "string" &&
    typeof p.dailyCalorieTarget === "number"
  );
}
