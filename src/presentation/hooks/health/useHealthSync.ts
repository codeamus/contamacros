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

      // Solicitar permisos
      const permissions = {
        read: ["activeEnergyBurned"],
      };
      
      const authorized = await HealthKit.requestAuthorization(permissions);
      if (!authorized) {
        throw new Error("Permisos de HealthKit denegados");
      }

      // Obtener fecha de hoy
      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      // Leer calorías activas del día
      const samples = await HealthKit.getActiveEnergyBurned({
        startDate: startOfDay.toISOString(),
        endDate: endOfDay.toISOString(),
        unit: "kilocalorie",
      });

      // Sumar todas las muestras del día
      const totalCalories = samples.reduce((sum: number, sample: any) => {
        return sum + (sample.quantity || 0);
      }, 0);

      console.log("[useHealthSync] Calorías leídas de Apple Health:", totalCalories);
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
