// src/domain/mappers/foodMappers.ts
import type { FoodDb } from "@/data/food/foodsRepository";
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

type PartialFoodDb = Pick<FoodDb, "id" | "name" | "calories" | "protein" | "carbs" | "fat"> & {
  verified?: boolean;
  unit_label_es?: string | null;
  grams_per_unit?: number | string | null;
};

/**
 * Mapper para la tabla 'foods' (o lo que quede en ella)
 */
export function mapFoodDbToSearchItem(food: FoodDb | PartialFoodDb, prefix: string = "f"): FoodSearchItem {
  // Convertir grams_per_unit a número y validar que sea finito y > 0
  // Verificar si la propiedad existe (puede no existir en FoodDb)
  let gramsPerUnit: number | null = null;
  const partialFood = food as PartialFoodDb;
  if (partialFood.grams_per_unit != null) {
    const value = Number(partialFood.grams_per_unit);
    if (Number.isFinite(value) && value > 0) {
      gramsPerUnit = value;
    }
  }

  // Verificar si unit_label_es existe (puede no existir en FoodDb)
  const unitLabel = partialFood.unit_label_es || null;

  return {
    key: `${prefix}:${food.id}`,
    source: "food",
    name: food.name,
    kcal_100g: Number(food.calories) || 0,
    protein_100g: Number(food.protein) || 0,
    carbs_100g: Number(food.carbs) || 0,
    fat_100g: Number(food.fat) || 0,
    unit_label_es: unitLabel,
    grams_per_unit: gramsPerUnit,
    food_id: food.id,
    verified: food.verified ?? false,
  };
}

/**
 * Mapper para la tabla 'generic_foods' (La principal ahora)
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
export const mapFoodDbArrayToSearchItems = (foods: FoodDb[]) => foods.map(f => mapFoodDbToSearchItem(f));
export const mapGenericFoodDbArrayToSearchItems = (foods: GenericFoodDb[]) => foods.map(f => mapGenericFoodDbToSearchItem(f));
export const mapUserFoodDbArrayToSearchItems = (foods: UserFoodDb[]) => foods.map(f => mapUserFoodDbToSearchItem(f));