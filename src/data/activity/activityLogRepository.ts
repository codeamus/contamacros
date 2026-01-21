// src/data/activity/activityLogRepository.ts
import { supabase } from "@/data/supabase/supabaseClient";
import type { ActivityLogDb } from "@/domain/models/activityLogDb";

type RepoResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string };

function mapError(e: unknown): { message: string; code?: string } {
  if (e instanceof Error) return { message: e.message };
  return { message: "Error desconocido" };
}

async function getUid(): Promise<RepoResult<string>> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Usuario no autenticado" };
  return { ok: true, data: user.id };
}

export const activityLogRepository = {
  /**
   * Obtiene las calorías quemadas del día actual
   */
  async getTodayCalories(day: string): Promise<RepoResult<number>> {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes;
      const uid = uidRes.data;

      const { data, error } = await supabase
        .from("activity_logs")
        .select("calories_burned")
        .eq("user_id", uid)
        .eq("day", day)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        return { ok: false, message: error.message, code: error.code };
      }

      // Si no hay registro, retornar 0
      return { ok: true, data: data?.calories_burned ?? 0 };
    } catch (e) {
      return { ok: false, ...mapError(e) };
    }
  },

  /**
   * Crea o actualiza el registro de calorías del día
   */
  async upsertTodayCalories(
    day: string,
    caloriesBurned: number,
    source: "apple_health" | "health_connect" | "manual" = "manual",
  ): Promise<RepoResult<ActivityLogDb>> {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes;
      const uid = uidRes.data;

      const { data, error } = await supabase
        .from("activity_logs")
        .upsert(
          {
            user_id: uid,
            day,
            calories_burned: caloriesBurned,
            source,
            synced_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,day",
          },
        )
        .select("*")
        .maybeSingle();

      if (error) return { ok: false, message: error.message, code: error.code };
      if (!data)
        return { ok: false, message: "No se pudo crear/actualizar el registro." };

      return { ok: true, data: data as ActivityLogDb };
    } catch (e) {
      return { ok: false, ...mapError(e) };
    }
  },

  /**
   * Obtiene el historial de actividad de los últimos N días
   */
  async getRecentActivity(
    days: number = 7,
  ): Promise<RepoResult<ActivityLogDb[]>> {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes;
      const uid = uidRes.data;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("user_id", uid)
        .gte("day", startDateStr)
        .order("day", { ascending: false });

      if (error) return { ok: false, message: error.message, code: error.code };
      return { ok: true, data: (data as ActivityLogDb[]) ?? [] };
    } catch (e) {
      return { ok: false, ...mapError(e) };
    }
  },
};
