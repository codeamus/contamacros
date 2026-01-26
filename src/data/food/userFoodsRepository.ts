// src/data/food/userFoodsRepository.ts
import { supabase } from "@/data/supabase/supabaseClient";

export type UserFoodDb = {
  id: string;
  user_id: string;
  base_food_id: string | null;

  name: string;
  category: string;
  portion_unit: string;
  portion_base: number;

  calories: number;
  protein: number;
  carbs: number;
  fat: number;

  created_at: string;
};

type RepoResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string };

async function getUid(): Promise<RepoResult<string>> {
  const { data, error } = await supabase.auth.getSession();
  if (error) return { ok: false, message: error.message, code: error.code };
  const uid = data.session?.user?.id;
  if (!uid) return { ok: false, message: "No hay sesión activa." };
  return { ok: true, data: uid };
}

export const userFoodsRepository = {
  async search(query: string): Promise<RepoResult<UserFoodDb[]>> {
    const uidRes = await getUid();
    if (!uidRes.ok) return uidRes;

    const q = query.trim();
    if (q.length < 2) return { ok: true, data: [] };

    const { data, error } = await supabase
      .from("user_foods")
      .select("*")
      .eq("user_id", uidRes.data)
      .ilike("name", `%${q}%`)
      .order("created_at", { ascending: false })
      .limit(25);

    if (error) return { ok: false, message: error.message, code: error.code };
    return { ok: true, data: (data as UserFoodDb[]) ?? [] };
  },

  async listAll(): Promise<RepoResult<UserFoodDb[]>> {
    const uidRes = await getUid();
    if (!uidRes.ok) return uidRes;

    const { data, error } = await supabase
      .from("user_foods")
      .select("*")
      .eq("user_id", uidRes.data)
      .order("created_at", { ascending: false });

    if (error) return { ok: false, message: error.message, code: error.code };
    return { ok: true, data: (data as UserFoodDb[]) ?? [] };
  },

  async getById(id: string): Promise<RepoResult<UserFoodDb>> {
    const uidRes = await getUid();
    if (!uidRes.ok) return uidRes;

    const { data, error } = await supabase
      .from("user_foods")
      .select("*")
      .eq("id", id)
      .eq("user_id", uidRes.data)
      .maybeSingle();

    if (error) return { ok: false, message: error.message, code: error.code };
    if (!data) return { ok: false, message: "Alimento no encontrado" };
    return { ok: true, data: data as UserFoodDb };
  },

  async create(input: Omit<UserFoodDb, "id" | "user_id" | "created_at">) {
    const uidRes = await getUid();
    if (!uidRes.ok) return uidRes;

    const { data, error } = await supabase
      .from("user_foods")
      .insert({ user_id: uidRes.data, ...input })
      .select("*")
      .maybeSingle();

    if (error) return { ok: false, message: error.message, code: error.code };
    if (!data) return { ok: false, message: "No se pudo crear el alimento." };
    return { ok: true, data: data as UserFoodDb };
  },

  async remove(id: string): Promise<RepoResult<void>> {
    const uidRes = await getUid();
    if (!uidRes.ok) return uidRes;

    const { error } = await supabase
      .from("user_foods")
      .delete()
      .eq("id", id)
      .eq("user_id", uidRes.data);

    if (error) return { ok: false, message: error.message, code: error.code };
    return { ok: true, data: undefined };
  },

  /**
   * Obtiene todos los alimentos del usuario para búsqueda inteligente
   */
  async getAllForSmartSearch(): Promise<RepoResult<UserFoodDb[]>> {
    const uidRes = await getUid();
    if (!uidRes.ok) return uidRes;

    const { data, error } = await supabase
      .from("user_foods")
      .select("*")
      .eq("user_id", uidRes.data)
      .order("created_at", { ascending: false });

    if (error) return { ok: false, message: error.message, code: error.code };
    return { ok: true, data: (data as UserFoodDb[]) ?? [] };
  },
};
