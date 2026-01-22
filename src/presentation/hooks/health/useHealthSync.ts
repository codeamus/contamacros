// src/presentation/hooks/health/useHealthSync.ts
import { activityLogRepository } from "@/data/activity/activityLogRepository";
import { todayStrLocal } from "@/presentation/utils/date";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

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
   * Sincroniza calorías desde Apple Health (iOS)
   */
  const syncAppleHealth = async (): Promise<number> => {
    if (Platform.OS !== "ios") {
      throw new Error("Apple Health solo está disponible en iOS");
    }

    try {
      // Importar dinámicamente para evitar errores en Android
      const HealthKit = require("@kingstinct/react-native-healthkit").default;
      
      // Verificar disponibilidad
      const isAvailable = await HealthKit.isHealthDataAvailable();
      if (!isAvailable) {
        throw new Error("HealthKit no está disponible en este dispositivo");
      }

      // Usar el identificador completo de HealthKit
      const activeEnergyBurnedId = "HKQuantityTypeIdentifierActiveEnergyBurned";

      // Solicitar permisos
      // En versión 10.1.0, requestAuthorization espera 2 argumentos separados:
      // 1. toShare (array de tipos para escribir)
      // 2. toRead (array de tipos para leer)
      await HealthKit.requestAuthorization(
        [], // toShare: no necesitamos escribir datos
        [activeEnergyBurnedId] // toRead: queremos leer calorías activas
      );

      // Obtener fecha de hoy en hora local
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

      // Intentar obtener el total agregado del día usando getDailyQuantitySamples (más preciso)
      // Si no está disponible, usar queryQuantitySamples y sumar todas las muestras
      let totalCalories = 0;
      
      try {
        // Método 1: Intentar obtener datos agregados por día (más preciso y rápido)
        if (HealthKit.getDailyQuantitySamples) {
          const dailySamples = await HealthKit.getDailyQuantitySamples(
            activeEnergyBurnedId,
            {
              startDate: startOfDay,
              endDate: endOfDay,
            }
          );
          
          if (dailySamples && dailySamples.length > 0) {
            // Buscar la muestra del día actual
            const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const todaySample = dailySamples.find((sample: any) => {
              if (!sample.startDate) return false;
              const sampleDate = new Date(sample.startDate);
              const sampleDateStr = `${sampleDate.getFullYear()}-${String(sampleDate.getMonth() + 1).padStart(2, '0')}-${String(sampleDate.getDate()).padStart(2, '0')}`;
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

      // Método 2: Fallback - Obtener todas las muestras y sumarlas
      // IMPORTANTE: Usar endOfDay para obtener todo el día, no solo hasta ahora
      const samples = await HealthKit.queryQuantitySamples(
        activeEnergyBurnedId,
        {
          startDate: startOfDay,
          endDate: endOfDay, // Cambiado de 'now' a 'endOfDay' para obtener todo el día
          ascending: false,
          limit: 10000, // Aumentado el límite para asegurar que obtenemos todas las muestras
        }
      );

      console.log("[useHealthSync] Muestras obtenidas de HealthKit:", samples.length);

      // Sumar todas las muestras del día
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const startOfDayTimestamp = startOfDay.getTime();
      const endOfDayTimestamp = endOfDay.getTime();
      
      let validSamples = 0;
      let skippedOldSamples = 0;
      
      // Procesar todas las muestras del día
      for (let index = 0; index < samples.length; index++) {
        const sample = samples[index];
        if (!sample.startDate || !sample.quantity) continue;
        
        const sampleDate = new Date(sample.startDate);
        const sampleTimestamp = sampleDate.getTime();
        const sampleDateStr = `${sampleDate.getFullYear()}-${String(sampleDate.getMonth() + 1).padStart(2, '0')}-${String(sampleDate.getDate()).padStart(2, '0')}`;
        const sampleCalories = sample.quantity || 0;
        
        // Filtrar por timestamp Y fecha local para máxima precisión
        const isInTimestampRange = sampleTimestamp >= startOfDayTimestamp && sampleTimestamp <= endOfDayTimestamp;
        const isTodayByDate = sampleDateStr === todayStr;
        
        // Si la muestra es más antigua que el inicio del día, podemos parar
        if (sampleTimestamp < startOfDayTimestamp) {
          skippedOldSamples = samples.length - index;
          break;
        }
        
        // Solo contar muestras del día actual
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
    } catch (err) {
      console.error("[useHealthSync] Error al leer Apple Health:", err);
      throw err;
    }
  };

  /**
   * Sincroniza calorías desde Health Connect (Android)
   */
  const syncHealthConnect = async (): Promise<number> => {
    if (Platform.OS !== "android") {
      throw new Error("Health Connect solo está disponible en Android");
    }

    try {
      // Importar dinámicamente para evitar errores en iOS
      const HealthConnect = require("react-native-health-connect").default;

      // Inicializar Health Connect
      await HealthConnect.initialize();

      // Verificar disponibilidad
      const isAvailable = await HealthConnect.isAvailable();
      if (!isAvailable) {
        throw new Error("Health Connect no está disponible. Por favor, instálalo desde Google Play.");
      }

      // Solicitar permisos
      const permissions = [
        {
          accessType: "read",
          recordType: "ActiveCaloriesBurned",
        },
      ];

      const granted = await HealthConnect.requestPermission(permissions);
      if (!granted) {
        throw new Error("Permisos de Health Connect denegados");
      }

      // Obtener fecha de hoy
      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      // Leer calorías activas del día
      const records = await HealthConnect.readRecords({
        recordType: "ActiveCaloriesBurned",
        timeRangeFilter: {
          operator: "between",
          startTime: startOfDay.toISOString(),
          endTime: endOfDay.toISOString(),
        },
      });

      // Sumar todas las muestras del día
      const totalCalories = records.reduce((sum: number, record: any) => {
        return sum + (record.energy?.inKilocalories || 0);
      }, 0);

      console.log("[useHealthSync] Calorías leídas de Health Connect:", totalCalories);
      return Math.round(totalCalories);
    } catch (err) {
      console.error("[useHealthSync] Error al leer Health Connect:", err);
      throw err;
    }
  };

  /**
   * Sincroniza calorías desde la app de salud correspondiente
   */
  const syncCalories = async (): Promise<void> => {
    if (!isPremium) {
      setError("La sincronización de salud es una función premium");
      return;
    }

    setIsSyncing(true);
    setError(null);

    try {
      let calories = 0;
      const source: "apple_health" | "health_connect" | "manual" = Platform.OS === "ios"
        ? "apple_health"
        : "health_connect";

      if (Platform.OS === "ios") {
        calories = await syncAppleHealth();
      } else if (Platform.OS === "android") {
        calories = await syncHealthConnect();
      } else {
        throw new Error("Plataforma no soportada");
      }

      // Guardar en la base de datos
      const res = await activityLogRepository.upsertTodayCalories(
        day,
        calories,
        source,
      );

      if (!res.ok) {
        throw new Error(res.message);
      }

      setCaloriesBurned(calories);
      
      // Recargar desde la base de datos para asegurar consistencia
      await loadTodayCalories();
      
      console.log("[useHealthSync] ✅ Sincronización completada:", {
        caloriasObtenidas: calories,
        caloriasGuardadas: caloriesBurned,
        dia: day,
      });
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error al sincronizar calorías";
      setError(errorMessage);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * Carga las calorías del día desde la base de datos
   */
  const loadTodayCalories = async (): Promise<void> => {
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
  };

  // Cargar calorías al montar el componente
  useEffect(() => {
    if (isPremium) {
      loadTodayCalories();
    }
  }, [day, isPremium]);

  return {
    caloriesBurned,
    loading,
    error,
    isSyncing,
    syncCalories,
    reload: loadTodayCalories,
  };
}
