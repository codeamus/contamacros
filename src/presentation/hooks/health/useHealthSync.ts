// src/presentation/hooks/health/useHealthSync.ts
import { StorageKeys } from "@/core/storage/keys";
import { storage } from "@/core/storage/storage";
import { activityLogRepository } from "@/data/activity/activityLogRepository";
import { todayStrLocal } from "@/presentation/utils/date";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, AppStateStatus, Linking, Platform } from "react-native";

const HEALTH_TIMEOUT_MS = 10_000;

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
  const [hasPermissions, setHasPermissions] = useState(false);

  const day = todayStrLocal();
  const syncLockRef = useRef(false);

  // Restaurar estado de conexión persistido
  useEffect(() => {
    storage.getString(StorageKeys.HEALTH_CONNECTED).then((v) => {
      if (v === "true") setHasPermissions(true);
    });
  }, []);

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

      await HealthKit.requestAuthorization({
        toShare: [],
        toRead: [activeEnergyBurnedId],
      });

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
      const {
        initialize,
        getSdkStatus,
        getGrantedPermissions,
        readRecords,
        SdkAvailabilityStatus,
      } = require("react-native-health-connect");

      // 1. Verificar disponibilidad del SDK
      const status = await getSdkStatus();
      if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
        throw new Error(
          "Health Connect no está disponible. Por favor, instálalo desde Google Play."
        );
      }

      // 2. Inicializar el cliente (no registra ActivityResultLauncher, solo el HealthConnectClient)
      await initialize();

      // 3. Verificar permisos SIN llamar a requestPermission (que crashea por lateinit)
      const alreadyGranted = await getGrantedPermissions();
      const grantedSet = new Set(
        (alreadyGranted ?? []).map(
          (p: any) => `${p.accessType}:${p.recordType}`
        )
      );

      const hasActiveCalories = grantedSet.has("read:ActiveCaloriesBurned");
      const hasBasal = grantedSet.has("read:BasalMetabolicRate");

      // 4. Si faltan permisos, abrir Health Connect para que el usuario los conceda
      if (!hasActiveCalories) {
        try {
          const { openHealthConnectSettings } = require("react-native-health-connect");
          await openHealthConnectSettings();
        } catch {
          // Fallback: abrir ajustes del sistema
          await Linking.openSettings();
        }
        throw new Error("NEEDS_PERMISSIONS");
      }

      // 5. Leer registros del día
      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      const timeRangeFilter = {
        operator: "between" as const,
        startTime: startOfDay.toISOString(),
        endTime: endOfDay.toISOString(),
      };

      const [activeResult, basalResult] = await Promise.all([
        readRecords("ActiveCaloriesBurned", { timeRangeFilter }),
        hasBasal
          ? readRecords("BasalMetabolicRate", { timeRangeFilter }).catch(() => ({ records: [] }))
          : Promise.resolve({ records: [] }),
      ]);

      // 6. Sumar calorías activas
      const activeRecords = activeResult?.records || [];
      const activeCalories = (Array.isArray(activeRecords) ? activeRecords : []).reduce(
        (sum: number, record: any) => sum + (record.energy?.inKilocalories ?? 0),
        0
      );

      // 7. Calcular gasto basal proporcional a las horas transcurridas hoy
      const basalRecords = basalResult?.records || [];
      let basalCalories = 0;
      if (Array.isArray(basalRecords) && basalRecords.length > 0) {
        const latestBasal = basalRecords[basalRecords.length - 1];
        const dailyRate = latestBasal?.basalMetabolicRate?.inKilocaloriesPerDay ?? 0;
        if (dailyRate > 0) {
          const hoursElapsed = (today.getTime() - startOfDay.getTime()) / (1000 * 60 * 60);
          basalCalories = (dailyRate / 24) * hoursElapsed;
        }
      }

      const totalCalories = activeCalories + basalCalories;

      console.log("[useHealthSync] Health Connect:", {
        active: Math.round(activeCalories),
        basal: Math.round(basalCalories),
        total: Math.round(totalCalories),
      });

      return Math.round(totalCalories);
    };

    try {
      return await withTimeout(run(), HEALTH_TIMEOUT_MS);
    } catch (err) {
      if (err instanceof Error && err.message === "HEALTH_TIMEOUT") {
        console.warn("[useHealthSync] Health Connect SDK timeout");
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
        if (res.data > 0) {
          setHasPermissions(true);
          storage.setString(StorageKeys.HEALTH_CONNECTED, "true");
        }
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

      // Bloqueo de concurrencia: evita que dos syncs simultáneos colapsen el bridge nativo
      if (syncLockRef.current) {
        console.log("[useHealthSync] Sync ya en curso, ignorando llamada duplicada");
        return;
      }
      syncLockRef.current = true;

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
        setHasPermissions(true);
        storage.setString(StorageKeys.HEALTH_CONNECTED, "true");
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
            if (msg === "NEEDS_PERMISSIONS") {
              setError("Concede los permisos en Health Connect y vuelve a sincronizar.");
            } else if (msg === "SYNC_TIMEOUT" || msg === "HEALTH_TIMEOUT") {
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
        syncLockRef.current = false;
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

        // Solo auto-sync si ya tenemos permisos (evita popup al abrir la app)
        if (!hasPermissions) {
          console.log("[HealthSync] Sin permisos previos, omitiendo auto-sync");
          return;
        }

        console.log("[HealthSync] Sincronización automática disparada por cambio de estado");
        isSyncingRef.current = true;
        lastSyncTime.current = now;

        syncCalories({ silent: true })
          .catch((error) => {
            console.error("[HealthSync] Error en sincronización automática:", error);
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
  }, [isPremium, hasPermissions, syncCalories]);

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
      hasPermissions,
      syncCalories,
      cancelSync,
      reload: loadTodayCalories,
    }),
    [caloriesBurned, loading, error, isSyncing, hasPermissions, syncCalories, cancelSync, loadTodayCalories],
  );
}
