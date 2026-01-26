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
    // Siempre intentar cargar desde caché primero, incluso si no hay usuario
    // Esto permite mostrar favoritos mientras se autentica
    try {
      const cached = await storage.getJson<FavoritesCache>(StorageKeys.FAVORITES_CACHE);
      if (cached && cached.foodIds && cached.foodIds.length > 0) {
        // Mostrar caché inmediatamente
        setFavorites(new Set(cached.foodIds));
        setLoading(false);
      } else {
        setLoading(true);
      }
    } catch (error) {
      console.error("[useFavorites] Error loading from cache:", error);
      setLoading(true);
    }

    // Si no hay usuario, mantener el caché pero no sincronizar
    if (!user) {
      // Ya cargamos desde caché arriba, solo asegurarnos de que loading esté en false
      setLoading(false);
      setSyncing(false);
      return;
    }

    // Sincronizar con servidor en background
    try {
      setSyncing(true);
      const serverRes = await userFavoritesRepository.getAll();
      if (serverRes.ok) {
        const favoritesSet = new Set(serverRes.data);
        setFavorites(favoritesSet);
        
        // Actualizar caché siempre con los datos del servidor
        await storage.setJson(StorageKeys.FAVORITES_CACHE, {
          foodIds: serverRes.data,
          timestamp: Date.now(),
        });
      } else {
        // Si falla el servidor, mantener el caché que ya cargamos
        console.warn("[useFavorites] Error al sincronizar con servidor:", serverRes.message);
        // No limpiar favoritos, mantener el caché
      }
    } catch (error) {
      console.error("[useFavorites] Error syncing with server:", error);
      // Mantener el caché que ya cargamos
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
      const previousFavorites = new Set(favorites); // Guardar estado anterior para revertir

      // Optimistic update
      if (isCurrentlyFavorite) {
        newFavorites.delete(foodId);
      } else {
        newFavorites.add(foodId);
      }
      setFavorites(newFavorites);

      // Actualizar caché local INMEDIATAMENTE (antes de sincronizar con servidor)
      // Esto asegura que el caché persista incluso si falla la sincronización
      const newFavoritesArray = Array.from(newFavorites);
      await storage.setJson(StorageKeys.FAVORITES_CACHE, {
        foodIds: newFavoritesArray,
        timestamp: Date.now(),
      });

      try {
        // Sincronizar con servidor
        if (isCurrentlyFavorite) {
          const res = await userFavoritesRepository.remove(foodId);
          if (!res.ok) {
            // Revertir estado y caché si falla
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
            // Revertir estado y caché si falla
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
        // Si hay un error de red pero el caché ya se guardó, mantener el caché
        // Solo revertir si es un error de validación del servidor
        if (error instanceof Error && error.message.includes("violates")) {
          // Error de RLS u otro error del servidor, revertir
          setFavorites(previousFavorites);
          await storage.setJson(StorageKeys.FAVORITES_CACHE, {
            foodIds: Array.from(previousFavorites),
            timestamp: Date.now(),
          });
        }
        // Si es un error de red, mantener el estado optimista y el caché
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
