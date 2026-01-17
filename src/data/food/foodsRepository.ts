// src/data/food/foodsRepository.ts
import { supabase } from "@/data/supabase/supabaseClient";

export type FoodDb = {
  id: string;

  name: string;
  category: string;
  portion_unit: string;
  portion_base: number;

  calories: number;
  protein: number;
  carbs: number;
  fat: number;

  barcode: string | null;
  brand: string | null;

  source: string;
  verified: boolean;
  country_scope: string;

  created_at: string;
};

type RepoResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string };

export const foodsRepository = {
  async search(query: string): Promise<RepoResult<FoodDb[]>> {
    const q = query.trim();
    if (q.length < 2) return { ok: true, data: [] };

    const { data, error } = await supabase
      .from("foods")
      .select("*")
      .ilike("name", `%${q}%`)
      .order("verified", { ascending: false })
      .limit(50);

    if (error) return { ok: false, message: error.message, code: error.code };
    return { ok: true, data: (data as FoodDb[]) ?? [] };
  },
};
