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

export const foodLogRepository = {
  async listByDay(day: string): Promise<RepoResult<FoodLogDb[]>> {
    try {
      const { data: sdata, error: serr } = await supabase.auth.getSession();
      if (serr) return { ok: false, message: serr.message, code: serr.code };
      const uid = sdata.session?.user?.id;
      if (!uid) return { ok: false, message: "No hay sesión activa." };

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
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }): Promise<RepoResult<FoodLogDb>> {
    try {
      const { data: sdata, error: serr } = await supabase.auth.getSession();
      if (serr) return { ok: false, message: serr.message, code: serr.code };
      const uid = sdata.session?.user?.id;
      if (!uid) return { ok: false, message: "No hay sesión activa." };

      const payload = { ...input, user_id: uid };

      const { data, error } = await supabase
        .from("food_logs")
        .insert(payload)
        .select("*")
        .maybeSingle();

      if (error) return { ok: false, message: error.message, code: error.code };
      return { ok: true, data: data as FoodLogDb };
    } catch (e) {
      return { ok: false, ...mapError(e) };
    }
  },

  async remove(id: string): Promise<RepoResult<true>> {
    try {
      const { error } = await supabase.from("food_logs").delete().eq("id", id);
      if (error) return { ok: false, message: error.message, code: error.code };
      return { ok: true, data: true };
    } catch (e) {
      return { ok: false, ...mapError(e) };
    }
  },
};
