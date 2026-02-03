// src/presentation/hooks/premium/useFeatureAccess.ts
import { userFoodsRepository } from "@/data/food/userFoodsRepository";
import { UsageService } from "@/domain/services/usageService";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useCallback, useState } from "react";

export type FeatureName = "barcode" | "recipe" | "ai" | "history";

export type FeatureAccess = {
  canAccess: boolean;
  limitReached: boolean;
  currentUsage: number;
  limit: number;
};

const LIMITS = {
  barcode: 5,
  recipe: 5,
  ai: 1,
  history: 7, // días
};

export function useFeatureAccess() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);

  const checkAccess = useCallback(async (feature: FeatureName): Promise<FeatureAccess> => {
    if (profile?.is_premium) {
      return { canAccess: true, limitReached: false, currentUsage: 0, limit: Infinity };
    }

    setLoading(true);
    try {
      if (feature === "recipe") {
        const recipesRes = await userFoodsRepository.listAll();
        const recipesCount = recipesRes.ok ? recipesRes.data.filter(f => f.category === "receta").length : 0;
        return {
          canAccess: recipesCount < LIMITS.recipe,
          limitReached: recipesCount >= LIMITS.recipe,
          currentUsage: recipesCount,
          limit: LIMITS.recipe
        };
      }

      const statsRes = await UsageService.getUsageStats();
      if (!statsRes.ok || !statsRes.data) {
        console.warn("[useFeatureAccess] ⚠️ Fallback safe triggered:", { 
          ok: statsRes.ok, 
          message: !statsRes.ok ? statsRes.message : "No data",
          feature 
        });
        // Fallback safe
        return { canAccess: true, limitReached: false, currentUsage: 0, limit: LIMITS[feature] };
      }

      const stats = statsRes.data;
      let currentUsage = 0;
      let limit = LIMITS[feature];

      switch (feature) {
        case "barcode":
          currentUsage = stats.daily_scan_count;
          break;
        case "ai":
          currentUsage = stats.total_ai_scans;
          break;
        case "history":
          currentUsage = 0; // Se maneja en la UI filtrando fechas
          break;
      }

      return {
        canAccess: currentUsage < limit,
        limitReached: currentUsage >= limit,
        currentUsage,
        limit
      };
    } finally {
      setLoading(false);
    }
  }, [profile]);

  return { checkAccess, loading };
}
