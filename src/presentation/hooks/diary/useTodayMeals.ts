import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";

import { foodLogRepository } from "@/data/food/foodLogRepository";
import type { FoodLogDb, MealType } from "@/domain/models/foodLogDb";
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

  const [logs, setLogs] = useState<FoodLogDb[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const meals = useMemo(() => group(logs), [logs]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);

    const res = await foodLogRepository.listByDay(day);
    if (!res.ok) {
      setErr(res.message);
      setLogs([]);
      setLoading(false);
      return;
    }

    setLogs(res.data);
    setLoading(false);
  }, [day]);

  // Importante: se recarga cuando vuelves desde add-food
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return { day, meals, loading, err, reload: load, logs, MEALS };
}
