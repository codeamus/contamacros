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
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }): Promise<RepoResult<FoodLogDb>> {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes;
      const uid = uidRes.data;

      const payload = { ...input, user_id: uid };

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
        .eq("user_id", uid) // ✅ evita que edites cosas de otro usuario (aunque RLS lo bloquee)
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
        .eq("user_id", uid); // ✅ igual que arriba

      if (error) return { ok: false, message: error.message, code: error.code };
      return { ok: true, data: true };
    } catch (e) {
      return { ok: false, ...mapError(e) };
    }
  },
};
