// src/data/food/foodLogRepository.ts
import { supabase } from "@/data/supabase/supabaseClient";
import type { FoodLogDb, MealType } from "@/domain/models/foodLogDb";

type RepoResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string };

function mapError(e: unknown): { message: string; code?: string } {
  if (typeof e === "object" && e && "message" in e) {
    const msg = String((e as any).message);
    const code = (e as any).code ? String((e as any).code) : undefined;
    return { message: msg, code };
  }
  return { message: "Ocurrió un error inesperado." };
}

async function getUid(): Promise<RepoResult<string>> {
  const { data, error } = await supabase.auth.getSession();
  if (error) return { ok: false, message: error.message, code: error.code };
  const uid = data.session?.user?.id;
  if (!uid) return { ok: false, message: "No hay sesión activa." };
  return { ok: true, data: uid };
}

export const foodLogRepository = {
  async listByDay(day: string): Promise<RepoResult<FoodLogDb[]>> {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes;
      const uid = uidRes.data;

      const { data, error } = await supabase
        .from("food_logs")
        .select("*")
        .eq("user_id", uid)
        .eq("day", day)
        .order("created_at", { ascending: true });

      if (error) return { ok: false, message: error.message, code: error.code };
      return { ok: true, data: (data as FoodLogDb[]) ?? [] };
    } catch (e) {
      return { ok: false, ...mapError(e) };
    }
  },

  async create(input: {
    day: string;
    meal: MealType;

    name: string;
    grams?: number | null;

    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;

    source?: string | null;
    off_id?: string | null;

    source_type?: "food" | "user_food" | "manual" | null;
    food_id?: string | null;
    user_food_id?: string | null;
  }): Promise<RepoResult<FoodLogDb>> {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes;
      const uid = uidRes.data;

      const inferredSourceType =
        input.source_type ??
        (input.user_food_id ? "user_food" : input.food_id ? "food" : "manual");

      const payload = {
        day: input.day,
        meal: input.meal,

        name: input.name,
        grams: input.grams ?? null,

        calories: input.calories,
        protein_g: input.protein_g,
        carbs_g: input.carbs_g,
        fat_g: input.fat_g,

        source: input.source ?? null,
        off_id: input.off_id ?? null,

        source_type: inferredSourceType,
        food_id: input.food_id ?? null,
        user_food_id: input.user_food_id ?? null,

        user_id: uid,
      };

      if (payload.food_id && payload.user_food_id) {
        return {
          ok: false,
          message:
            "Registro inválido: no puede tener food_id y user_food_id a la vez.",
        };
      }

      const { data, error } = await supabase
        .from("food_logs")
        .insert(payload)
        .select("*")
        .maybeSingle();

      if (error) return { ok: false, message: error.message, code: error.code };
      if (!data) return { ok: false, message: "No se pudo crear el registro." };
      return { ok: true, data: data as FoodLogDb };
    } catch (e) {
      return { ok: false, ...mapError(e) };
    }
  },

  async update(
    id: string,
    input: Partial<
      Pick<
        FoodLogDb,
        "meal" | "name" | "calories" | "protein_g" | "carbs_g" | "fat_g"
      >
    >,
  ): Promise<RepoResult<FoodLogDb>> {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes;
      const uid = uidRes.data;

      const { data, error } = await supabase
        .from("food_logs")
        .update(input)
        .eq("id", id)
        .eq("user_id", uid)
        .select("*")
        .maybeSingle();

      if (error) return { ok: false, message: error.message, code: error.code };
      if (!data)
        return { ok: false, message: "No se pudo actualizar (sin filas)." };
      return { ok: true, data: data as FoodLogDb };
    } catch (e) {
      return { ok: false, ...mapError(e) };
    }
  },

  async remove(id: string): Promise<RepoResult<true>> {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes;
      const uid = uidRes.data;

      const { error } = await supabase
        .from("food_logs")
        .delete()
        .eq("id", id)
        .eq("user_id", uid);

      if (error) return { ok: false, message: error.message, code: error.code };
      return { ok: true, data: true };
    } catch (e) {
      return { ok: false, ...mapError(e) };
    }
  },

  /**
   * Obtiene resúmenes de calorías por día en un rango de fechas
   * Útil para el calendario
   */
  async getDailySummaries(
    startDate: string,
    endDate: string,
  ): Promise<RepoResult<{ day: string; calories: number }[]>> {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes;
      const uid = uidRes.data;

      const { data, error } = await supabase
        .from("food_logs")
        .select("day, calories")
        .eq("user_id", uid)
        .gte("day", startDate)
        .lte("day", endDate)
        .order("day", { ascending: true });

      if (error) return { ok: false, message: error.message, code: error.code };

      // Agrupar por día y sumar calorías
      const grouped = (data ?? []).reduce(
        (acc, log) => {
          const day = log.day as string;
          const calories = log.calories as number;
          acc[day] = (acc[day] || 0) + calories;
          return acc;
        },
        {} as Record<string, number>,
      );

      const summaries = Object.entries(grouped).map(([day, calories]) => ({
        day,
        calories,
      }));

      return { ok: true, data: summaries };
    } catch (e) {
      return { ok: false, ...mapError(e) };
    }
  },
};
