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
          protein_g: food.protein_g,
          carbs_g: food.carbs_g,
          fat_g: food.fat_g,
          calories: food.calories,
          lastEaten: food.lastEaten,
          timesEaten: food.timesEaten,
        }))
        // Filtrar por macro relevante y ordenar por frecuencia y macro value
        .filter((food) => {
          const macroValue =
            macro === "protein"
              ? food.protein_g
              : macro === "carbs"
                ? food.carbs_g
                : food.fat_g;
          return macroValue > 0;
        })
        .sort((a, b) => {
          const aMacro =
            macro === "protein"
              ? a.protein_g
              : macro === "carbs"
                ? a.carbs_g
                : a.fat_g;
          const bMacro =
            macro === "protein"
              ? b.protein_g
              : macro === "carbs"
                ? b.carbs_g
                : b.fat_g;

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

      // Lógica de gamificación eliminada
      // (Anteriormente aquí se verificaba si era el primer registro del día)

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

  /**
   * Obtiene estadísticas para el dashboard de reportes (Bento Grid)
   * Incluye: calorías diarias, macros totales, top alimentos, consistencia
   */
  async getBentoStats(
    startDate: string,
    endDate: string,
  ): Promise<
    RepoResult<{
      dailyCalories: Array<{ day: string; calories: number }>;
      totalMacros: {
        protein_g: number;
        carbs_g: number;
        fat_g: number;
        totalCalories: number;
      };
      topFoods: Array<{
        name: string;
        totalCalories: number;
        timesEaten: number;
      }>;
      consistency: {
        daysWithLogs: number;
        totalDays: number;
        percentage: number;
      };
    }>
  > {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes;
      const uid = uidRes.data;

      // Obtener todos los logs en el rango
      const { data, error } = await supabase
        .from("food_logs")
        .select("day, calories, protein_g, carbs_g, fat_g, name")
        .eq("user_id", uid)
        .gte("day", startDate)
        .lte("day", endDate)
        .order("day", { ascending: true });

      if (error) return { ok: false, message: error.message, code: error.code };

      const logs = data ?? [];

      // 1. Calorías diarias agrupadas
      const dailyCaloriesMap = new Map<string, number>();
      for (const log of logs) {
        const day = log.day as string;
        const calories = (log.calories as number) || 0;
        dailyCaloriesMap.set(day, (dailyCaloriesMap.get(day) || 0) + calories);
      }

      const dailyCalories = Array.from(dailyCaloriesMap.entries())
        .map(([day, calories]) => ({ day, calories }))
        .sort((a, b) => a.day.localeCompare(b.day));

      // 2. Macros totales
      let totalProtein = 0;
      let totalCarbs = 0;
      let totalFat = 0;
      let totalCalories = 0;

      for (const log of logs) {
        totalProtein += (log.protein_g as number) || 0;
        totalCarbs += (log.carbs_g as number) || 0;
        totalFat += (log.fat_g as number) || 0;
        totalCalories += (log.calories as number) || 0;
      }

      // 3. Top alimentos (por calorías totales)
      const foodMap = new Map<
        string,
        { name: string; totalCalories: number; timesEaten: number }
      >();

      for (const log of logs) {
        const name = log.name as string;
        const calories = (log.calories as number) || 0;
        const existing = foodMap.get(name);
        if (!existing) {
          foodMap.set(name, {
            name,
            totalCalories: calories,
            timesEaten: 1,
          });
        } else {
          existing.totalCalories += calories;
          existing.timesEaten += 1;
        }
      }

      const topFoods = Array.from(foodMap.values())
        .sort((a, b) => b.totalCalories - a.totalCalories)
        .slice(0, 3);

      // 4. Consistencia (días con logs / días totales en rango)
      const daysWithLogs = new Set(logs.map((log) => log.day as string)).size;

      // Calcular días totales en el rango
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 para incluir ambos días

      const consistency = {
        daysWithLogs,
        totalDays: diffDays,
        percentage: diffDays > 0 ? Math.round((daysWithLogs / diffDays) * 100) : 0,
      };

      return {
        ok: true,
        data: {
          dailyCalories,
          totalMacros: {
            protein_g: Math.round(totalProtein * 10) / 10,
            carbs_g: Math.round(totalCarbs * 10) / 10,
            fat_g: Math.round(totalFat * 10) / 10,
            totalCalories: Math.round(totalCalories),
          },
          topFoods,
          consistency,
        },
      };
    } catch (e) {
      return { ok: false, ...mapError(e) };
    }
  },

  async createMany(
    logs: Array<{
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
    }>,
  ): Promise<RepoResult<FoodLogDb[]>> {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes as any;
      const uid = uidRes.data;

      const payloads = logs.map((input) => {
        const inferredSourceType =
          input.source_type ??
          (input.user_food_id
            ? "user_food"
            : input.food_id
              ? "food"
              : "manual");

        return {
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
      });

      const { data, error } = await supabase
        .from("food_logs")
        .insert(payloads)
        .select("*");

      if (error) return { ok: false, message: error.message, code: error.code };
      return { ok: true, data: (data as FoodLogDb[]) ?? [] };
    } catch (e) {
      return { ok: false, ...mapError(e) };
    }
  },
};
