// src/data/food/foodLogRepository.ts
import { supabase } from "@/data/supabase/supabaseClient";
import { GamificationService } from "@/domain/services/gamificationService";
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

  /**
   * Busca alimentos frecuentes del historial del usuario en los últimos 30 días
   * que sean altos en un macro específico
   */
  async findFrequentFoodsByMacro(
    macro: "protein" | "carbs" | "fat",
    limit: number = 5,
  ): Promise<
    RepoResult<
      Array<{
        name: string;
        protein_g: number;
        carbs_g: number;
        fat_g: number;
        calories: number;
        lastEaten: string;
        timesEaten: number;
      }>
    >
  > {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes;
      const uid = uidRes.data;

      // Calcular fecha hace 30 días
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

      // Buscar alimentos del historial
      const { data, error } = await supabase
        .from("food_logs")
        .select("name, protein_g, carbs_g, fat_g, calories, day, created_at")
        .eq("user_id", uid)
        .gte("day", thirtyDaysAgoStr)
        .order("day", { ascending: false });

      if (error) return { ok: false, message: error.message, code: error.code };

      // Agrupar por nombre y calcular frecuencia
      const foodMap = new Map<
        string,
        {
          name: string;
          protein_g: number;
          carbs_g: number;
          fat_g: number;
          calories: number;
          lastEaten: string;
          timesEaten: number;
          macroValue: number;
        }
      >();

      for (const log of data || []) {
        const name = log.name;
        const macroValue =
          macro === "protein"
            ? log.protein_g
            : macro === "carbs"
              ? log.carbs_g
              : log.fat_g;

        if (macroValue <= 0) continue; // Ignorar alimentos sin el macro

        const existing = foodMap.get(name);
        if (!existing) {
          // Calcular valores por 100g (asumiendo ~100g por porción promedio)
          foodMap.set(name, {
            name,
            protein_g: log.protein_g,
            carbs_g: log.carbs_g,
            fat_g: log.fat_g,
            calories: log.calories,
            lastEaten: log.day,
            timesEaten: 1,
            macroValue: macroValue,
          });
        } else {
          existing.timesEaten++;
          // Actualizar última vez que se comió (más reciente)
          if (log.day > existing.lastEaten) {
            existing.lastEaten = log.day;
            existing.protein_g = log.protein_g;
            existing.carbs_g = log.carbs_g;
            existing.fat_g = log.fat_g;
            existing.calories = log.calories;
            existing.macroValue = macroValue;
          }
        }
      }

      // Convertir a array y normalizar a valores por 100g
      // Asumimos una porción promedio de 100g para normalizar
      const foods = Array.from(foodMap.values())
        .map((food) => ({
          name: food.name,
          protein_100g: food.protein_g, // Ya está normalizado aproximadamente
          carbs_100g: food.carbs_g,
          fat_100g: food.fat_g,
          kcal_100g: food.calories,
          lastEaten: food.lastEaten,
          timesEaten: food.timesEaten,
        }))
        // Filtrar por macro relevante y ordenar por frecuencia y macro value
        .filter((food) => {
          const macroValue =
            macro === "protein"
              ? food.protein_100g
              : macro === "carbs"
                ? food.carbs_100g
                : food.fat_100g;
          return macroValue > 0;
        })
        .sort((a, b) => {
          const aMacro =
            macro === "protein"
              ? a.protein_100g
              : macro === "carbs"
                ? a.carbs_100g
                : a.fat_100g;
          const bMacro =
            macro === "protein"
              ? b.protein_100g
              : macro === "carbs"
                ? b.carbs_100g
                : b.fat_100g;

          // Priorizar frecuencia, luego valor del macro
          if (b.timesEaten !== a.timesEaten) {
            return b.timesEaten - a.timesEaten;
          }
          return bMacro - aMacro;
        })
        .slice(0, limit);

      return { ok: true, data: foods };
    } catch (e) {
      return { ok: false, ...mapError(e) };
    }
  },

  /**
   * Obtiene alimentos únicos del historial del usuario para búsqueda inteligente
   * Agrupa por nombre y toma los valores promedio de macros
   */
  async getUniqueFoodsFromHistory(limit: number = 50): Promise<
    RepoResult<
      Array<{
        name: string;
        protein_g: number;
        carbs_g: number;
        fat_g: number;
        calories: number;
        timesEaten: number;
        lastEaten: string;
      }>
    >
  > {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes;
      const uid = uidRes.data;

      // Calcular fecha hace 60 días para tener más opciones
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("food_logs")
        .select("name, protein_g, carbs_g, fat_g, calories, day")
        .eq("user_id", uid)
        .gte("day", sixtyDaysAgoStr)
        .order("day", { ascending: false });

      if (error) return { ok: false, message: error.message, code: error.code };

      // Agrupar por nombre y calcular promedios
      const foodMap = new Map<
        string,
        {
          name: string;
          protein_g: number[];
          carbs_g: number[];
          fat_g: number[];
          calories: number[];
          lastEaten: string;
          timesEaten: number;
        }
      >();

      for (const log of data || []) {
        const name = log.name;
        const existing = foodMap.get(name);
        if (!existing) {
          foodMap.set(name, {
            name,
            protein_g: [log.protein_g],
            carbs_g: [log.carbs_g],
            fat_g: [log.fat_g],
            calories: [log.calories],
            lastEaten: log.day,
            timesEaten: 1,
          });
        } else {
          existing.protein_g.push(log.protein_g);
          existing.carbs_g.push(log.carbs_g);
          existing.fat_g.push(log.fat_g);
          existing.calories.push(log.calories);
          existing.timesEaten++;
          if (log.day > existing.lastEaten) {
            existing.lastEaten = log.day;
          }
        }
      }

      // Calcular promedios y convertir a array
      const foods = Array.from(foodMap.values())
        .map((food) => {
          const avg = (arr: number[]) =>
            arr.reduce((sum, val) => sum + val, 0) / arr.length;
          return {
            name: food.name,
            protein_g: Math.round(avg(food.protein_g)),
            carbs_g: Math.round(avg(food.carbs_g)),
            fat_g: Math.round(avg(food.fat_g)),
            calories: Math.round(avg(food.calories)),
            timesEaten: food.timesEaten,
            lastEaten: food.lastEaten,
          };
        })
        .sort((a, b) => b.timesEaten - a.timesEaten)
        .slice(0, limit);

      return { ok: true, data: foods };
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

      // Verificar si es el primer registro del día para gamificación
      // Obtener todos los registros del día para verificar si es el primero
      const { data: todayLogs } = await supabase
        .from("food_logs")
        .select("id")
        .eq("user_id", uid)
        .eq("day", input.day)
        .order("created_at", { ascending: true })
        .limit(1);

      // Si este es el primer registro del día, añadir XP y actualizar racha
      if (todayLogs && todayLogs.length === 1) {
        await GamificationService.recordDailyLog(input.day).catch((error) => {
          console.warn("[foodLogRepository] Error al registrar log diario:", error);
          // No fallar si la gamificación falla
        });
      }

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
