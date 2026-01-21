// src/presentation/hooks/smartCoach/useSmartCoach.ts
import { exercisesRepository } from "@/data/exercise/exercisesRepository";
import { genericFoodsRepository } from "@/data/food/genericFoodsRepository";
import type { ProfileDb } from "@/domain/models/profileDb";
import type { SmartCoachRecommendation, SmartCoachState } from "@/domain/models/smartCoach";
import { useCallback, useEffect, useState } from "react";

/**
 * Determina los tags de alimentos a sugerir basado en la hora del día
 */
function getFoodTagsByHour(): string[] {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 11) {
    // 05:00 - 11:00: Desayuno
    return ["breakfast"];
  } else if (hour >= 11 && hour < 15) {
    // 11:00 - 15:00: Almuerzo
    return ["lunch", "protein"];
  } else if (hour >= 15 && hour < 19) {
    // 15:00 - 19:00: Snack/Tarde
    return ["snack", "fruit"];
  } else {
    // 19:00 - 23:59: Cena (liviana)
    return ["dinner"];
  }
}

/**
 * Calcula los minutos necesarios para quemar X calorías usando MET
 * Fórmula: Minutos = (Exceso_Kcal * 200) / (MET * 3.5 * peso_kg)
 */
function calculateMinutesToBurnCalories(
  excessCalories: number,
  metValue: number,
  weightKg: number,
): number {
  if (weightKg <= 0 || metValue <= 0) return 0;
  const minutes = (excessCalories * 200) / (metValue * 3.5 * weightKg);
  return Math.ceil(minutes);
}

/**
 * Hook para obtener recomendaciones de Smart Coach
 */
export function useSmartCoach(
  profile: ProfileDb | null,
  caloriesTarget: number,
  caloriesConsumed: number,
  isPremium: boolean,
): SmartCoachState {
  const [recommendation, setRecommendation] = useState<SmartCoachRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendation = useCallback(async () => {
    if (!isPremium) {
      setRecommendation(null);
      return;
    }

    if (!profile?.weight_kg || !profile.weight_kg > 0) {
      setError("El peso del usuario no está configurado");
      return;
    }

    if (caloriesTarget <= 0) {
      setError("La meta calórica no está configurada");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const remainingCalories = caloriesTarget - caloriesConsumed;

      if (remainingCalories > 0) {
        // Escenario A: Recomendación de comida (faltan calorías)
        const tags = getFoodTagsByHour();
        const foodsRes = await genericFoodsRepository.searchByTags(tags, 3);

        if (!foodsRes.ok) {
          setError(foodsRes.message);
          return;
        }

        const foods = foodsRes.data.slice(0, 3);

        // Determinar el mensaje según la hora
        const hour = new Date().getHours();
        let message = "";
        if (hour >= 5 && hour < 11) {
          message = `¡Buenos días! Te quedan ${Math.round(remainingCalories)} kcal disponibles. ¿Qué tal un desayuno nutritivo?`;
        } else if (hour >= 11 && hour < 15) {
          message = `¡Vas por buen camino! Te quedan ${Math.round(remainingCalories)} kcal para el almuerzo.`;
        } else if (hour >= 15 && hour < 19) {
          message = `¡Perfecto! Te quedan ${Math.round(remainingCalories)} kcal. ¿Qué tal un snack saludable?`;
        } else {
          message = `Todavía tienes ${Math.round(remainingCalories)} kcal disponibles para una cena ligera.`;
        }

        setRecommendation({
          type: "food",
          message,
          foods,
          remainingCalories: Math.round(remainingCalories),
        });
      } else if (remainingCalories < 0) {
        // Escenario B: Recomendación de ejercicio (exceso de calorías)
        const excessCalories = Math.abs(remainingCalories);
        const exercisesRes = await exercisesRepository.getRandom(2);

        if (!exercisesRes.ok) {
          setError(exercisesRes.message);
          return;
        }

        const exercises = exercisesRes.data.map((exercise) => {
          const minutesNeeded = calculateMinutesToBurnCalories(
            excessCalories,
            exercise.met_value,
            profile.weight_kg,
          );
          return {
            exercise,
            minutesNeeded,
          };
        });

        // Mensaje motivador
        const message = `Hoy disfrutaste de ${Math.round(excessCalories)} kcal extra. ¿Qué tal equilibrar con un poco de ejercicio?`;

        setRecommendation({
          type: "exercise",
          message,
          exercises,
          excessCalories: Math.round(excessCalories),
        });
      } else {
        // Exactamente en la meta (sin recomendación necesaria)
        setRecommendation(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [profile, caloriesTarget, caloriesConsumed, isPremium]);

  useEffect(() => {
    fetchRecommendation();
  }, [fetchRecommendation]);

  return { recommendation, loading, error };
}

/**
 * Helper para verificar si un usuario es premium
 * Por ahora asumimos que si no hay campo explícito, es free
 */
export function isPremiumUser(profile: ProfileDb | null): boolean {
  // TODO: Implementar lógica real de suscripción cuando esté disponible en ProfileDb
  // Por ahora retornamos false como default
  // Esto se puede actualizar cuando se agregue el campo subscription/is_premium a ProfileDb
  return false;
}
