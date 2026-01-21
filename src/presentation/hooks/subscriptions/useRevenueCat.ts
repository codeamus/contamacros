// src/presentation/hooks/subscriptions/useRevenueCat.ts
import { AuthService } from "@/domain/services/authService";
import { RevenueCatService } from "@/domain/services/revenueCatService";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useEffect, useState } from "react";

// Tipos locales para evitar importar react-native-purchases en tiempo de carga
type CustomerInfo = {
  entitlements: {
    active: Record<string, any>;
    all: Record<string, any>;
  };
  activeSubscriptions: string[];
  allPurchasedProductIdentifiers: string[];
  latestExpirationDate: string | null;
  firstSeen: string;
  originalAppUserId: string;
  requestDate: string;
};

type PurchasesOffering = {
  identifier: string;
  serverDescription: string;
  availablePackages: PurchasesPackage[];
  metadata: Record<string, any>;
};

type PurchasesPackage = {
  identifier: string;
  packageType: string;
  product: {
    identifier: string;
    description: string;
    title: string;
    price: number;
    priceString: string;
    currencyCode: string;
  };
  storeProduct: {
    identifier: string;
    description: string;
    title: string;
    price: number;
    priceString: string;
    currencyCode: string;
  };
  offeringIdentifier: string;
};

export type SubscriptionStatus = "loading" | "premium" | "free" | "error";

export function useRevenueCat() {
  const { user, profile, refreshProfile } = useAuth();
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [status, setStatus] = useState<SubscriptionStatus>("loading");
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Inicializa RevenueCat y verifica el estado de suscripción
   */
  const initialize = async () => {
    try {
      setStatus("loading");
      setError(null);

      // Inicializar RevenueCat con el userId si está disponible
      const initResult = await RevenueCatService.initialize(user?.id);
      if (!initResult.ok) {
        throw new Error(initResult.message);
      }

      // Obtener información del cliente
      const customerInfoResult = await RevenueCatService.getCustomerInfo();
      if (!customerInfoResult.ok) {
        throw new Error(customerInfoResult.message);
      }

      const info = customerInfoResult.data;
      setCustomerInfo(info);

      // Verificar entitlement
      const entitlementResult = await RevenueCatService.hasProEntitlement();
      if (!entitlementResult.ok) {
        throw new Error(entitlementResult.message);
      }

      const hasEntitlement = entitlementResult.data;
      setIsPremium(hasEntitlement);
      setStatus(hasEntitlement ? "premium" : "free");

      // Sincronizar estado con Supabase (ya se hace en getCustomerInfo y hasProEntitlement)
      // Refrescar perfil local para obtener el estado actualizado
      try {
        await refreshProfile();
      } catch (error) {
        console.warn("[useRevenueCat] No se pudo refrescar perfil:", error);
      }

      // Obtener ofertas disponibles
      const offeringsResult = await RevenueCatService.getOfferings();
      if (offeringsResult.ok && offeringsResult.data) {
        setOfferings(offeringsResult.data);
      }

      console.log("[useRevenueCat] Inicialización completada:", {
        isPremium: hasEntitlement,
        status: hasEntitlement ? "premium" : "free",
      });
    } catch (err) {
      console.error("[useRevenueCat] Error al inicializar:", err);
      setError(err instanceof Error ? err.message : "Error desconocido");
      setStatus("error");
      setIsPremium(false);
    }
  };

  /**
   * Compra un package
   */
  const purchasePackage = async (
    packageToPurchase: PurchasesPackage,
  ): Promise<{ ok: boolean; message?: string }> => {
    try {
      setStatus("loading");
      setError(null);

      const result = await RevenueCatService.purchasePackage(packageToPurchase);

      if (!result.ok) {
        if (result.code === "USER_CANCELLED") {
          setStatus(isPremium ? "premium" : "free");
          return { ok: false, message: "Compra cancelada" };
        }
        throw new Error(result.message);
      }

      // Actualizar estado después de compra exitosa
      const newCustomerInfo = result.data;
      setCustomerInfo(newCustomerInfo);

      const hasEntitlement =
        newCustomerInfo.entitlements.active[
          RevenueCatService.getEntitlementId()
        ] !== undefined;

      setIsPremium(hasEntitlement);
      setStatus(hasEntitlement ? "premium" : "free");

      // Sincronización con Supabase ya se hizo en purchasePackage del servicio
      // Refrescar perfil local
      try {
        await refreshProfile();
      } catch (error) {
        console.warn("[useRevenueCat] No se pudo refrescar perfil después de compra:", error);
      }

      return { ok: true };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error al procesar la compra";
      setError(errorMessage);
      setStatus(isPremium ? "premium" : "free");
      return { ok: false, message: errorMessage };
    }
  };

  /**
   * Restaura compras anteriores
   */
  const restorePurchases = async (): Promise<{ ok: boolean; message?: string }> => {
    try {
      setStatus("loading");
      setError(null);

      const result = await RevenueCatService.restorePurchases();

      if (!result.ok) {
        throw new Error(result.message);
      }

      // Actualizar estado después de restaurar
      const restoredCustomerInfo = result.data;
      setCustomerInfo(restoredCustomerInfo);

      const hasEntitlement =
        restoredCustomerInfo.entitlements.active[
          RevenueCatService.getEntitlementId()
        ] !== undefined;

      setIsPremium(hasEntitlement);
      setStatus(hasEntitlement ? "premium" : "free");

      // Sincronización con Supabase ya se hizo en restorePurchases del servicio
      // Refrescar perfil local
      try {
        await refreshProfile();
      } catch (error) {
        console.warn("[useRevenueCat] No se pudo refrescar perfil después de restaurar:", error);
      }

      return {
        ok: true,
        message: hasEntitlement
          ? "Compras restauradas exitosamente"
          : "No se encontraron compras para restaurar",
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error al restaurar compras";
      setError(errorMessage);
      setStatus(isPremium ? "premium" : "free");
      return { ok: false, message: errorMessage };
    }
  };

  /**
   * Recarga el estado de suscripción
   */
  const reload = async () => {
    await initialize();
  };

  // Inicializar cuando el usuario está disponible
  useEffect(() => {
    if (user?.id) {
      initialize();
    }
  }, [user?.id]);

  return {
    isPremium,
    status,
    customerInfo,
    offerings,
    error,
    purchasePackage,
    restorePurchases,
    reload,
  };
}
