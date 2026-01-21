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
      // Verificar estado de autenticación
      const { data: { user } } = await supabase.auth.getUser();
      console.log("[exercisesRepository] User authenticated:", !!user, "user_id:", user?.id);

      // Intentar consulta con count para verificar RLS
      const { data, error, count } = await supabase
        .from("exercises")
        .select("*", { count: "exact" })
        .order("name_es", { ascending: true });

      console.log("[exercisesRepository] Query result:", {
        error: error?.message,
        errorCode: error?.code,
        dataLength: data?.length ?? 0,
        count: count ?? 0,
        hasError: !!error,
      });

      if (error) {
        console.log("[exercisesRepository] Error details:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        
        // Si es un error de RLS o permisos, intentar sin autenticación
        if (error.code === "PGRST116" || error.message?.includes("permission") || error.message?.includes("RLS")) {
          console.log("[exercisesRepository] Posible problema de RLS, intentando consulta pública...");
          // La tabla exercises debería ser pública, pero si hay RLS, necesitamos verificar las políticas
        }
        
        return { ok: false, message: error.message, code: error.code };
      }
      
      const exercises = (data as ExerciseDb[]) ?? [];
      console.log("[exercisesRepository] Returning exercises:", exercises.length);
      
      if (exercises.length > 0) {
        console.log("[exercisesRepository] First exercise:", {
          id: exercises[0].id,
          name: exercises[0].name_es,
          met: exercises[0].met_value,
        });
      } else {
        console.log("[exercisesRepository] WARNING: Array vacío pero sin error. Posible problema de RLS o tabla vacía.");
      }
      
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
