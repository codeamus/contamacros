// src/domain/models/activityLogDb.ts

/**
 * Registro de actividad física sincronizada desde Apple Health o Google Health Connect
 */
export type ActivityLogDb = {
  id: string;
  user_id: string;
  day: string; // YYYY-MM-DD (local)
  calories_burned: number; // Calorías quemadas en el día
  source: "apple_health" | "health_connect" | "manual";
  synced_at: string; // Timestamp de última sincronización
  created_at: string;
  updated_at: string;
};
