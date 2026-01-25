import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";

import { foodLogRepository } from "@/data/food/foodLogRepository";
import type { FoodLogDb, MealType } from "@/domain/models/foodLogDb";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { todayStrLocal } from "@/presentation/utils/date";

export type MealSummary = {
  count: number;
  calories: number;
};

const MEALS: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function emptyMap(): Record<MealType, MealSummary> {
  return {
    breakfast: { count: 0, calories: 0 },
    lunch: { count: 0, calories: 0 },
    dinner: { count: 0, calories: 0 },
    snack: { count: 0, calories: 0 },
  };
}

function group(logs: FoodLogDb[]) {
  const map = emptyMap();
  for (const it of logs) {
    map[it.meal].count += 1;
    map[it.meal].calories += it.calories ?? 0;
  }
  return map;
}

export function useTodayMeals(dayParam?: string) {
  const day = dayParam ?? todayStrLocal();
  const { session } = useAuth();

  const [logs, setLogs] = useState<FoodLogDb[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const meals = useMemo(() => group(logs), [logs]);

  const load = useCallback(async () => {
    // ✅ PROTECCIÓN: No ejecutar si no hay sesión activa
    if (!session) {
      console.log("[useTodayMeals] No hay sesión activa, omitiendo carga");
      setLogs([]);
      setLoading(false);
      setErr(null);
      return;
    }

    console.log("[useTodayMeals] Cargando datos para el día:", day);
    setLoading(true);
    setErr(null);

    const res = await foodLogRepository.listByDay(day);
    if (!res.ok) {
      console.error("[useTodayMeals] Error al cargar:", res.message);
      
      // ✅ MANEJO DE ERRORES: Si es error de sesión, no bloquear la UI
      if (res.message?.includes("sesión") || res.message?.includes("autenticado")) {
        console.log("[useTodayMeals] Error de sesión detectado, limpiando estado sin bloquear");
        setLogs([]);
        setLoading(false);
        setErr(null); // No mostrar error al usuario si es problema de sesión
        return;
      }
      
      setErr(res.message);
      setLogs([]);
      setLoading(false);
      return;
    }

    console.log("[useTodayMeals] Datos cargados:", res.data.length, "registros");
    setLogs(res.data);
    setLoading(false);
  }, [day, session]);

  // Importante: se recarga cuando vuelves desde add-food
  // ✅ PROTECCIÓN: Solo ejecutar si hay sesión
  useFocusEffect(
    useCallback(() => {
      if (session) {
        load();
      } else {
        // Si no hay sesión, limpiar estado silenciosamente
        setLogs([]);
        setLoading(false);
        setErr(null);
      }
    }, [load, session])
  );

  return { day, meals, loading, err, reload: load, logs, MEALS };
}
