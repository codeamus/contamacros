import { foodLogRepository } from "@/data/food/foodLogRepository";
import type { FoodLogDb } from "@/domain/models/foodLogDb";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
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
  const { session } = useAuth();

  const [logs, setLogs] = useState<FoodLogDb[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const totals = useMemo(() => sumLogs(logs), [logs]);

  const load = useCallback(async () => {
    // ✅ PROTECCIÓN: No ejecutar si no hay sesión activa
    if (!session) {
      console.log("[useTodaySummary] No hay sesión activa, omitiendo carga");
      setLogs([]);
      setLoading(false);
      setErr(null);
      return;
    }

    console.log("[useTodaySummary] Cargando datos para el día:", day);
    setLoading(true);
    setErr(null);

    const res = await foodLogRepository.listByDay(day);
    if (!res.ok) {
      console.error("[useTodaySummary] Error al cargar:", res.message);
      
      // ✅ MANEJO DE ERRORES: Si es error de sesión, no bloquear la UI
      if (res.message?.includes("sesión") || res.message?.includes("autenticado")) {
        console.log("[useTodaySummary] Error de sesión detectado, limpiando estado sin bloquear");
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

    console.log("[useTodaySummary] Datos cargados:", res.data.length, "registros");
    setLogs(res.data);
    setLoading(false);
  }, [day, session]);

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

  return { day, logs, totals, loading, err, reload: load };
}
