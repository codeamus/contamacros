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

  kcal_100g?: number | null;
  protein_100g?: number | null;
  carbs_100g?: number | null;
  fat_100g?: number | null;

  // Información de unidades (para generic_foods)
  unit_label_es?: string | null;
  grams_per_unit?: number | null;
  tags?: string[]; // Para detectar fast food, etc.

  food_id?: string | null;
  user_food_id?: string | null;

  verified?: boolean;
};

/**
 * Tipo parcial para búsquedas (no todos los campos están presentes)
 */
type PartialFoodDb = Pick<
  FoodDb,
  "id" | "name" | "calories" | "protein" | "carbs" | "fat"
> & {
  verified?: boolean;
  source?: string;
  brand?: string | null;
};

/**
 * Mapper puro: FoodDb o PartialFoodDb -> FoodSearchItem
 */
export function mapFoodDbToSearchItem(
  food: FoodDb | PartialFoodDb,
  prefix: string = "f",
): FoodSearchItem {
  return {
    key: `${prefix}:${food.id}`,
    source: "food",
    name: food.name,
    meta: food.verified
      ? "Verificado"
      : food.source === "openfoodfacts"
        ? food.brand ?? "Estimado"
        : "Estimado",
    kcal_100g: food.calories ?? null,
    protein_100g: food.protein ?? null,
    carbs_100g: food.carbs ?? null,
    fat_100g: food.fat ?? null,
    food_id: food.id,
    verified: Boolean(food.verified),
  };
}


/**
 * Mapper puro: GenericFoodDb -> FoodSearchItem
 */
export function mapGenericFoodDbToSearchItem(
  genericFood: GenericFoodDb,
): FoodSearchItem {
  return {
    key: `g:${genericFood.id}`,
    source: "food", // Tratado como "food" para UX simple
    name: genericFood.name_es,
    meta: "Genérico",
    kcal_100g: genericFood.kcal_100g ?? 0,
    protein_100g: genericFood.protein_100g ?? 0,
    carbs_100g: genericFood.carbs_100g ?? 0,
    fat_100g: genericFood.fat_100g ?? 0,
    unit_label_es: genericFood.unit_label_es ?? null,
    grams_per_unit: genericFood.grams_per_unit ?? null,
    tags: genericFood.tags ?? [],
    food_id: null, // No existe en foods
    verified: true,
  };
}

/**
 * Tipo parcial para UserFoodDb en búsquedas
 */
type PartialUserFoodDb = Pick<
  UserFoodDb,
  "id" | "name" | "calories" | "protein" | "carbs" | "fat"
>;

/**
 * Mapper puro: UserFoodDb o PartialUserFoodDb -> FoodSearchItem
 */
export function mapUserFoodDbToSearchItem(
  userFood: UserFoodDb | PartialUserFoodDb,
): FoodSearchItem {
  return {
    key: `uf:${userFood.id}`,
    source: "user_food",
    name: userFood.name,
    meta: "Personalizado",
    kcal_100g: userFood.calories ?? 0,
    protein_100g: userFood.protein ?? 0,
    carbs_100g: userFood.carbs ?? 0,
    fat_100g: userFood.fat ?? 0,
    user_food_id: userFood.id,
    verified: true,
  };
}

/**
 * Helper para mapear arrays de FoodDb o PartialFoodDb
 */
export function mapFoodDbArrayToSearchItems(
  foods: (FoodDb | PartialFoodDb)[],
  prefix: string = "f",
): FoodSearchItem[] {
  return foods.map((food) => mapFoodDbToSearchItem(food, prefix));
}

/**
 * Helper para mapear arrays de UserFoodDb o PartialUserFoodDb
 */
export function mapUserFoodDbArrayToSearchItems(
  userFoods: (UserFoodDb | PartialUserFoodDb)[],
): FoodSearchItem[] {
  return userFoods.map(mapUserFoodDbToSearchItem);
}

/**
 * Helper para mapear arrays de GenericFoodDb
 */
export function mapGenericFoodDbArrayToSearchItems(
  genericFoods: GenericFoodDb[],
): FoodSearchItem[] {
  return genericFoods.map(mapGenericFoodDbToSearchItem);
}
