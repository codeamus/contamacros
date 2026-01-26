// src/domain/mappers/foodMappers.ts
import type { GenericFoodDb } from "@/data/food/genericFoodsRepository";
import type { UserFoodDb } from "@/data/food/userFoodsRepository";

/**
 * Tipo unificado para items de búsqueda de alimentos
 */
export type FoodSearchItem = {
  key: string;
  source: "user_food" | "food" | "off";
  name: string;
  meta?: string;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;

  // Información de unidades unificada
  unit_label_es?: string | null;
  grams_per_unit?: number | null;
  tags?: string[];
  
  food_id?: string | null;
  user_food_id?: string | null;
  verified?: boolean;
};

/**
 * Mapper para la tabla 'generic_foods' (única fuente de alimentos comunitarios)
 */
export function mapGenericFoodDbToSearchItem(genericFood: GenericFoodDb): FoodSearchItem {
  // Convertir grams_per_unit a número y validar que sea finito y > 0
  let gramsPerUnit: number | null = null;
  if (genericFood.grams_per_unit != null) {
    const value = Number(genericFood.grams_per_unit);
    if (Number.isFinite(value) && value > 0) {
      gramsPerUnit = value;
    }
  }

  return {
    key: `gf:${genericFood.id}`,
    source: "food",
    name: genericFood.name_es,
    kcal_100g: Number(genericFood.kcal_100g) || 0,
    protein_100g: Number(genericFood.protein_100g) || 0,
    carbs_100g: Number(genericFood.carbs_100g) || 0,
    fat_100g: Number(genericFood.fat_100g) || 0,
    unit_label_es: genericFood.unit_label_es || null,
    grams_per_unit: gramsPerUnit,
    tags: genericFood.tags ?? [],
    food_id: genericFood.id,
    verified: true,
  };
}

export function mapUserFoodDbToSearchItem(userFood: UserFoodDb): FoodSearchItem {
  return {
    key: `uf:${userFood.id}`,
    source: "user_food",
    name: userFood.name,
    meta: "Personalizado",
    kcal_100g: Number(userFood.calories) || 0,
    protein_100g: Number(userFood.protein) || 0,
    carbs_100g: Number(userFood.carbs) || 0,
    fat_100g: Number(userFood.fat) || 0,
    user_food_id: userFood.id,
    verified: true,
  };
}

// Helpers de arrays
export const mapGenericFoodDbArrayToSearchItems = (foods: GenericFoodDb[]) => foods.map(f => mapGenericFoodDbToSearchItem(f));
export const mapUserFoodDbArrayToSearchItems = (foods: UserFoodDb[]) => foods.map(f => mapUserFoodDbToSearchItem(f));