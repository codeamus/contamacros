// src/presentation/hooks/diary/useCalendarData.ts
import { foodLogRepository } from "@/data/food/foodLogRepository";
import { useCallback, useEffect, useState } from "react";

export type DaySummary = {
  day: string; // YYYY-MM-DD
  calories: number;
};

export function useCalendarData(year: number, month: number) {
  const [summaries, setSummaries] = useState<DaySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);

    // Calcular primer y último día del mes
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(
      lastDay.getDate(),
    ).padStart(2, "0")}`;

    const res = await foodLogRepository.getDailySummaries(startDate, endDate);
    if (!res.ok) {
      setErr(res.message);
      setSummaries([]);
      setLoading(false);
      return;
    }

    setSummaries(res.data);
    setLoading(false);
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  const getCaloriesForDay = useCallback(
    (day: string): number => {
      const summary = summaries.find((s) => s.day === day);
      return summary?.calories ?? 0;
    },
    [summaries],
  );

  return {
    summaries,
    loading,
    err,
    reload: load,
    getCaloriesForDay,
  };
}
