// src/presentation/hooks/food/useFavorites.ts
import { type ScannedFavoriteInput, userFavoritesRepository } from "@/data/food/userFavoritesRepository";
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

  const loadFavorites = useCallback(async () => {
    try {
      const cached = await storage.getJson<FavoritesCache>(StorageKeys.FAVORITES_CACHE);
      if (cached && cached.foodIds && cached.foodIds.length > 0) {
        setFavorites(new Set(cached.foodIds));
        setLoading(false);
      } else {
        setLoading(true);
      }
    } catch (error) {
      console.error("[useFavorites] Error loading from cache:", error);
      setLoading(true);
    }

    if (!user) {
      setLoading(false);
      setSyncing(false);
      return;
    }

    try {
      setSyncing(true);
      // getAll ahora devuelve tanto food_ids como barcodes
      const serverRes = await userFavoritesRepository.getAll();
      if (serverRes.ok) {
        const favoritesSet = new Set(serverRes.data);
        setFavorites(favoritesSet);
        await storage.setJson(StorageKeys.FAVORITES_CACHE, {
          foodIds: serverRes.data,
          timestamp: Date.now(),
        });
      } else {
        console.warn("[useFavorites] Error al sincronizar con servidor:", serverRes.message);
      }
    } catch (error) {
      console.error("[useFavorites] Error syncing with server:", error);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [user]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  /**
   * Toggle favorito para alimentos de generic_foods (tienen food_id)
   */
  const toggleFavorite = useCallback(
    async (foodId: string): Promise<boolean> => {
      const isCurrentlyFavorite = favorites.has(foodId);
      const newFavorites = new Set(favorites);
      const previousFavorites = new Set(favorites);

      if (isCurrentlyFavorite) {
        newFavorites.delete(foodId);
      } else {
        newFavorites.add(foodId);
      }
      setFavorites(newFavorites);

      const newFavoritesArray = Array.from(newFavorites);
      await storage.setJson(StorageKeys.FAVORITES_CACHE, {
        foodIds: newFavoritesArray,
        timestamp: Date.now(),
      });

      try {
        if (isCurrentlyFavorite) {
          const res = await userFavoritesRepository.remove(foodId);
          if (!res.ok) {
            setFavorites(previousFavorites);
            await storage.setJson(StorageKeys.FAVORITES_CACHE, {
              foodIds: Array.from(previousFavorites),
              timestamp: Date.now(),
            });
            throw new Error(res.message);
          }
          return false;
        } else {
          const res = await userFavoritesRepository.add(foodId);
          if (!res.ok) {
            setFavorites(previousFavorites);
            await storage.setJson(StorageKeys.FAVORITES_CACHE, {
              foodIds: Array.from(previousFavorites),
              timestamp: Date.now(),
            });
            throw new Error(res.message);
          }
          return true;
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("violates")) {
          setFavorites(previousFavorites);
          await storage.setJson(StorageKeys.FAVORITES_CACHE, {
            foodIds: Array.from(previousFavorites),
            timestamp: Date.now(),
          });
        }
        throw error;
      }
    },
    [favorites],
  );

  /**
   * Toggle favorito para productos escaneados (OFF/AI) sin food_id.
   * Usa barcode o name como identificador en el Set.
   */
  const toggleScannedFavorite = useCallback(
    async (product: ScannedFavoriteInput): Promise<boolean> => {
      const identifier = product.barcode ?? product.name;
      const isCurrentlyFavorite = favorites.has(identifier);
      const newFavorites = new Set(favorites);
      const previousFavorites = new Set(favorites);

      if (isCurrentlyFavorite) {
        newFavorites.delete(identifier);
      } else {
        newFavorites.add(identifier);
      }
      setFavorites(newFavorites);

      const newFavoritesArray = Array.from(newFavorites);
      await storage.setJson(StorageKeys.FAVORITES_CACHE, {
        foodIds: newFavoritesArray,
        timestamp: Date.now(),
      });

      try {
        if (isCurrentlyFavorite) {
          const res = await userFavoritesRepository.remove(identifier);
          if (!res.ok) {
            setFavorites(previousFavorites);
            await storage.setJson(StorageKeys.FAVORITES_CACHE, {
              foodIds: Array.from(previousFavorites),
              timestamp: Date.now(),
            });
            throw new Error(res.message);
          }
          return false;
        } else {
          const res = await userFavoritesRepository.addScanned(product);
          if (!res.ok) {
            setFavorites(previousFavorites);
            await storage.setJson(StorageKeys.FAVORITES_CACHE, {
              foodIds: Array.from(previousFavorites),
              timestamp: Date.now(),
            });
            throw new Error(res.message);
          }
          return true;
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("violates")) {
          setFavorites(previousFavorites);
          await storage.setJson(StorageKeys.FAVORITES_CACHE, {
            foodIds: Array.from(previousFavorites),
            timestamp: Date.now(),
          });
        }
        throw error;
      }
    },
    [favorites],
  );

  const isFavorite = useCallback(
    (identifier: string): boolean => {
      return favorites.has(identifier);
    },
    [favorites],
  );

  const favoritesArray = useMemo(() => Array.from(favorites).sort(), [favorites]);

  return {
    favorites: favoritesArray,
    isFavorite,
    toggleFavorite,
    toggleScannedFavorite,
    loading,
    syncing,
    refresh: loadFavorites,
  };
}
