import { supabase } from "@/data/supabase/supabaseClient";

export type GenericFoodDb = {
  id: string;
  name_es: string;

  name_norm: string;
  aliases_search: string;

  kcal_100g: number | null;
  protein_100g: number | null;
  carbs_100g: number | null;
  fat_100g: number | null;

  unit_label_es: string | null;
  grams_per_unit: number | null;
  tags: string[];

  created_at: string;
};

type RepoResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string };

function norm(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita tildes
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const genericFoodsRepository = {
  async search(query: string): Promise<RepoResult<GenericFoodDb[]>> {
    const qRaw = query.trim();
    if (qRaw.length < 2) return { ok: true, data: [] };

    // Normalizar la query para quitar tildes y caracteres especiales
    // Esto es lo importante: SIEMPRE buscar con la versión normalizada
    // porque name_norm y aliases_search están normalizados en la DB
    const q = norm(qRaw);

    const { data, error } = await supabase
      .from("generic_foods")
      .select(
        "id, name_es, name_norm, aliases_search, kcal_100g, protein_100g, carbs_100g, fat_100g, unit_label_es, grams_per_unit, tags, created_at",
      )
      // Buscar SOLO en los campos normalizados (name_norm y aliases_search)
      // Estos campos ya tienen el texto sin tildes, por lo que funcionan
      // tanto si buscas "platano" como "plátano"
      .or(`name_norm.ilike.%${q}%,aliases_search.ilike.%${q}%`)
      .order("created_at", { ascending: false })
      .limit(25);

    if (error) return { ok: false, message: error.message, code: error.code };
    return { ok: true, data: (data as GenericFoodDb[]) ?? [] };
  },

  /**
   * Buscar alimentos por tags (ej: 'breakfast', 'protein', 'snack', 'fruit', 'dinner')
   * Retorna alimentos que tengan al menos uno de los tags especificados
   */
  async searchByTags(tags: string[], limit: number = 3): Promise<RepoResult<GenericFoodDb[]>> {
    if (!tags || tags.length === 0) return { ok: true, data: [] };

    // Obtener todos los alimentos y filtrar por tags en el cliente
    // Esto es más simple que usar operadores complejos de Supabase para arrays
    const { data, error } = await supabase
      .from("generic_foods")
      .select(
        "id, name_es, name_norm, aliases_search, kcal_100g, protein_100g, carbs_100g, fat_100g, unit_label_es, grams_per_unit, tags, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50); // Obtener más para filtrar después

    if (error) return { ok: false, message: error.message, code: error.code };
    
    // Filtrar en el cliente: alimentos que tengan al menos uno de los tags
    const filtered = (data as GenericFoodDb[] ?? []).filter((food) => {
      if (!food.tags || food.tags.length === 0) return false;
      return tags.some((tag) => 
        food.tags.some((foodTag) => 
          foodTag.toLowerCase() === tag.toLowerCase()
        )
      );
    });

    return { ok: true, data: filtered.slice(0, limit) };
  },
};
