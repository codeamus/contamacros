import { supabase } from "@/data/supabase/supabaseClient";

export type GenericFoodDb = {
  id: string;
  name_es: string;
  name_norm: string;
  aliases_search: string;
  /** Código de barras (EAN-13, UPC, etc.). Búsqueda local cuando no está en Open Food Facts. */
  barcode?: string | null;
  /** Unidad base: 'g' (gramos) o 'ml' (mililitros). Valores nutricionales por 100g o 100ml. */
  base_unit?: string | null;
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

/**
 * Normaliza el texto removiendo palabras conectoras comunes
 */
function normWithoutConnectors(s: string): string {
  const connectors = ["de", "con", "en", "para", "por", "a", "al", "del", "la", "el", "las", "los", "un", "una", "unos", "unas"];
  const normalized = norm(s);
  const words = normalized.split(/\s+/).filter(word => word.length > 0 && !connectors.includes(word));
  return words.join(" ");
}

/**
 * Calcula la distancia de Levenshtein entre dos strings
 * Retorna un valor entre 0 (idénticos) y max(str1.length, str2.length)
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Inicializar matriz
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Llenar matriz
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // eliminación
        matrix[i][j - 1] + 1,      // inserción
        matrix[i - 1][j - 1] + cost // sustitución
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calcula la similitud entre dos strings usando Levenshtein
 * Retorna un valor entre 0 (completamente diferentes) y 1 (idénticos)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1;
  return 1 - distance / maxLength;
}

export const genericFoodsRepository = {
  /**
   * Verifica si ya existe un alimento con un nombre similar (fuzzy search)
   * Retorna el alimento más similar si la similitud es > 80%
   */
  async checkDuplicate(normalizedName: string): Promise<RepoResult<{ food: GenericFoodDb; similarity: number } | null>> {
    try {
      // Normalizar el nombre sin conectores para comparación
      const normalizedWithoutConnectors = normWithoutConnectors(normalizedName);
      const normalized = norm(normalizedName);

      // Primero buscar coincidencia exacta (más rápido)
      const { data: exactMatch, error: exactError } = await supabase
        .from("generic_foods")
        .select("id, name_es, name_norm")
        .eq("name_norm", normalized)
        .maybeSingle();

      if (exactError && exactError.code !== "PGRST116") {
        return { ok: false, message: exactError.message, code: exactError.code };
      }

      if (exactMatch) {
        return { ok: true, data: { food: exactMatch as GenericFoodDb, similarity: 1.0 } };
      }

      // Si no hay coincidencia exacta, buscar alimentos similares
      // Obtener un conjunto de alimentos para comparar (limitar a 100 para no sobrecargar)
      const { data: allFoods, error: searchError } = await supabase
        .from("generic_foods")
        .select("id, name_es, name_norm")
        .limit(200); // Obtener más alimentos para comparar

      if (searchError) {
        return { ok: false, message: searchError.message, code: searchError.code };
      }

      if (!allFoods || allFoods.length === 0) {
        return { ok: true, data: null };
      }

      // Calcular similitud con cada alimento
      let bestMatch: { food: GenericFoodDb; similarity: number } | null = null;
      const threshold = 0.8; // 80% de similitud

      for (const food of allFoods) {
        const foodNormalized = norm(food.name_es);
        const foodNormalizedWithoutConnectors = normWithoutConnectors(food.name_es);

        // Comparar ambas versiones (con y sin conectores)
        const similarity1 = calculateSimilarity(normalized, foodNormalized);
        const similarity2 = calculateSimilarity(normalizedWithoutConnectors, foodNormalizedWithoutConnectors);
        
        // Usar la mayor similitud
        const similarity = Math.max(similarity1, similarity2);

        if (similarity >= threshold) {
          if (!bestMatch || similarity > bestMatch.similarity) {
            bestMatch = {
              food: food as GenericFoodDb,
              similarity,
            };
          }
        }
      }

      return { ok: true, data: bestMatch };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Error al verificar duplicados",
      };
    }
  },

  /**
   * Busca un alimento por código de barras en generic_foods (prioridad local tras OFF).
   */
  async getByBarcode(barcode: string): Promise<RepoResult<GenericFoodDb | null>> {
    const code = barcode.trim();
    if (!code) return { ok: true, data: null };

    const { data, error } = await supabase
      .from("generic_foods")
      .select(
        "id, name_es, name_norm, aliases_search, barcode, base_unit, kcal_100g, protein_100g, carbs_100g, fat_100g, unit_label_es, grams_per_unit, tags, created_at",
      )
      .eq("barcode", code)
      .maybeSingle();

    if (error) return { ok: false, message: error.message, code: error.code };
    return { ok: true, data: (data as GenericFoodDb | null) ?? null };
  },

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
        "id, name_es, name_norm, aliases_search, barcode, base_unit, kcal_100g, protein_100g, carbs_100g, fat_100g, unit_label_es, grams_per_unit, tags, created_at",
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
        "id, name_es, name_norm, aliases_search, barcode, base_unit, kcal_100g, protein_100g, carbs_100g, fat_100g, unit_label_es, grams_per_unit, tags, created_at",
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
        "id, name_es, name_norm, aliases_search, barcode, base_unit, kcal_100g, protein_100g, carbs_100g, fat_100g, unit_label_es, grams_per_unit, tags, created_at",
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

      // Registro de aporte en gamificación eliminado

      return { ok: true, data: data as GenericFoodDb };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Error al crear alimento",
      };
    }
  },

  /**
   * Crea un alimento genérico desde búsqueda por código de barras (no encontrado en OFF ni local).
   * Valores por 100g o 100ml según base_unit; unit_label_es se deriva de base_unit.
   */
  async createByBarcode(input: {
    name_es: string;
    barcode: string;
    base_unit: "g" | "ml";
    kcal_100g: number;
    protein_100g: number;
    carbs_100g: number;
    fat_100g: number;
    // Campos opcionales para unidades (ej: 1 huevo = 50g)
    grams_per_unit?: number;
    unit_label_es?: string;
  }): Promise<RepoResult<GenericFoodDb>> {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;

      if (!userId) {
        return { ok: false, message: "No hay sesión activa." };
      }

      const name_norm = norm(input.name_es.trim());
      const aliases: string[] = [];
      const aliases_norm: string[] = [];
      const aliases_search = name_norm;
      const barcode = input.barcode.trim();
      if (!barcode) {
        return { ok: false, message: "El código de barras es obligatorio." };
      }

      // Determinar etiquetas y unidades
      let unitLabel = input.base_unit === "ml" ? "100 mililitros" : "100 gramos";
      let gramsPerUnit: number | null = null;

      if (input.grams_per_unit && input.grams_per_unit > 0) {
          gramsPerUnit = input.grams_per_unit;
          unitLabel = input.unit_label_es || "1 unidad";
      }

      const payload: Record<string, unknown> = {
        name_es: input.name_es.trim(),
        name_norm,
        aliases,
        aliases_norm,
        aliases_search,
        barcode,
        base_unit: input.base_unit,
        kcal_100g: Math.round(input.kcal_100g),
        protein_100g: Math.round(input.protein_100g * 10) / 10,
        carbs_100g: Math.round(input.carbs_100g * 10) / 10,
        fat_100g: Math.round(input.fat_100g * 10) / 10,
        unit_label_es: unitLabel,
        grams_per_unit: gramsPerUnit,
        tags: [],
        country_tags: ["latam"],
      };

      const { data, error } = await supabase
        .from("generic_foods")
        .insert(payload)
        .select("*")
        .maybeSingle();

      if (error) {
        if (error.code === "23505") {
          return { ok: false, message: "Ya existe un producto con ese código de barras." };
        }
        return { ok: false, message: error.message, code: error.code };
      }

      if (!data) {
        return { ok: false, message: "No se pudo crear el alimento." };
      }

      // Registro de aporte en gamificación eliminado

      return { ok: true, data: data as GenericFoodDb };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Error al crear alimento",
      };
    }
  },

  /**
   * Obtiene alimentos por sus IDs (útil para favoritos)
   */
  async getByIds(foodIds: string[]): Promise<RepoResult<GenericFoodDb[]>> {
    if (!foodIds || foodIds.length === 0) {
      return { ok: true, data: [] };
    }

    try {
      const { data, error } = await supabase
        .from("generic_foods")
        .select(
          "id, name_es, name_norm, aliases_search, barcode, base_unit, kcal_100g, protein_100g, carbs_100g, fat_100g, unit_label_es, grams_per_unit, tags, created_at",
        )
        .in("id", foodIds)
        .order("created_at", { ascending: false });

      if (error) return { ok: false, message: error.message, code: error.code };
      return { ok: true, data: (data as GenericFoodDb[]) ?? [] };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Error al obtener alimentos",
      };
    }
  },
};
