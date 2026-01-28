// src/presentation/hooks/smartCoach/useSmartCoachPro.ts
import { activityLogRepository } from "@/data/activity/activityLogRepository";
import { exercisesRepository } from "@/data/exercise/exercisesRepository";
import { foodLogRepository } from "@/data/food/foodLogRepository";
import { genericFoodsRepository } from "@/data/food/genericFoodsRepository";
import { userFoodsRepository } from "@/data/food/userFoodsRepository";
import type { ProfileDb } from "@/domain/models/profileDb";
import type {
    CalorieRecommendation,
    SmartCoachRecommendation,
    SmartCoachState,
} from "@/domain/models/smartCoach";
import { todayStrLocal } from "@/presentation/utils/date";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Calcula los minutos necesarios para quemar calorías usando MET
 * Fórmula: Minutos = (Exceso_Kcal * 200) / (MET * 3.5 * peso_kg)
 */
function calculateMinutesToBurnCalories(
  excessCalories: number,
  metValue: number,
  weightKg: number,
): number {
  if (weightKg <= 0 || metValue <= 0) return 1;
  const minutes = (excessCalories * 200) / (metValue * 3.5 * weightKg);
  return Math.max(1, Math.round(minutes * 10) / 10);
}

/**
 * Calcula la cantidad recomendada de un alimento para cubrir un déficit específico
 * Retorna gramos recomendados
 */
function calculateRecommendedAmount(
  food: {
    protein_100g: number;
    carbs_100g: number;
    fat_100g: number;
    kcal_100g: number;
  },
  targetMacro: "protein" | "carbs" | "fat" | "calories",
  targetValue: number, // Valor del macro o calorías que queremos cubrir
  maxCalories?: number, // Límite máximo de calorías (opcional)
): number {
  const macroValue =
    targetMacro === "protein"
      ? food.protein_100g
      : targetMacro === "carbs"
        ? food.carbs_100g
        : targetMacro === "fat"
          ? food.fat_100g
          : food.kcal_100g;

  if (macroValue <= 0) return 0;

  // Calcular gramos necesarios para cubrir el déficit
  const gramsNeeded = (targetValue * 100) / macroValue;

  // Si hay límite de calorías, verificar que no se exceda
  if (maxCalories && maxCalories > 0) {
    const caloriesFromFood = (food.kcal_100g * gramsNeeded) / 100;
    if (caloriesFromFood > maxCalories * 1.1) {
      // Permitir hasta 10% de exceso
      const maxGrams = (maxCalories * 100) / food.kcal_100g;
      return Math.round(maxGrams);
    }
  }

  return Math.round(gramsNeeded);
}

/**
 * Tipo para alimentos encontrados en la búsqueda
 */
type FoodMatch = {
  name: string;
  source: "history" | "generic" | "user_food";
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  kcal_100g: number;
  unitLabel?: string;
  gramsPerUnit?: number;
  lastEaten?: string;
  timesEaten?: number;
};

type DietaryPreference = "omnivore" | "vegetarian" | "vegan" | "pescatarian" | null;

/** Palabras que indican carne/productos no permitidos por preferencia (nombre en minúsculas) */
const MEAT_KEYWORDS = ["carne", "vacuno", "res", "cerdo", "cordero", "pollo", "pavo", "pato", "ave", "chorizo", "jamon", "jamón", "bacon", "tocino", "salchicha", "vísceras", "visceras"];
const FISH_KEYWORDS = ["pescado", "atun", "atún", "salmon", "salmón", "mariscos", "camarón", "camaron", "langosta", "calamar", "pulpo"];
const DAIRY_EGG_KEYWORDS = ["leche", "queso", "mantequilla", "crema", "yogur", "huevo", "huevos"];

function matchesDietaryPreference(
  name: string,
  _source: string,
  dietaryPreference: DietaryPreference,
  tags?: string[],
): boolean {
  if (!dietaryPreference || dietaryPreference === "omnivore") return true;
  const nameLower = name.toLowerCase().trim();
  const tagLower = (tags ?? []).map((t) => t.toLowerCase());

  const hasMeat = MEAT_KEYWORDS.some((k) => nameLower.includes(k)) || tagLower.some((t) => ["carne", "meat", "pollo", "cerdo"].some((k) => t.includes(k)));
  const hasFish = FISH_KEYWORDS.some((k) => nameLower.includes(k)) || tagLower.some((t) => ["pescado", "fish", "marisco"].some((k) => t.includes(k)));
  const hasDairyEgg = DAIRY_EGG_KEYWORDS.some((k) => nameLower.includes(k)) || tagLower.some((t) => ["dairy", "lacteo", "huevo", "egg"].some((k) => t.includes(k)));

  switch (dietaryPreference) {
    case "vegan":
      return !hasMeat && !hasFish && !hasDairyEgg;
    case "vegetarian":
      return !hasMeat && !hasFish;
    case "pescatarian":
      return !hasMeat;
    default:
      return true;
  }
}

/**
 * Busca alimentos que calcen perfecto con los requerimientos.
 * Orden de búsqueda: 1) user_foods, 2) food_logs (historial 30 días), 3) generic_foods (searchByTags).
 * Se filtra por dietary_preference del perfil antes de mostrar.
 */
async function findPerfectFoodMatch(
  gaps: {
    protein: number;
    carbs: number;
    fat: number;
    calories: number;
  },
  priorityMacro: "protein" | "carbs" | "fat" | "calories",
  _maxCalories?: number,
  dietaryPreference: DietaryPreference = null,
): Promise<FoodMatch | null> {
  const matches: FoodMatch[] = [];
  const hasSignificantGap =
    gaps.protein > 10 ||
    gaps.carbs > 10 ||
    gaps.fat > 10 ||
    gaps.calories > 10;

  // 1. Buscar en user_foods (recetas del usuario)
  const userFoodsRes = await userFoodsRepository.getAllForSmartSearch();
  if (userFoodsRes.ok) {
    for (const food of userFoodsRes.data) {
      if (!matchesDietaryPreference(food.name, "user_food", dietaryPreference)) continue;
      const base = food.portion_base || 100;
      const factor = 100 / base;
      const protein_100g = food.protein * factor;
      const carbs_100g = food.carbs * factor;
      const fat_100g = food.fat * factor;
      const kcal_100g = food.calories * factor;

      const macroValue =
        priorityMacro === "protein"
          ? protein_100g
          : priorityMacro === "carbs"
            ? carbs_100g
            : priorityMacro === "fat"
              ? fat_100g
              : kcal_100g;

      if (macroValue > 0) {
        matches.push({
          name: food.name,
          source: "user_food",
          protein_100g,
          carbs_100g,
          fat_100g,
          kcal_100g,
          unitLabel: food.portion_unit,
        });
      }
    }
  }

  // 2. Buscar en food_logs (historial)
  const historyRes = await foodLogRepository.getUniqueFoodsFromHistory(30);
  if (historyRes.ok) {
    for (const food of historyRes.data) {
      if (!matchesDietaryPreference(food.name, "history", dietaryPreference)) continue;
      const macroValue =
        priorityMacro === "protein"
          ? food.protein_g
          : priorityMacro === "carbs"
            ? food.carbs_g
            : priorityMacro === "fat"
              ? food.fat_g
              : food.calories;

      if (macroValue > 0) {
        matches.push({
          name: food.name,
          source: "history",
          protein_100g: food.protein_g,
          carbs_100g: food.carbs_g,
          fat_100g: food.fat_g,
          kcal_100g: food.calories,
          lastEaten: food.lastEaten,
          timesEaten: food.timesEaten,
        });
      }
    }
  }

  // 3. Buscar en generic_foods
  const tags =
    priorityMacro === "protein"
      ? ["protein", "proteina"]
      : priorityMacro === "carbs"
        ? ["carb", "carbohidrato", "fruit"]
        : ["fat", "grasa", "dairy"];

  const genericRes = await genericFoodsRepository.searchByTags(tags, 50);
  if (genericRes.ok) {
    for (const food of genericRes.data) {
      if (
        !food.kcal_100g ||
        food.kcal_100g <= 0 ||
        !food.protein_100g ||
        !food.carbs_100g ||
        !food.fat_100g
      ) {
        continue;
      }
      if (!matchesDietaryPreference(food.name_es, "generic", dietaryPreference, food.tags ?? [])) continue;

      const macroValue =
        priorityMacro === "protein"
          ? food.protein_100g
          : priorityMacro === "carbs"
            ? food.carbs_100g
            : priorityMacro === "fat"
              ? food.fat_100g
              : food.kcal_100g;

      const isLowDensity =
        food.kcal_100g < 30 ||
        (priorityMacro === "protein" && food.protein_100g < 2) ||
        (priorityMacro === "carbs" && food.carbs_100g < 5) ||
        (priorityMacro === "fat" && food.fat_100g < 1) ||
        (priorityMacro === "calories" && food.kcal_100g < 50);

      const lowValueFoods = [
        "zanahoria",
        "lechuga",
        "apio",
        "pepino",
        "tomate",
        "cebolla",
        "ajo",
        "perejil",
        "cilantro",
        "sal",
        "pimienta",
        "condimento",
        "aderezo",
        "salsa",
      ];
      const foodNameLower = food.name_es.toLowerCase();
      const isLowValueFood = lowValueFoods.some((lowFood) =>
        foodNameLower.includes(lowFood),
      );

      if (macroValue > 0 && !isLowDensity && !isLowValueFood) {
        matches.push({
          name: food.name_es,
          source: "generic",
          protein_100g: food.protein_100g,
          carbs_100g: food.carbs_100g,
          fat_100g: food.fat_100g,
          kcal_100g: food.kcal_100g,
          unitLabel: food.unit_label_es || undefined,
          gramsPerUnit: food.grams_per_unit || undefined,
        });
      }
    }
  }

  // Ordenar por fit score (priorizar historial, luego mejor match)
  matches.sort((a, b) => {
    // Priorizar historial
    if (a.source === "history" && b.source !== "history") return -1;
    if (b.source === "history" && a.source !== "history") return 1;

    // Luego por densidad del macro prioritario
    const aMacro =
      priorityMacro === "protein"
        ? a.protein_100g
        : priorityMacro === "carbs"
          ? a.carbs_100g
          : priorityMacro === "fat"
            ? a.fat_100g
            : a.kcal_100g;
    const bMacro =
      priorityMacro === "protein"
        ? b.protein_100g
        : priorityMacro === "carbs"
          ? b.carbs_100g
          : priorityMacro === "fat"
            ? b.fat_100g
            : b.kcal_100g;

    return bMacro - aMacro;
  });

  // Si ya hay match, retornarlo
  if (matches.length > 0) return matches[0] ?? null;

  // Si hay déficit significativo (>10g o >10 kcal) y no encontramos nada, fallback a generic_foods completo
  if (hasSignificantGap) {
    const fallbackRes =
      await genericFoodsRepository.getAllForSmartSearch();
    if (fallbackRes.ok && fallbackRes.data.length > 0) {
      for (const food of fallbackRes.data) {
        if (
          !food.kcal_100g ||
          food.kcal_100g <= 0 ||
          food.protein_100g == null ||
          food.carbs_100g == null ||
          food.fat_100g == null
        )
          continue;
        if (
          !matchesDietaryPreference(
            food.name_es,
            "generic",
            dietaryPreference,
            food.tags ?? [],
          )
        )
          continue;
        const macroValue =
          priorityMacro === "protein"
            ? food.protein_100g
            : priorityMacro === "carbs"
              ? food.carbs_100g
              : priorityMacro === "fat"
                ? food.fat_100g
                : food.kcal_100g;
        if (macroValue > 0) {
          return {
            name: food.name_es,
            source: "generic",
            protein_100g: food.protein_100g,
            carbs_100g: food.carbs_100g,
            fat_100g: food.fat_100g,
            kcal_100g: food.kcal_100g,
            unitLabel: food.unit_label_es ?? undefined,
            gramsPerUnit: food.grams_per_unit ?? undefined,
          };
        }
      }
    }
  }

  return null;
}

/** Umbral: por debajo se considera usuario sin registros (primera vez) */
const EMPTY_USER_CAL_THRESHOLD = 20;
const EMPTY_USER_MACRO_THRESHOLD = 5;

function getMomentOfDayLabel(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return "DESAYUNO";
  if (hour >= 11 && hour < 15) return "ALMUERZO";
  if (hour >= 15 && hour < 19) return "MERIENDA";
  return "CENA";
}

/**
 * Primera comida del día / usuario sin registros: va directo a generic_foods,
 * prioriza alimentos de calidad (proteína, carbohidratos complejos) y sugiere
 * una porción = meta diaria / 4 (una comida equilibrada).
 */
async function findFirstMealSuggestion(
  profile: ProfileDb | null,
  caloriesTarget: number,
  proteinTarget: number,
  carbsTarget: number,
  fatTarget: number,
): Promise<CalorieRecommendation | null> {
  const dietaryPreference = (profile?.dietary_preference ?? null) as DietaryPreference;
  const momentLabel = getMomentOfDayLabel();

  const res = await genericFoodsRepository.getAllForSmartSearch();
  if (!res.ok || !res.data.length) return null;

  const candidates = res.data.filter((food) => {
    if (
      !food.kcal_100g ||
      food.kcal_100g < 40 ||
      food.protein_100g == null ||
      food.carbs_100g == null ||
      food.fat_100g == null
    )
      return false;
    if (
      !matchesDietaryPreference(
        food.name_es,
        "generic",
        dietaryPreference,
        food.tags ?? [],
      )
    )
      return false;
    // Priorizar alimentos con proteína y calorías útiles (evitar condimentos)
    if (food.protein_100g < 1 && food.kcal_100g < 80) return false;
    return true;
  });

  if (candidates.length === 0) return null;

  // Ordenar por calidad: proteína primero, luego calorías equilibradas
  candidates.sort((a, b) => {
    const scoreA = (a.protein_100g ?? 0) * 2 + (a.kcal_100g ?? 0) / 50;
    const scoreB = (b.protein_100g ?? 0) * 2 + (b.kcal_100g ?? 0) / 50;
    return scoreB - scoreA;
  });

  const food = candidates[0];
  if (!food || !food.kcal_100g || food.kcal_100g <= 0) return null;

  // Porción = 1/4 de la meta calórica del día (una comida equilibrada)
  const targetKcalPerMeal = Math.max(200, Math.min(600, caloriesTarget / 4));
  let recommendedAmount = Math.round((targetKcalPerMeal * 100) / food.kcal_100g);
  if (food.grams_per_unit && food.grams_per_unit > 0) {
    recommendedAmount = Math.round(
      (recommendedAmount / food.grams_per_unit) * food.grams_per_unit,
    );
  }
  recommendedAmount = Math.max(50, Math.min(500, recommendedAmount));

  const message = `¡Estrenemos tu plan Pro! Para empezar tu ${momentLabel} con energía, te recomiendo:`;

  return {
    type: "calorie",
    message,
    recommendedFood: {
      name: food.name_es,
      source: "generic",
      protein_100g: food.protein_100g ?? 0,
      carbs_100g: food.carbs_100g ?? 0,
      fat_100g: food.fat_100g ?? 0,
      kcal_100g: food.kcal_100g,
      recommendedAmount,
      unitLabel: food.unit_label_es ?? undefined,
    },
    calorieGap: Math.round(caloriesTarget),
  };
}

/**
 * Hook para obtener recomendaciones de Smart Coach Pro
 */
export function useSmartCoachPro(
  profile: ProfileDb | null,
  caloriesTarget: number,
  caloriesConsumed: number,
  proteinConsumed: number,
  carbsConsumed: number,
  fatConsumed: number,
  isPremium: boolean,
): SmartCoachState {
  const [recommendation, setRecommendation] =
    useState<SmartCoachRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isProcessingRef = useRef(false);
  const lastExecutionDataRef = useRef<{
    caloriesConsumed: number;
    caloriesTarget: number;
  } | null>(null);

  const fetchRecommendation = useCallback(async () => {
    console.log("[SmartCoach] fetchRecommendation llamado", {
      isPremium,
      caloriesTarget,
      caloriesConsumed,
      proteinConsumed,
      carbsConsumed,
      fatConsumed,
    });

    if (!isPremium) {
      setRecommendation(null);
      return;
    }

    // Verificar si hay una ejecución en curso y si los datos han cambiado
    if (isProcessingRef.current) {
      const lastData = lastExecutionDataRef.current;
      // Si los datos son diferentes, cancelar la ejecución anterior y continuar con la nueva
      if (lastData && (lastData.caloriesConsumed !== caloriesConsumed || lastData.caloriesTarget !== caloriesTarget)) {
        console.log("[SmartCoach] Datos cambiaron durante ejecución anterior, cancelando y reiniciando...");
        isProcessingRef.current = false;
        // Continuar con la nueva ejecución
      } else {
        console.log("[SmartCoach] Ya hay una ejecución en curso con los mismos datos, saltando...");
        return;
      }
    }

    if (!profile?.weight_kg || profile.weight_kg <= 0) {
      setError("El peso del usuario no está configurado");
      return;
    }

    const proteinTarget = profile?.protein_g ?? 0;
    const carbsTarget = profile?.carbs_g ?? 0;
    const fatTarget = profile?.fat_g ?? 0;

    if (
      caloriesTarget <= 0 ||
      proteinTarget <= 0 ||
      carbsTarget <= 0 ||
      fatTarget <= 0
    ) {
      console.log("[SmartCoach] Metas no configuradas, esperando...");
      setError(null);
      setRecommendation(null);
      setLoading(false);
      isProcessingRef.current = false;
      return;
    }

    // Usuario nuevo / sin registros: forzar recomendación de primera comida (generic_foods, bienvenida)
    const isEmptyUser =
      caloriesConsumed < EMPTY_USER_CAL_THRESHOLD &&
      proteinConsumed < EMPTY_USER_MACRO_THRESHOLD &&
      carbsConsumed < EMPTY_USER_MACRO_THRESHOLD &&
      fatConsumed < EMPTY_USER_MACRO_THRESHOLD;

    if (isEmptyUser) {
      console.log("[SmartCoach] Usuario sin registros: generando primera recomendación (generic_foods)");
      lastExecutionDataRef.current = {
        caloriesConsumed: Number(caloriesConsumed),
        caloriesTarget: Number(caloriesTarget),
      };
      isProcessingRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const firstMealRec = await findFirstMealSuggestion(
          profile,
          Number(caloriesTarget),
          Number(profile?.protein_g ?? 0),
          Number(profile?.carbs_g ?? 0),
          Number(profile?.fat_g ?? 0),
        );
        if (firstMealRec) {
          setRecommendation(firstMealRec);
        } else {
          setRecommendation(null);
        }
      } catch (err) {
        console.warn("[SmartCoach] Error findFirstMealSuggestion:", err);
        setRecommendation(null);
      }
      setLoading(false);
      isProcessingRef.current = false;
      return;
    }

    const target = Number(caloriesTarget) || 0;
    const consumed = Number(caloriesConsumed) || 0;
    const proteinTargetNum = Number(proteinTarget) || 0;
    const carbsTargetNum = Number(carbsTarget) || 0;
    const fatTargetNum = Number(fatTarget) || 0;
    const proteinConsumedNum = Number(proteinConsumed) || 0;
    const carbsConsumedNum = Number(carbsConsumed) || 0;
    const fatConsumedNum = Number(fatConsumed) || 0;

    // Verificar si esta ejecución es más reciente que la última
    const lastData = lastExecutionDataRef.current;
    if (lastData && lastData.caloriesConsumed === consumed && lastData.caloriesTarget === target) {
      console.log("[SmartCoach] Datos no han cambiado desde la última ejecución, saltando...");
      return;
    }

    // Actualizar referencia de última ejecución ANTES de procesar
    lastExecutionDataRef.current = { caloriesConsumed: consumed, caloriesTarget: target };

    isProcessingRef.current = true;
    setLoading(true);
    setError(null);

    try {

      // Calcular gaps
      const proteinGap = Math.max(0, proteinTargetNum - proteinConsumedNum);
      const carbsGap = Math.max(0, carbsTargetNum - carbsConsumedNum);
      const fatGap = Math.max(0, fatTargetNum - fatConsumedNum);
      const caloriesGap = Math.max(0, target - consumed);
      const excessCalories = Math.max(0, consumed - target);

      // ESCENARIO C: Superávit calórico → Recomendar ejercicio
      // SIEMPRE recomendar ejercicio si hay exceso (aunque sea mínimo)
      if (excessCalories > 0) {
        console.log("[SmartCoach] EXCESO DETECTADO - excessCalories:", excessCalories, "consumed:", consumed, "target:", target);
        
        // Si es premium, obtener calorías de actividad y restarlas del exceso
        let activityCaloriesBurned = 0;
        let remainingExcess = excessCalories;
        if (isPremium) {
          try {
            const activityRes = await activityLogRepository.getTodayCalories(todayStrLocal());
            if (activityRes.ok && activityRes.data > 0) {
              activityCaloriesBurned = activityRes.data;
              remainingExcess = Math.max(0, excessCalories - activityCaloriesBurned);
              console.log("[SmartCoach] Calorías de actividad:", activityCaloriesBurned, "Exceso antes:", excessCalories, "Exceso después:", remainingExcess);
            }
          } catch (err) {
            console.warn("[SmartCoach] Error al obtener calorías de actividad:", err);
          }
        }

        // Si la actividad ya compensó todo el exceso, no recomendar ejercicio
        if (remainingExcess <= 0 && activityCaloriesBurned > 0) {
          console.log("[SmartCoach] El exceso fue completamente compensado por actividad física");
          setRecommendation(null);
          setLoading(false);
          isProcessingRef.current = false;
          return;
        }
        
        const exercisesRes = await exercisesRepository.listAll();
        
        if (!exercisesRes.ok) {
          console.log("[SmartCoach] ERROR al obtener ejercicios:", exercisesRes.message, "code:", exercisesRes.code);
          setRecommendation(null);
          setError(`Error al obtener ejercicios: ${exercisesRes.message}`);
          setLoading(false);
          isProcessingRef.current = false;
          return;
        }

        const exercisesData = exercisesRes.data;
        console.log("[SmartCoach] Ejercicios obtenidos:", exercisesData?.length ?? 0);

        if (!exercisesData || exercisesData.length === 0) {
          console.log("[SmartCoach] ERROR: Array de ejercicios está vacío. Esto puede ser por:");
          console.log("[SmartCoach] 1. La tabla 'exercises' está vacía en Supabase");
          console.log("[SmartCoach] 2. Las políticas RLS están bloqueando el acceso");
          console.log("[SmartCoach] 3. El usuario no tiene permisos para leer la tabla");
          setRecommendation(null);
          setError("No hay ejercicios disponibles. Verifica las políticas RLS en Supabase para la tabla 'exercises'");
          setLoading(false);
          isProcessingRef.current = false;
          return;
        }

        const hour = new Date().getHours();
        const isNight = hour >= 20 || hour < 5;
        console.log("[SmartCoach] Hora actual:", hour, "isNight:", isNight);

        // Convertir met_value a número
        const allExercises = exercisesData.map((e) => {
          const metValue = typeof e.met_value === "string" ? parseFloat(e.met_value) : e.met_value;
          return {
            ...e,
            met_value: metValue,
          };
        });

        console.log("[SmartCoach] Total ejercicios:", allExercises.length);
        console.log("[SmartCoach] Primeros ejercicios:", allExercises.slice(0, 3).map(e => ({
          name: e.name_es,
          met: e.met_value,
        })));

        // Filtrar ejercicios según hora
        let selectedExercises = allExercises.filter((e) => {
          const met = e.met_value;
          if (isNight) {
            // Noche: solo ejercicios de baja intensidad (MET <= 4.5)
            return met >= 2 && met <= 4.5;
          } else {
            // Mañana/Tarde: ejercicios de cualquier intensidad (MET >= 2)
            return met >= 2;
          }
        });

        console.log("[SmartCoach] Ejercicios filtrados por hora:", selectedExercises.length);

        // Si no hay ejercicios filtrados, usar todos disponibles
        if (selectedExercises.length === 0) {
          console.log("[SmartCoach] Usando fallback: todos los ejercicios disponibles");
          selectedExercises = allExercises;
        }

        // Seleccionar hasta 2 ejercicios aleatorios
        const shuffled = [...selectedExercises].sort(() => Math.random() - 0.5);
        const exercisesToRecommend = shuffled.slice(0, Math.min(2, shuffled.length));
        
        console.log("[SmartCoach] Ejercicios seleccionados para recomendar:", exercisesToRecommend.length);
        
        const exercises = exercisesToRecommend.map((exercise) => {
          const minutesNeeded = calculateMinutesToBurnCalories(
            remainingExcess, // Usar el exceso restante después de restar actividad
            exercise.met_value,
            profile.weight_kg ?? 70, // Fallback si weight_kg es null
          );
          console.log("[SmartCoach] Ejercicio:", exercise.name_es, "MET:", exercise.met_value, "Minutos:", minutesNeeded);
          return {
            exercise: {
              id: exercise.id,
              name_es: exercise.name_es,
              met_value: exercise.met_value,
              icon_name: exercise.icon_name,
            },
            minutesNeeded,
          };
        });

        exercises.sort((a, b) => a.minutesNeeded - b.minutesNeeded);

        if (exercises.length === 0) {
          console.log("[SmartCoach] ERROR: No se pudieron generar ejercicios recomendados");
          setRecommendation(null);
          setError("No se pudieron generar recomendaciones de ejercicio");
          setLoading(false);
          isProcessingRef.current = false;
          return;
        }

        const firstExercise = exercises[0];
        if (!firstExercise) {
          console.log("[SmartCoach] ERROR: firstExercise es undefined");
          setRecommendation(null);
          setError("Error al procesar ejercicios");
          setLoading(false);
          isProcessingRef.current = false;
          return;
        }
        
        console.log("[SmartCoach] Estableciendo recomendación de ejercicio:", firstExercise.exercise.name_es);
        const hourNow = new Date().getHours();
        let message = "";

        // Mensaje personalizado según hora y si hay actividad registrada
        if (activityCaloriesBurned > 0) {
          if (hourNow >= 5 && hourNow < 12) {
            message = `Te pasaste por ${Math.round(excessCalories)} kcal hoy. Ya quemaste ${Math.round(activityCaloriesBurned)} kcal con actividad física. ${firstExercise.exercise.name_es} por ${Math.round(firstExercise.minutesNeeded)} minutos completará el equilibrio.`;
          } else if (hourNow >= 12 && hourNow < 20) {
            message = `Has consumido ${Math.round(excessCalories)} kcal extra. Ya quemaste ${Math.round(activityCaloriesBurned)} kcal con actividad física. ¿Qué tal ${firstExercise.exercise.name_es} por ${Math.round(firstExercise.minutesNeeded)} minutos?`;
          } else {
            message = `Te pasaste por ${Math.round(excessCalories)} kcal hoy. Ya quemaste ${Math.round(activityCaloriesBurned)} kcal con actividad física. Una caminata suave de ${Math.round(firstExercise.minutesNeeded)} minutos completará el equilibrio.`;
          }
        } else {
          if (hourNow >= 5 && hourNow < 12) {
            message = `Te pasaste por ${Math.round(excessCalories)} kcal. ${firstExercise.exercise.name_es} por ${Math.round(firstExercise.minutesNeeded)} minutos te ayudará a equilibrar.`;
          } else if (hourNow >= 12 && hourNow < 20) {
            message = `Has consumido ${Math.round(excessCalories)} kcal extra. ¿Qué tal ${firstExercise.exercise.name_es} por ${Math.round(firstExercise.minutesNeeded)} minutos?`;
          } else {
            message = `Te pasaste por ${Math.round(excessCalories)} kcal. Una caminata suave de ${Math.round(firstExercise.minutesNeeded)} minutos te ayudará a equilibrar.`;
          }
        }

        setRecommendation({
          type: "exercise",
          message,
          exercises,
          excessCalories: Math.round(excessCalories), // Exceso original
          activityCaloriesBurned: activityCaloriesBurned > 0 ? Math.round(activityCaloriesBurned) : undefined,
          remainingExcess: remainingExcess > 0 ? Math.round(remainingExcess) : undefined,
        });
        setLoading(false);
        isProcessingRef.current = false;
        return;
      }

      // Si no hay déficit significativo de calorías, no recomendar nada
      if (caloriesGap <= 10) {
        setRecommendation(null);
        setLoading(false);
        isProcessingRef.current = false;
        return;
      }

      // ESCENARIO A: Faltan calorías Y faltan macros → Priorizar macros
      const hasMacroGaps = proteinGap > 5 || carbsGap > 5 || fatGap > 5;

      if (hasMacroGaps) {
        // Determinar macro prioritario (mayor déficit porcentual)
        const proteinGapPercent =
          proteinTargetNum > 0 ? (proteinGap / proteinTargetNum) * 100 : 0;
        const carbsGapPercent =
          carbsTargetNum > 0 ? (carbsGap / carbsTargetNum) * 100 : 0;
        const fatGapPercent = fatTargetNum > 0 ? (fatGap / fatTargetNum) * 100 : 0;

        let priorityMacro: "protein" | "carbs" | "fat" = "protein";
        let maxGapPercent = proteinGapPercent;

        if (carbsGapPercent > maxGapPercent) {
          maxGapPercent = carbsGapPercent;
          priorityMacro = "carbs";
        }
        if (fatGapPercent > maxGapPercent) {
          maxGapPercent = fatGapPercent;
          priorityMacro = "fat";
        }

        // Buscar alimento perfecto (orden: user_foods → historial → generic; filtro dietary)
        const foodMatch = await findPerfectFoodMatch(
          {
            protein: proteinGap,
            carbs: carbsGap,
            fat: fatGap,
            calories: caloriesGap,
          },
          priorityMacro,
          caloriesGap,
          (profile?.dietary_preference as DietaryPreference) ?? null,
        );

        if (!foodMatch) {
          setRecommendation(null);
          setLoading(false);
          isProcessingRef.current = false;
          return;
        }

        // Calcular cantidad recomendada
        const priorityGap =
          priorityMacro === "protein"
            ? proteinGap
            : priorityMacro === "carbs"
              ? carbsGap
              : fatGap;

        const recommendedAmount = calculateRecommendedAmount(
          foodMatch,
          priorityMacro,
          priorityGap * 0.7, // Cubrir 70% del déficit
          caloriesGap,
        );

        if (recommendedAmount <= 0) {
          setRecommendation(null);
          setLoading(false);
          isProcessingRef.current = false;
          return;
        }

        // Generar mensaje directo y personalizado
        const macroLabel =
          priorityMacro === "protein"
            ? "Proteína"
            : priorityMacro === "carbs"
              ? "Carbohidratos"
              : "Grasas";

        let amountText = "";
        if (foodMatch.gramsPerUnit && foodMatch.unitLabel) {
          const units = recommendedAmount / foodMatch.gramsPerUnit;
          // Redondear a 1 decimal si es >= 1, sino mostrar como fracción común
          if (units >= 1) {
            amountText = `${Math.round(units * 10) / 10} ${foodMatch.unitLabel}`;
          } else {
            // Convertir a fracción común para valores < 1
            const fraction = Math.round(units * 4) / 4; // Redondear a 1/4 más cercano
            if (fraction === 0.25) amountText = `1/4 ${foodMatch.unitLabel}`;
            else if (fraction === 0.5) amountText = `1/2 ${foodMatch.unitLabel}`;
            else if (fraction === 0.75) amountText = `3/4 ${foodMatch.unitLabel}`;
            else amountText = `${Math.round(units * 10) / 10} ${foodMatch.unitLabel}`;
          }
        } else {
          amountText = `${recommendedAmount}g`;
        }

        let message = "";
        if (foodMatch.source === "history" && foodMatch.lastEaten) {
          const lastEatenDate = new Date(foodMatch.lastEaten);
          const daysAgo = Math.floor(
            (Date.now() - lastEatenDate.getTime()) / (1000 * 60 * 60 * 24),
          );
          const daysText =
            daysAgo === 0
              ? "hoy"
              : daysAgo === 1
                ? "ayer"
                : `hace ${daysAgo} días`;

          message = `Coach dice: Come ${amountText} de ${foodMatch.name} para completar tus ${macroLabel} de hoy (lo comiste ${daysText}).`;
        } else if (foodMatch.source === "user_food") {
          message = `Coach dice: Tu receta "${foodMatch.name}" es perfecta. Come ${amountText} para completar tus ${macroLabel}.`;
        } else {
          message = `Coach dice: Come ${amountText} de ${foodMatch.name} para completar tus ${macroLabel} de hoy.`;
        }

        setRecommendation({
          type: "macro",
          priorityMacro,
          message,
          recommendedFood: {
            name: foodMatch.name,
            source: foodMatch.source,
            protein_100g: foodMatch.protein_100g,
            carbs_100g: foodMatch.carbs_100g,
            fat_100g: foodMatch.fat_100g,
            kcal_100g: foodMatch.kcal_100g,
            recommendedAmount,
            unitLabel: foodMatch.unitLabel,
            lastEaten: foodMatch.lastEaten,
            timesEaten: foodMatch.timesEaten,
          },
          macroGaps: {
            protein: { gap: proteinGap, consumed: proteinConsumedNum, target: proteinTargetNum },
            carbs: { gap: carbsGap, consumed: carbsConsumedNum, target: carbsTargetNum },
            fat: { gap: fatGap, consumed: fatConsumedNum, target: fatTargetNum },
            calories: { gap: caloriesGap, consumed, target },
          },
        });
        setLoading(false);
        isProcessingRef.current = false;
        return;
      }

      // ESCENARIO B: Faltan calorías pero macros están al día
      const calorieFoodMatch = await findPerfectFoodMatch(
        {
          protein: 0,
          carbs: 0,
          fat: 0,
          calories: caloriesGap,
        },
        "calories",
        caloriesGap,
        (profile?.dietary_preference as DietaryPreference) ?? null,
      );

      if (!calorieFoodMatch) {
        setRecommendation(null);
        setLoading(false);
        isProcessingRef.current = false;
        return;
      }

      const recommendedAmount = calculateRecommendedAmount(
        calorieFoodMatch,
        "calories",
        caloriesGap * 0.8, // Cubrir 80% del déficit calórico
      );

      if (recommendedAmount <= 0) {
        setRecommendation(null);
        setLoading(false);
        isProcessingRef.current = false;
        return;
      }

      // Generar mensaje para ESCENARIO B
      let amountText = "";
      if (calorieFoodMatch.gramsPerUnit && calorieFoodMatch.unitLabel) {
        const units = recommendedAmount / calorieFoodMatch.gramsPerUnit;
        if (units >= 1) {
          amountText = `${Math.round(units * 10) / 10} ${calorieFoodMatch.unitLabel}`;
        } else {
          const fraction = Math.round(units * 4) / 4;
          if (fraction === 0.25) amountText = `1/4 ${calorieFoodMatch.unitLabel}`;
          else if (fraction === 0.5) amountText = `1/2 ${calorieFoodMatch.unitLabel}`;
          else if (fraction === 0.75) amountText = `3/4 ${calorieFoodMatch.unitLabel}`;
          else amountText = `${Math.round(units * 10) / 10} ${calorieFoodMatch.unitLabel}`;
        }
      } else {
        amountText = `${recommendedAmount}g`;
      }

      let message = "";
      if (calorieFoodMatch.source === "history" && calorieFoodMatch.lastEaten) {
        const lastEatenDate = new Date(calorieFoodMatch.lastEaten);
        const daysAgo = Math.floor(
          (Date.now() - lastEatenDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        const daysText =
          daysAgo === 0
            ? "hoy"
            : daysAgo === 1
              ? "ayer"
              : `hace ${daysAgo} días`;

        message = `Te faltan ${Math.round(caloriesGap)} kcal. Según tu historial, comer ${amountText} de ${calorieFoodMatch.name} es tu mejor opción (lo comiste ${daysText}).`;
      } else {
        message = `Te faltan ${Math.round(caloriesGap)} kcal. Según tu historial, comer ${amountText} de ${calorieFoodMatch.name} es tu mejor opción.`;
      }

      setRecommendation({
        type: "calorie",
        message,
        recommendedFood: {
          name: calorieFoodMatch.name,
          source: calorieFoodMatch.source,
          protein_100g: calorieFoodMatch.protein_100g,
          carbs_100g: calorieFoodMatch.carbs_100g,
          fat_100g: calorieFoodMatch.fat_100g,
          kcal_100g: calorieFoodMatch.kcal_100g,
          recommendedAmount,
          unitLabel: calorieFoodMatch.unitLabel,
          lastEaten: calorieFoodMatch.lastEaten,
          timesEaten: calorieFoodMatch.timesEaten,
        },
        calorieGap: Math.round(caloriesGap),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
      isProcessingRef.current = false;
    }
  }, [
    profile,
    caloriesTarget,
    caloriesConsumed,
    proteinConsumed,
    carbsConsumed,
    fatConsumed,
    isPremium,
  ]);

  // Ejecutar cuando cambian las dependencias (especialmente cuando los datos se cargan)
  useEffect(() => {
    // Solo ejecutar si tenemos datos reales (no valores iniciales en 0)
    const hasRealData = caloriesConsumed > 0 || proteinConsumed > 0 || carbsConsumed > 0 || fatConsumed > 0;
    
    if (hasRealData) {
      console.log("[SmartCoach] Dependencias cambiaron con datos reales:", {
        caloriesTarget,
        caloriesConsumed,
        proteinConsumed,
        carbsConsumed,
        fatConsumed,
      });
      fetchRecommendation();
    } else {
      console.log("[SmartCoach] Dependencias cambiaron pero datos aún en 0, esperando...");
    }
  }, [fetchRecommendation, caloriesConsumed, proteinConsumed, carbsConsumed, fatConsumed]);

  // Ejecutar cada vez que la pantalla recibe foco (cuando el usuario entra al home)
  useFocusEffect(
    useCallback(() => {
      // Solo ejecutar si tenemos datos reales
      const hasRealData = caloriesConsumed > 0 || proteinConsumed > 0 || carbsConsumed > 0 || fatConsumed > 0;
      
      if (hasRealData) {
        console.log("[SmartCoach] Pantalla enfocada con datos reales, ejecutando recomendación...");
        // Resetear el flag de procesamiento para permitir nueva ejecución
        isProcessingRef.current = false;
        // Resetear referencia de última ejecución para forzar nueva ejecución
        lastExecutionDataRef.current = null;
        fetchRecommendation();
      } else {
        console.log("[SmartCoach] Pantalla enfocada pero datos aún no cargados, esperando...");
      }
    }, [fetchRecommendation, caloriesConsumed, proteinConsumed, carbsConsumed, fatConsumed])
  );

  return { 
    recommendation, 
    loading, 
    error,
    reload: fetchRecommendation,
  };
}
