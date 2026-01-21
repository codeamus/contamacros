// src/presentation/hooks/subscriptions/usePremium.ts
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useRevenueCat } from "@/presentation/hooks/subscriptions/useRevenueCat";

/**
 * Hook helper para obtener el estado premium de manera consistente
 * Prioriza RevenueCat (fuente de verdad) sobre profile.is_premium
 */
export function usePremium() {
  const { profile } = useAuth();
  const { isPremium: revenueCatPremium } = useRevenueCat();
  const profilePremium = profile?.is_premium ?? false;
  
  // RevenueCat tiene prioridad como fuente de verdad
  // pero mantenemos compatibilidad con profile.is_premium para transición
  const isPremium = revenueCatPremium || profilePremium;
  
  return {
    isPremium,
    source: revenueCatPremium ? "revenuecat" : profilePremium ? "profile" : "none",
  };
}
