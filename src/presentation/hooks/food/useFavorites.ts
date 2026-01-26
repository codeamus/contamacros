// src/presentation/hooks/food/useFavorites.ts
import { userFavoritesRepository } from "@/data/food/userFavoritesRepository";
import { storage } from "@/core/storage/storage";
import { StorageKeys } from "@/core/storage/keys";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useCallback, useEffect, useMemo, useState } from "react";

const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

type FavoritesCache = {
  foodIds: string[];
  timestamp: number;
};

export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Cargar favoritos desde caché y luego sincronizar con servidor
  const loadFavorites = useCallback(async () => {
    if (!user) {
      setFavorites(new Set());
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // 1. Cargar desde caché local
      const cached = await storage.getJson<FavoritesCache>(StorageKeys.FAVORITES_CACHE);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setFavorites(new Set(cached.foodIds));
        setLoading(false);
      }

      // 2. Sincronizar con servidor en background
      setSyncing(true);
      const serverRes = await userFavoritesRepository.getAll();
      if (serverRes.ok) {
        const favoritesSet = new Set(serverRes.data);
        setFavorites(favoritesSet);
        
        // Actualizar caché
        await storage.setJson(StorageKeys.FAVORITES_CACHE, {
          foodIds: serverRes.data,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      console.error("[useFavorites] Error loading favorites:", error);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [user]);

  // Cargar al montar y cuando cambia el usuario
  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const toggleFavorite = useCallback(
    async (foodId: string): Promise<boolean> => {
      const isCurrentlyFavorite = favorites.has(foodId);
      const newFavorites = new Set(favorites);

      // Optimistic update
      if (isCurrentlyFavorite) {
        newFavorites.delete(foodId);
      } else {
        newFavorites.add(foodId);
      }
      setFavorites(newFavorites);

      // Actualizar caché local
      await storage.setJson(StorageKeys.FAVORITES_CACHE, {
        foodIds: Array.from(newFavorites),
        timestamp: Date.now(),
      });

      try {
        // Sincronizar con servidor
        if (isCurrentlyFavorite) {
          const res = await userFavoritesRepository.remove(foodId);
          if (!res.ok) {
            // Revertir si falla
            setFavorites(favorites);
            throw new Error(res.message);
          }
          return false;
        } else {
          const res = await userFavoritesRepository.add(foodId);
          if (!res.ok) {
            // Revertir si falla
            setFavorites(favorites);
            throw new Error(res.message);
          }
          return true;
        }
      } catch (error) {
        // Revertir en caso de error
        setFavorites(favorites);
        throw error;
      }
    },
    [favorites],
  );

  const isFavorite = useCallback(
    (foodId: string): boolean => {
      return favorites.has(foodId);
    },
    [favorites],
  );

  // Memoizar el array de favoritos para evitar recreaciones innecesarias
  const favoritesArray = useMemo(() => Array.from(favorites).sort(), [favorites]);

  return {
    favorites: favoritesArray,
    isFavorite,
    toggleFavorite,
    loading,
    syncing,
    refresh: loadFavorites,
  };
}
