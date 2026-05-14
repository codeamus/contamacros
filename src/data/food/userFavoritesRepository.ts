// src/data/food/userFavoritesRepository.ts
import { supabase } from "@/data/supabase/supabaseClient";

export type UserFavoriteDb = {
  id: string;
  user_id: string;
  food_id: string | null;
  created_at: string;
  // Campos inline para productos escaneados (Option B)
  name: string | null;
  kcal_100g: number | null;
  protein_100g: number | null;
  carbs_100g: number | null;
  fat_100g: number | null;
  barcode: string | null;
  source: string | null;
};

export type ScannedFavoriteInput = {
  name: string;
  kcal_100g: number | null;
  protein_100g: number | null;
  carbs_100g: number | null;
  fat_100g: number | null;
  barcode?: string;
  source: string;
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
   * Obtiene todos los IDs favoritos del usuario (food_ids + barcodes para caché)
   */
  async getAll(): Promise<RepoResult<string[]>> {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes;

      const { data, error } = await supabase
        .from("user_favorites")
        .select("food_id, barcode")
        .eq("user_id", uidRes.data)
        .order("created_at", { ascending: false });

      if (error) return { ok: false, message: error.message, code: error.code };

      const ids = (data ?? []).map((fav) => fav.food_id ?? fav.barcode ?? "").filter(Boolean);
      return { ok: true, data: ids };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Error al obtener favoritos",
      };
    }
  },

  /**
   * Obtiene todos los favoritos con sus datos completos (para my-foods.tsx)
   */
  async getAllWithData(): Promise<RepoResult<UserFavoriteDb[]>> {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes;

      const { data, error } = await supabase
        .from("user_favorites")
        .select("id, user_id, food_id, created_at, name, kcal_100g, protein_100g, carbs_100g, fat_100g, barcode, source")
        .eq("user_id", uidRes.data)
        .order("created_at", { ascending: false });

      if (error) return { ok: false, message: error.message, code: error.code };
      return { ok: true, data: (data ?? []) as UserFavoriteDb[] };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Error al obtener favoritos",
      };
    }
  },

  /**
   * Verifica si un alimento es favorito (por food_id o barcode)
   */
  async isFavorite(identifier: string): Promise<RepoResult<boolean>> {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes;

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

      let query = supabase
        .from("user_favorites")
        .select("id")
        .eq("user_id", uidRes.data);

      if (isUuid) {
        query = query.eq("food_id", identifier);
      } else {
        query = query.eq("barcode", identifier);
      }

      const { data, error } = await query.maybeSingle();

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
   * Marca un alimento de generic_foods como favorito (por food_id)
   */
  async add(foodId: string): Promise<RepoResult<void>> {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes;

      const checkRes = await this.isFavorite(foodId);
      if (!checkRes.ok) return checkRes;
      if (checkRes.data) return { ok: true, data: undefined };

      const { error } = await supabase
        .from("user_favorites")
        .insert({
          user_id: uidRes.data,
          food_id: foodId,
          source: "generic_foods",
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
   * Marca un producto escaneado (OFF/AI) como favorito con datos inline
   */
  async addScanned(product: ScannedFavoriteInput): Promise<RepoResult<{ identifier: string }>> {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes;

      const identifier = product.barcode ?? product.name;

      const checkRes = await this.isFavorite(identifier);
      if (!checkRes.ok) return checkRes;
      if (checkRes.data) return { ok: true, data: { identifier } };

      const { error } = await supabase
        .from("user_favorites")
        .insert({
          user_id: uidRes.data,
          food_id: null,
          name: product.name,
          kcal_100g: product.kcal_100g,
          protein_100g: product.protein_100g,
          carbs_100g: product.carbs_100g,
          fat_100g: product.fat_100g,
          barcode: product.barcode ?? null,
          source: product.source,
        });

      if (error) return { ok: false, message: error.message, code: error.code };
      return { ok: true, data: { identifier } };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Error al agregar favorito",
      };
    }
  },

  /**
   * Elimina un favorito por food_id o barcode
   */
  async remove(identifier: string): Promise<RepoResult<void>> {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes;

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

      let query = supabase
        .from("user_favorites")
        .delete()
        .eq("user_id", uidRes.data);

      if (isUuid) {
        query = query.eq("food_id", identifier);
      } else {
        query = query.eq("barcode", identifier);
      }

      const { error } = await query;

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
   * @deprecated Usar getAllWithData en su lugar
   */
  async getFavoriteFoods(): Promise<RepoResult<Array<{ food_id: string; created_at: string }>>> {
    try {
      const uidRes = await getUid();
      if (!uidRes.ok) return uidRes;

      const { data, error } = await supabase
        .from("user_favorites")
        .select("food_id, created_at")
        .eq("user_id", uidRes.data)
        .not("food_id", "is", null)
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
