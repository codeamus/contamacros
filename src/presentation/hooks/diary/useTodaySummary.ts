import { foodLogRepository } from "@/data/food/foodLogRepository";
import type { FoodLogDb } from "@/domain/models/foodLogDb";
import { todayStrLocal } from "@/presentation/utils/date";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";

function sumLogs(logs: FoodLogDb[]) {
  return logs.reduce(
    (acc, it) => {
      acc.calories += it.calories || 0;
      acc.protein += it.protein_g || 0;
      acc.carbs += it.carbs_g || 0;
      acc.fat += it.fat_g || 0;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export function useTodaySummary() {
  const day = todayStrLocal();

  const [logs, setLogs] = useState<FoodLogDb[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const totals = useMemo(() => sumLogs(logs), [logs]);

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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return { day, logs, totals, loading, err, reload: load };
}
