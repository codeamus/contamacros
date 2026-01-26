// src/data/food/userFavoritesRepository.ts
import { supabase } from "@/data/supabase/supabaseClient";

export type UserFavoriteDb = {
  id: string;
  user_id: string;
  food_id: string; // ID de generic_foods
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

export const userFavoritesRepository = {
  /**
   * Obtiene todos los favoritos del usuario
   */
  async getAll(): Promise<RepoResult<string[]>> {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes;

      const { data, error } = await supabase
        .from("user_favorites")
        .select("food_id")
        .eq("user_id", uidRes.data)
        .order("created_at", { ascending: false });

      if (error) return { ok: false, message: error.message, code: error.code };
      
      const foodIds = (data ?? []).map((fav) => fav.food_id);
      return { ok: true, data: foodIds };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Error al obtener favoritos",
      };
    }
  },

  /**
   * Verifica si un alimento es favorito
   */
  async isFavorite(foodId: string): Promise<RepoResult<boolean>> {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes;

      const { data, error } = await supabase
        .from("user_favorites")
        .select("id")
        .eq("user_id", uidRes.data)
        .eq("food_id", foodId)
        .maybeSingle();

      if (error) return { ok: false, message: error.message, code: error.code };
      return { ok: true, data: !!data };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Error al verificar favorito",
      };
    }
  },

  /**
   * Marca un alimento como favorito
   */
  async add(foodId: string): Promise<RepoResult<void>> {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes;

      // Verificar si ya existe
      const checkRes = await this.isFavorite(foodId);
      if (!checkRes.ok) return checkRes;
      if (checkRes.data) {
        // Ya es favorito, no hacer nada
        return { ok: true, data: undefined };
      }

      const { error } = await supabase
        .from("user_favorites")
        .insert({
          user_id: uidRes.data,
          food_id: foodId,
        });

      if (error) return { ok: false, message: error.message, code: error.code };
      return { ok: true, data: undefined };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Error al agregar favorito",
      };
    }
  },

  /**
   * Elimina un alimento de favoritos
   */
  async remove(foodId: string): Promise<RepoResult<void>> {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes;

      const { error } = await supabase
        .from("user_favorites")
        .delete()
        .eq("user_id", uidRes.data)
        .eq("food_id", foodId);

      if (error) return { ok: false, message: error.message, code: error.code };
      return { ok: true, data: undefined };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Error al eliminar favorito",
      };
    }
  },

  /**
   * Obtiene los alimentos favoritos con sus datos completos de generic_foods
   */
  async getFavoriteFoods(): Promise<RepoResult<Array<{ food_id: string; created_at: string }>>> {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes;

      const { data, error } = await supabase
        .from("user_favorites")
        .select("food_id, created_at")
        .eq("user_id", uidRes.data)
        .order("created_at", { ascending: false });

      if (error) return { ok: false, message: error.message, code: error.code };
      return { ok: true, data: (data ?? []) as Array<{ food_id: string; created_at: string }> };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Error al obtener alimentos favoritos",
      };
    }
  },
};
