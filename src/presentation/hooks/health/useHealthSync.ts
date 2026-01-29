// src/presentation/hooks/health/useHealthSync.ts
import { activityLogRepository } from "@/data/activity/activityLogRepository";
import { todayStrLocal } from "@/presentation/utils/date";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";

const HEALTH_TIMEOUT_MS = 5_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("HEALTH_TIMEOUT")), ms)
    ),
  ]);
}

/**
 * Hook para sincronizar calorías de Apple Health (iOS) y Health Connect (Android)
 */
export function useHealthSync(isPremium: boolean) {
  const [caloriesBurned, setCaloriesBurned] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const day = todayStrLocal();

  /**
   * Sincroniza calorías desde Apple Health (iOS).
   * Toda la lógica interna va en Promise.race con timeout de 5s (HEALTH_TIMEOUT) para evitar que el bridge nativo bloquee la app.
   */
  const syncAppleHealth = useCallback(async (): Promise<number> => {
    if (Platform.OS !== "ios") {
      throw new Error("Apple Health solo está disponible en iOS");
    }

    const run = async (): Promise<number> => {
      // Importar dinámicamente para evitar errores en Android
      const HealthKit = require("@kingstinct/react-native-healthkit").default;

      const isAvailable = await HealthKit.isHealthDataAvailable();
      if (!isAvailable) {
        throw new Error("HealthKit no está disponible en este dispositivo");
      }

      const activeEnergyBurnedId = "HKQuantityTypeIdentifierActiveEnergyBurned";

      await HealthKit.requestAuthorization(
        [],
        [activeEnergyBurnedId]
      );

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(startOfDay);
      endOfDay.setHours(23, 59, 59, 999);

      console.log("[useHealthSync] Buscando calorías del día:", {
        startDate: startOfDay.toISOString(),
        endDate: endOfDay.toISOString(),
        startDateLocal: startOfDay.toLocaleString(),
        endDateLocal: endOfDay.toLocaleString(),
        nowLocal: now.toLocaleString(),
      });

      let totalCalories = 0;

      try {
        if (HealthKit.getDailyQuantitySamples) {
          const dailySamples = await HealthKit.getDailyQuantitySamples(
            activeEnergyBurnedId,
            { startDate: startOfDay, endDate: endOfDay }
          );

          if (dailySamples && dailySamples.length > 0) {
            const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
            const todaySample = dailySamples.find((sample: any) => {
              if (!sample.startDate) return false;
              const sampleDate = new Date(sample.startDate);
              const sampleDateStr = `${sampleDate.getFullYear()}-${String(sampleDate.getMonth() + 1).padStart(2, "0")}-${String(sampleDate.getDate()).padStart(2, "0")}`;
              return sampleDateStr === todayStr;
            });

            if (todaySample && todaySample.quantity) {
              totalCalories = todaySample.quantity;
              console.log("[useHealthSync] ✅ Total obtenido con getDailyQuantitySamples:", totalCalories);
              return Math.round(totalCalories);
            }
          }
        }
      } catch (dailyError) {
        console.log("[useHealthSync] getDailyQuantitySamples no disponible, usando queryQuantitySamples:", dailyError);
      }

      const samples = await HealthKit.queryQuantitySamples(
        activeEnergyBurnedId,
        {
          startDate: startOfDay,
          endDate: endOfDay,
          ascending: false,
          limit: 10000,
        }
      );

      console.log("[useHealthSync] Muestras obtenidas de HealthKit:", samples.length);

      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const startOfDayTimestamp = startOfDay.getTime();
      const endOfDayTimestamp = endOfDay.getTime();

      let validSamples = 0;
      let skippedOldSamples = 0;

      for (let index = 0; index < samples.length; index++) {
        const sample = samples[index];
        if (!sample.startDate || !sample.quantity) continue;

        const sampleDate = new Date(sample.startDate);
        const sampleTimestamp = sampleDate.getTime();
        const sampleDateStr = `${sampleDate.getFullYear()}-${String(sampleDate.getMonth() + 1).padStart(2, "0")}-${String(sampleDate.getDate()).padStart(2, "0")}`;
        const sampleCalories = sample.quantity || 0;

        const isInTimestampRange = sampleTimestamp >= startOfDayTimestamp && sampleTimestamp <= endOfDayTimestamp;
        const isTodayByDate = sampleDateStr === todayStr;

        if (sampleTimestamp < startOfDayTimestamp) {
          skippedOldSamples = samples.length - index;
          break;
        }

        if (isTodayByDate && isInTimestampRange) {
          totalCalories += sampleCalories;
          validSamples++;
        }
      }

      console.log("[useHealthSync] Resumen:", {
        metodo: "queryQuantitySamples",
        totalMuestras: samples.length,
        muestrasValidas: validSamples,
        muestrasOmitidas: skippedOldSamples,
        caloriasTotales: Math.round(totalCalories),
        fechaBuscada: todayStr,
      });

      return Math.round(totalCalories);
    };

    try {
      return await withTimeout(run(), HEALTH_TIMEOUT_MS);
    } catch (err) {
      if (err instanceof Error && err.message === "HEALTH_TIMEOUT") {
        console.warn("[useHealthSync] Apple Health SDK no respondió en 5s (HEALTH_TIMEOUT)");
        throw new Error("La conexión con Apple Health tardó demasiado. Intenta de nuevo.");
      }
      console.error("[useHealthSync] Error al leer Apple Health:", err);
      throw err;
    }
  }, []);

  /**
   * Sincroniza calorías desde Health Connect (Android).
   * Toda la lógica interna va en Promise.race con timeout de 5s (HEALTH_TIMEOUT) para evitar que el bridge nativo bloquee la app.
   */
  const syncHealthConnect = useCallback(async (): Promise<number> => {
    if (Platform.OS !== "android") {
      throw new Error("Health Connect solo está disponible en Android");
    }

    const run = async (): Promise<number> => {
      const HealthConnect = require("react-native-health-connect").default;

      await HealthConnect.initialize();

      const isAvailable = await HealthConnect.isAvailable();
      if (!isAvailable) {
        throw new Error("Health Connect no está disponible. Por favor, instálalo desde Google Play.");
      }

      const permissions = [
        { accessType: "read", recordType: "ActiveCaloriesBurned" },
      ];

      const granted = await HealthConnect.requestPermission(permissions);
      if (!granted) {
        throw new Error("Permisos de Health Connect denegados");
      }

      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      const records = await HealthConnect.readRecords({
        recordType: "ActiveCaloriesBurned",
        timeRangeFilter: {
          operator: "between",
          startTime: startOfDay.toISOString(),
          endTime: endOfDay.toISOString(),
        },
      });

      const totalCalories = records.reduce((sum: number, record: any) => {
        return sum + (record.energy?.inKilocalories || 0);
      }, 0);

      console.log("[useHealthSync] Calorías leídas de Health Connect:", totalCalories);
      return Math.round(totalCalories);
    };

    try {
      return await withTimeout(run(), HEALTH_TIMEOUT_MS);
    } catch (err) {
      if (err instanceof Error && err.message === "HEALTH_TIMEOUT") {
        console.warn("[useHealthSync] Health Connect SDK no respondió en 5s (HEALTH_TIMEOUT)");
        throw new Error("La conexión con Health Connect tardó demasiado. Intenta de nuevo.");
      }
      console.error("[useHealthSync] Error al leer Health Connect:", err);
      throw err;
    }
  }, []);

  const SYNC_CALORIES_TIMEOUT_MS = 90_000;

  /**
   * Carga las calorías del día desde la base de datos
   */
  const loadTodayCalories = useCallback(async (): Promise<void> => {
    if (!isPremium) {
      setCaloriesBurned(0);
      return;
    }

    setLoading(true);
    try {
      const res = await activityLogRepository.getTodayCalories(day);
      if (res.ok) {
        setCaloriesBurned(res.data);
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [day, isPremium]);

  /**
   * Sincroniza calorías desde la app de salud correspondiente.
   * Usa Promise.race con timeout para no quedar colgado si el usuario cierra/cancela el diálogo de permisos.
   * options.silent: si true, no se actualiza el estado de error (útil para cold start).
   */
  const syncCalories = useCallback(
    async (options?: { silent?: boolean }): Promise<void> => {
      if (!isPremium) {
        setError("La sincronización de salud es una función premium");
        return;
      }

      const silent = options?.silent ?? false;
      setIsSyncing(true);
      setError(null);

      const runSync = async (): Promise<void> => {
        let calories = 0;
        const source: "apple_health" | "health_connect" | "manual" =
          Platform.OS === "ios" ? "apple_health" : "health_connect";

        if (Platform.OS === "ios") {
          calories = await syncAppleHealth();
        } else if (Platform.OS === "android") {
          calories = await syncHealthConnect();
        } else {
          throw new Error("Plataforma no soportada");
        }

        const res = await activityLogRepository.upsertTodayCalories(
          day,
          calories,
          source,
        );

        if (!res.ok) {
          throw new Error(res.message);
        }

        setCaloriesBurned(calories);
        await loadTodayCalories();

        console.log("[useHealthSync] ✅ Sincronización completada:", {
          caloriasObtenidas: calories,
          dia: day,
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      };

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("SYNC_TIMEOUT")),
          SYNC_CALORIES_TIMEOUT_MS,
        );
      });

      try {
        await Promise.race([runSync(), timeoutPromise]);
      } catch (err) {
        try {
          if (!silent) {
            const msg =
              err instanceof Error
                ? err.message
                : typeof err === "string"
                  ? err
                  : "Error al sincronizar calorías";
            if (msg === "SYNC_TIMEOUT" || msg === "HEALTH_TIMEOUT") {
              console.warn("[useHealthSync] Sincronización cancelada por timeout (permisos o sistema)");
              setError("Tiempo de espera agotado. Intenta de nuevo.");
            } else {
              setError(msg);
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          } else {
            console.log("[useHealthSync] Error en sincronización silenciosa:", err);
          }
        } catch {
          // Nunca relanzar: garantizar que finally se ejecute y la UI se desbloquee
        }
      } finally {
        setIsSyncing(false);
      }
    },
    [day, isPremium, loadTodayCalories, syncAppleHealth, syncHealthConnect],
  );

  /** Permite desbloquear la UI si el usuario canceló permisos y la sync quedó colgada. */
  const cancelSync = useCallback(() => {
    setIsSyncing(false);
  }, []);

  // Ref para rastrear última sincronización y evitar múltiples sincronizaciones
  const lastSyncTime = useRef<number>(0);
  const isSyncingRef = useRef(false);
  const appState = useRef(AppState.currentState);

  // Sincronización automática cuando la app pasa a primer plano
  useEffect(() => {
    if (!isPremium) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // Solo sincronizar cuando la app pasa de 'background' o 'inactive' a 'active'
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        const now = Date.now();
        const timeSinceLastSync = now - lastSyncTime.current;
        const ONE_MINUTE = 60 * 1000;

        // No sincronizar si fue hace menos de 1 minuto
        if (timeSinceLastSync < ONE_MINUTE) {
          console.log(
            `[HealthSync] Sincronización omitida: última sync hace ${Math.round(timeSinceLastSync / 1000)}s (menos de 1 minuto)`,
          );
          return;
        }

        // Evitar múltiples sincronizaciones simultáneas
        if (isSyncingRef.current) {
          console.log("[HealthSync] Sincronización ya en curso, omitiendo...");
          return;
        }

        console.log("[HealthSync] Sincronización automática disparada por cambio de estado");
        isSyncingRef.current = true;
        lastSyncTime.current = now;

        syncCalories()
          .catch((error) => {
            console.error("[HealthSync] Error en sincronización automática:", error);
            // No mostrar error al usuario, es automático
          })
          .finally(() => {
            isSyncingRef.current = false;
          });
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isPremium, syncCalories]);

  // Cargar calorías al montar: diferido al siguiente tick para no bloquear el primer frame (Main Thread libre).
  // Sin await en el ciclo de vida; la UI se pinta de inmediato.
  useEffect(() => {
    if (!isPremium) {
      setCaloriesBurned(0);
      return;
    }
    const t = setTimeout(() => {
      loadTodayCalories();
    }, 0);
    return () => clearTimeout(t);
  }, [day, isPremium, loadTodayCalories]);

  // Red de seguridad: si isSyncing queda true (p. ej. usuario canceló permisos y el SDK no resolvió),
  // forzar isSyncing=false tras 6s para desbloquear la UI.
  useEffect(() => {
    if (!isSyncing) return;
    const safetyTimer = setTimeout(() => {
      console.warn("[useHealthSync] Safety timer: forzando isSyncing=false tras 6s");
      setIsSyncing(false);
    }, 6_000);
    return () => clearTimeout(safetyTimer);
  }, [isSyncing]);

  // NO auto-sync al entrar (cold start): evita que al cancelar el diálogo de permisos
  // la app quede pegada (SDK nativo puede no resolver o bloquear el JS thread).
  // La sincronización solo se dispara por: botón manual, pull-to-refresh o app a primer plano.

  // Objeto estable por dependencias para evitar bucles de actualización en el consumidor.
  return useMemo(
    () => ({
      caloriesBurned,
      loading,
      error,
      isSyncing,
      syncCalories,
      cancelSync,
      reload: loadTodayCalories,
    }),
    [caloriesBurned, loading, error, isSyncing, syncCalories, cancelSync, loadTodayCalories],
  );
}
