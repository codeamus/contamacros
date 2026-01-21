import { supabase } from "@/data/supabase/supabaseClient";
import { GamificationService } from "@/domain/services/gamificationService";

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

  /**
   * Obtiene todos los alimentos genéricos para búsqueda inteligente
   */
  async getAllForSmartSearch(): Promise<RepoResult<GenericFoodDb[]>> {
    const { data, error } = await supabase
      .from("generic_foods")
      .select(
        "id, name_es, name_norm, aliases_search, kcal_100g, protein_100g, carbs_100g, fat_100g, unit_label_es, grams_per_unit, tags, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200); // Limitar para no sobrecargar

    if (error) return { ok: false, message: error.message, code: error.code };
    return { ok: true, data: (data as GenericFoodDb[]) ?? [] };
  },

  /**
   * Crea un nuevo alimento genérico (aporte comunitario)
   */
  async create(input: {
    name_es: string;
    portion_base: number;
    portion_unit: "gr" | "ml" | "unidad";
    protein_100g: number;
    carbs_100g: number;
    fat_100g: number;
    grams_per_unit?: number | null;
    unit_label_es?: string | null;
  }): Promise<RepoResult<GenericFoodDb>> {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;

      if (!userId) {
        return { ok: false, message: "No hay sesión activa." };
      }

      // Calcular calorías automáticamente
      const kcal_100g = input.protein_100g * 4 + input.carbs_100g * 4 + input.fat_100g * 9;

      // Normalizar nombre para búsqueda (igual que en seedFoods.ts)
      const name_norm = norm(input.name_es);
      const aliases: string[] = []; // Array vacío por defecto
      const aliases_norm: string[] = []; // Array vacío por defecto
      const aliases_search = name_norm; // Por ahora, usar el nombre normalizado como alias

      // Preparar datos para insertar (exactamente como en seedFoods.ts)
      const payload: any = {
        name_es: input.name_es.trim(),
        name_norm,
        aliases,
        aliases_norm,
        aliases_search,
        kcal_100g: Math.round(kcal_100g), // Redondear a entero como en seed
        protein_100g: Math.round(input.protein_100g * 10) / 10, // 1 decimal
        carbs_100g: Math.round(input.carbs_100g * 10) / 10, // 1 decimal
        fat_100g: Math.round(input.fat_100g * 10) / 10, // 1 decimal
        tags: [],
        country_tags: ["latam"], // Por defecto para alimentos comunitarios
      };

      // Si la unidad es "unidad", agregar grams_per_unit
      if (input.portion_unit === "unidad") {
        if (input.grams_per_unit && input.grams_per_unit > 0) {
          payload.grams_per_unit = input.grams_per_unit;
          payload.unit_label_es = input.unit_label_es || "1 unidad";
        } else {
          return {
            ok: false,
            message: "Debes especificar cuántos gramos pesa una unidad.",
          };
        }
      } else {
        // Para gr y ml, no necesitamos grams_per_unit
        payload.unit_label_es = input.portion_unit === "gr" ? "100 gramos" : "100 mililitros";
        payload.grams_per_unit = null;
      }

      const { data, error } = await supabase
        .from("generic_foods")
        .insert(payload)
        .select("*")
        .maybeSingle();

      if (error) {
        return { ok: false, message: error.message, code: error.code };
      }

      if (!data) {
        return { ok: false, message: "No se pudo crear el alimento." };
      }

      // Registrar aporte en gamificación (+50 XP)
      await GamificationService.recordFoodContribution().catch((error) => {
        console.warn("[genericFoodsRepository] Error al registrar aporte:", error);
        // No fallar si la gamificación falla
      });

      return { ok: true, data: data as GenericFoodDb };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Error al crear alimento",
      };
    }
  },
};
