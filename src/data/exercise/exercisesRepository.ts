// src/data/exercise/exercisesRepository.ts
import { supabase } from "@/data/supabase/supabaseClient";

export type ExerciseDb = {
  id: string;
  name_es: string;
  met_value: number;
  icon_name: string | null;
  category: string | null;
  created_at: string;
};

type RepoResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string };

export const exercisesRepository = {
  /**
   * Obtener todos los ejercicios disponibles
   */
  async listAll(): Promise<RepoResult<ExerciseDb[]>> {
    try {
      const { data, error, count } = await supabase
        .from("exercises")
        .select("*", { count: "exact" })
        .order("name_es", { ascending: true });

      console.log("[exercisesRepository] Query result - error:", error?.message, "data length:", data?.length, "count:", count);

      if (error) {
        console.log("[exercisesRepository] Error details:", { message: error.message, code: error.code, details: error.details, hint: error.hint });
        return { ok: false, message: error.message, code: error.code };
      }
      
      const exercises = (data as ExerciseDb[]) ?? [];
      console.log("[exercisesRepository] Returning exercises:", exercises.length, "first:", exercises[0]?.name_es);
      return { ok: true, data: exercises };
    } catch (e) {
      console.log("[exercisesRepository] Exception:", e);
      return { ok: false, message: e instanceof Error ? e.message : "Error desconocido" };
    }
  },

  /**
   * Obtener ejercicios aleatorios (útil para recomendaciones)
   */
  async getRandom(count: number = 2): Promise<RepoResult<ExerciseDb[]>> {
    const { data, error } = await supabase
      .from("exercises")
      .select("*")
      .order("name_es", { ascending: true });

    if (error) return { ok: false, message: error.message, code: error.code };
    
    const allExercises = (data as ExerciseDb[]) ?? [];
    // Seleccionar ejercicios aleatorios
    const shuffled = [...allExercises].sort(() => Math.random() - 0.5);
    return { ok: true, data: shuffled.slice(0, count) };
  },
};
