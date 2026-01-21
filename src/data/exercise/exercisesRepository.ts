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
    const { data, error } = await supabase
      .from("exercises")
      .select("*")
      .order("name_es", { ascending: true });

    if (error) return { ok: false, message: error.message, code: error.code };
    return { ok: true, data: (data as ExerciseDb[]) ?? [] };
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
