// src/presentation/hooks/food/useRecentFoods.ts
import { storage } from "@/core/storage/storage";
import { StorageKeys } from "@/core/storage/keys";
import { useCallback, useEffect, useState } from "react";
import type { FoodSearchItem } from "@/domain/mappers/foodMappers";

type RecentFood = {
  key: string;
  name: string;
  source: FoodSearchItem["source"];
  food_id?: string | null;
  user_food_id?: string | null;
  timestamp: number;
};

const MAX_RECENT_FOODS = 10;

export function useRecentFoods() {
  const [recentFoods, setRecentFoods] = useState<RecentFood[]>([]);
  const [loading, setLoading] = useState(true);

  // Cargar recientes desde storage
  const loadRecentFoods = useCallback(async () => {
    try {
      const cached = await storage.getJson<RecentFood[]>(StorageKeys.RECENT_FOODS);
      if (cached && Array.isArray(cached)) {
        // Ordenar por timestamp descendente y limitar
        const sorted = cached
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, MAX_RECENT_FOODS);
        setRecentFoods(sorted);
      }
    } catch (error) {
      console.error("[useRecentFoods] Error loading recent foods:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar al montar
  useEffect(() => {
    loadRecentFoods();
  }, [loadRecentFoods]);

  // Agregar un alimento a recientes
  const addRecent = useCallback(
    async (food: FoodSearchItem) => {
      try {
        const recent: RecentFood = {
          key: food.key,
          name: food.name,
          source: food.source,
          food_id: food.food_id ?? null,
          user_food_id: food.user_food_id ?? null,
          timestamp: Date.now(),
        };

        // Obtener recientes actuales
        const current = await storage.getJson<RecentFood[]>(StorageKeys.RECENT_FOODS) ?? [];
        
        // Eliminar si ya existe (por key)
        const filtered = current.filter((item) => item.key !== food.key);
        
        // Agregar al inicio
        const updated = [recent, ...filtered].slice(0, MAX_RECENT_FOODS);
        
        // Guardar
        await storage.setJson(StorageKeys.RECENT_FOODS, updated);
        setRecentFoods(updated);
      } catch (error) {
        console.error("[useRecentFoods] Error adding recent food:", error);
      }
    },
    [],
  );

  // Limpiar recientes
  const clearRecent = useCallback(async () => {
    try {
      await storage.remove(StorageKeys.RECENT_FOODS);
      setRecentFoods([]);
    } catch (error) {
      console.error("[useRecentFoods] Error clearing recent foods:", error);
    }
  }, []);

  return {
    recentFoods,
    addRecent,
    clearRecent,
    loading,
    refresh: loadRecentFoods,
  };
}
