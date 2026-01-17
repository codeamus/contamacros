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

    const q = norm(qRaw);

    const { data, error } = await supabase
      .from("generic_foods")
      .select(
        "id, name_es, name_norm, aliases_search, kcal_100g, protein_100g, carbs_100g, fat_100g, unit_label_es, grams_per_unit, created_at",
      )
      // ✅ busca por normalizados
      .or(`name_norm.ilike.%${q}%,aliases_search.ilike.%${q}%`)
      .order("created_at", { ascending: false })
      .limit(25);

    if (error) return { ok: false, message: error.message, code: error.code };
    return { ok: true, data: (data as GenericFoodDb[]) ?? [] };
  },
};
