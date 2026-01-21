// src/domain/services/revenueCatService.ts
import { AuthService } from "./authService";
import { supabase } from "@/data/supabase/supabaseClient";
import { Platform } from "react-native";

const REVENUECAT_API_KEY = "appl_YefJRBImlNCzKtxjKjWOtrUMsSo";
const ENTITLEMENT_ID = "ContaMacros Pro";

// Importación lazy de RevenueCat para evitar errores en web/desarrollo
let Purchases: any = null;
let PurchasesTypes: any = null;

async function getPurchases() {
  if (Purchases) return Purchases;
  
  // Solo importar en plataformas nativas
  if (Platform.OS === "ios" || Platform.OS === "android") {
    try {
      const PurchasesModule = await import("react-native-purchases");
      Purchases = PurchasesModule.default;
      PurchasesTypes = PurchasesModule;
      return Purchases;
    } catch (error) {
      console.warn("[RevenueCat] No se pudo importar react-native-purchases:", error);
      return null;
    }
  }
  return null;
}

type CustomerInfo = any;
type PurchasesOffering = any;
type PurchasesPackage = any;
type PurchasesStoreProduct = any;

export type RevenueCatResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string };

/**
 * Servicio para manejar suscripciones con RevenueCat
 */
export const RevenueCatService = {
  /**
   * Inicializa RevenueCat SDK
   */
  async initialize(userId?: string): Promise<RevenueCatResult<void>> {
    try {
      const PurchasesModule = await getPurchases();
      if (!PurchasesModule) {
        return {
          ok: false,
          message: "RevenueCat no está disponible en esta plataforma",
        };
      }

      const apiKey =
        Platform.OS === "ios"
          ? REVENUECAT_API_KEY
          : REVENUECAT_API_KEY; // Puedes usar diferentes keys para iOS/Android si es necesario

      await PurchasesModule.configure({ apiKey });

      // Si hay un userId, identificarlo con RevenueCat
      if (userId) {
        await PurchasesModule.logIn(userId);
      }

      console.log("[RevenueCat] SDK inicializado correctamente");
      return { ok: true, data: undefined };
    } catch (error) {
      console.error("[RevenueCat] Error al inicializar:", error);
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : "Error al inicializar RevenueCat",
      };
    }
  },

  /**
   * Sincroniza el estado de premium con Supabase
   */
  async syncPremiumStatusWithSupabase(
    customerInfo: CustomerInfo,
  ): Promise<void> {
    try {
      // Verificar si el entitlement está activo
      const hasEntitlement =
        customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;

      // Obtener userId de la sesión actual
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;

      if (!userId) {
        console.warn("[RevenueCat] No hay userId disponible para sincronizar estado premium");
        return;
      }

      // Actualizar Supabase directamente usando supabase client
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ is_premium: hasEntitlement })
        .eq("id", userId);

      if (updateError) {
        console.warn(
          "[RevenueCat] Error al actualizar is_premium en Supabase:",
          updateError.message,
        );
        
        // Fallback: intentar con AuthService
        const result = await AuthService.updateMyProfile({
          is_premium: hasEntitlement,
        });
        
        if (result.ok) {
          console.log("[RevenueCat] Estado premium sincronizado con Supabase (fallback):", {
            is_premium: hasEntitlement,
            entitlement: ENTITLEMENT_ID,
          });
        }
      } else {
        console.log("[RevenueCat] ✅ Estado premium sincronizado con Supabase:", {
          is_premium: hasEntitlement,
          entitlement: ENTITLEMENT_ID,
          userId: userId.substring(0, 8) + "...",
        });
      }
    } catch (error) {
      console.error(
        "[RevenueCat] Error al sincronizar estado premium con Supabase:",
        error,
      );
      // No lanzar error, solo loguear - esto no debe bloquear el flujo principal
    }
  },

  /**
   * Obtiene la información del cliente
   */
  async getCustomerInfo(): Promise<RevenueCatResult<CustomerInfo>> {
    try {
      const PurchasesModule = await getPurchases();
      if (!PurchasesModule) {
        return {
          ok: false,
          message: "RevenueCat no está disponible en esta plataforma",
        };
      }

      const customerInfo = await PurchasesModule.getCustomerInfo();
      console.log("[RevenueCat] Customer info obtenida:", {
        entitlements: Object.keys(customerInfo.entitlements.active),
        activeSubscriptions: customerInfo.activeSubscriptions,
      });

      // Sincronizar estado con Supabase
      await this.syncPremiumStatusWithSupabase(customerInfo);

      return { ok: true, data: customerInfo };
    } catch (error) {
      console.error("[RevenueCat] Error al obtener customer info:", error);
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Error al obtener información del cliente",
      };
    }
  },

  /**
   * Verifica si el usuario tiene el entitlement "ContaMacros Pro"
   */
  async hasProEntitlement(): Promise<RevenueCatResult<boolean>> {
    try {
      const PurchasesModule = await getPurchases();
      if (!PurchasesModule) {
        return { ok: true, data: false }; // En web/dev, retornar false sin error
      }

      const customerInfo = await PurchasesModule.getCustomerInfo();
      const hasEntitlement =
        customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;

      console.log("[RevenueCat] Verificación de entitlement:", {
        entitlement: ENTITLEMENT_ID,
        hasEntitlement,
        activeEntitlements: Object.keys(customerInfo.entitlements.active),
      });

      // Sincronizar estado con Supabase cuando se verifica el entitlement
      await this.syncPremiumStatusWithSupabase(customerInfo);

      return { ok: true, data: hasEntitlement };
    } catch (error) {
      console.error("[RevenueCat] Error al verificar entitlement:", error);
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Error al verificar suscripción premium",
      };
    }
  },

  /**
   * Obtiene las ofertas disponibles (packages)
   */
  async getOfferings(): Promise<RevenueCatResult<PurchasesOffering | null>> {
    try {
      const PurchasesModule = await getPurchases();
      if (!PurchasesModule) {
        return { ok: true, data: null }; // En web/dev, retornar null sin error
      }

      const offerings = await PurchasesModule.getOfferings();
      
      // Log detallado para debug
      console.log("[RevenueCat] Offerings obtenidos del SDK:", {
        allOfferings: Object.keys(offerings.all || {}),
        currentOfferingId: offerings.current?.identifier,
        defaultOfferingId: offerings.all?.["default"]?.identifier,
        hasCurrent: !!offerings.current,
        hasDefault: !!offerings.all?.["default"],
      });
      
      // Log más detallado solo si no hay offerings (para debugging)
      if (!offerings.current && !offerings.all?.["default"]) {
        console.log("[RevenueCat] 🔍 Debug completo de offerings:", JSON.stringify(offerings, null, 2));
      }

      // Buscar específicamente el offering 'default'
      const defaultOffering = offerings.all?.["default"] || offerings.current;

      if (!defaultOffering) {
        console.warn("[RevenueCat] ⚠️ No hay ofertas disponibles (default o current)");
        console.log("[RevenueCat] ℹ️ Verificando productos del StoreKit local...");
        console.log("[RevenueCat] 📋 Estado de offerings:", {
          hasAll: !!offerings.all,
          allKeys: Object.keys(offerings.all || {}),
          hasCurrent: !!offerings.current,
          currentId: offerings.current?.identifier,
          platform: Platform.OS,
        });
        console.log("[RevenueCat] 💡 Solución:");
        console.log("[RevenueCat]   1. Asegúrate de que el archivo ContaMacros.storekit esté en el proyecto");
        console.log("[RevenueCat]   2. En Xcode: Product → Scheme → Edit Scheme → Run → Options");
        console.log("[RevenueCat]   3. Selecciona 'ContaMacros.storekit' en StoreKit Configuration");
        console.log("[RevenueCat]   4. Ejecuta la app desde Xcode (no desde Expo CLI)");
        return { ok: true, data: null };
      }

      // Filtrar paquetes que tienen un product válido (product o storeProduct)
      // En algunos casos storeProduct puede ser null pero product tiene los datos
      const validPackages = defaultOffering.availablePackages.filter(
        (pkg: any) => pkg.product != null || pkg.storeProduct != null
      );

      console.log("[RevenueCat] Ofertas obtenidas:", {
        offeringIdentifier: defaultOffering.identifier,
        availablePackages: defaultOffering.availablePackages.length,
        validPackages: validPackages.length,
        packages: validPackages.map((pkg: any) => ({
          identifier: pkg.identifier,
          productId: pkg.product?.identifier || pkg.storeProduct?.identifier,
          price: pkg.product?.priceString || pkg.storeProduct?.priceString,
          currencyCode: pkg.product?.currencyCode || pkg.storeProduct?.currencyCode,
          hasProduct: !!pkg.product,
          hasStoreProduct: !!pkg.storeProduct,
          // Verificar si coincide con los IDs esperados
          isContamacrosMonth: (pkg.product?.identifier || pkg.storeProduct?.identifier) === "contamacros_month",
          isContamacrosYearly: (pkg.product?.identifier || pkg.storeProduct?.identifier) === "contamacros_yearly",
        })),
      });

      return { ok: true, data: defaultOffering };
    } catch (error: any) {
      // Manejar error específico de configuración de productos
      const errorMessage = error?.message || "Error al obtener ofertas";
      const isConfigurationError = 
        errorMessage.includes("configuration") ||
        errorMessage.includes("could not be fetched") ||
        errorMessage.includes("StoreKit Configuration");

      if (isConfigurationError) {
        console.error("[RevenueCat] ⚠️ Error de configuración de productos:", errorMessage);
        console.log("[RevenueCat] 🔧 Pasos para solucionar:");
        console.log("[RevenueCat]   1. Verifica que el archivo 'ContaMacros.storekit' esté en la raíz del proyecto");
        console.log("[RevenueCat]   2. Ejecuta: npx expo prebuild --platform ios");
        console.log("[RevenueCat]   3. Abre el proyecto en Xcode: open ios/ContaMacros.xcworkspace");
        console.log("[RevenueCat]   4. En Xcode: Product → Scheme → Edit Scheme (⌘<)");
        console.log("[RevenueCat]   5. Selecciona 'Run' → pestaña 'Options'");
        console.log("[RevenueCat]   6. En 'StoreKit Configuration', selecciona 'ContaMacros.storekit'");
        console.log("[RevenueCat]   7. Ejecuta la app desde Xcode (⌘R), NO desde Expo CLI");
        console.log("[RevenueCat] 📋 Product IDs esperados:");
        console.log("[RevenueCat]   - contamacros_month (Plan Mensual)");
        console.log("[RevenueCat]   - contamacros_yearly (Plan Anual)");
        console.log("[RevenueCat] 📖 Más info: https://rev.cat/why-are-offerings-empty");
        
        return {
          ok: false,
          message: `Error de configuración: Los productos no se pueden obtener. Para desarrollo, configura StoreKit Configuration en Xcode. Ver consola para instrucciones detalladas.`,
          code: "CONFIGURATION_ERROR",
        };
      }

      console.error("[RevenueCat] Error al obtener ofertas:", error);
      return {
        ok: false,
        message: errorMessage,
        code: error?.code,
      };
    }
  },

  /**
   * Compra un package
   */
  async purchasePackage(
    packageToPurchase: PurchasesPackage,
  ): Promise<RevenueCatResult<CustomerInfo>> {
    try {
      const PurchasesModule = await getPurchases();
      if (!PurchasesModule) {
        return {
          ok: false,
          message: "RevenueCat no está disponible en esta plataforma",
        };
      }

      // Validar que el package tenga la estructura correcta
      if (!packageToPurchase) {
        throw new Error("Package no válido: objeto undefined");
      }

      const productId = packageToPurchase.product?.identifier || packageToPurchase.storeProduct?.identifier;
      if (!productId) {
        throw new Error("Package no válido: no se encontró productId");
      }

      console.log("[RevenueCat] Iniciando compra:", {
        identifier: packageToPurchase.identifier,
        productId: productId,
        hasProduct: !!packageToPurchase.product,
        hasStoreProduct: !!packageToPurchase.storeProduct,
      });

      const { customerInfo } = await PurchasesModule.purchasePackage(
        packageToPurchase,
      );

      console.log("[RevenueCat] Compra exitosa:", {
        entitlements: Object.keys(customerInfo.entitlements.active),
      });

      // Sincronizar estado con Supabase después de compra exitosa
      await this.syncPremiumStatusWithSupabase(customerInfo);

      return { ok: true, data: customerInfo };
    } catch (error: any) {
      // RevenueCat lanza errores especiales para cancelaciones de usuario
      // Esto es normal y esperado - no es un error real
      if (error.userCancelled || error.code === "USER_CANCELLED") {
        console.log("[RevenueCat] ℹ️ Compra cancelada por el usuario (comportamiento normal)");
        return {
          ok: false,
          message: "Compra cancelada",
          code: "USER_CANCELLED",
        };
      }

      // Solo loguear como error si NO es una cancelación
      console.error("[RevenueCat] ❌ Error real al comprar:", error);
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : "Error al procesar la compra",
        code: error.code,
      };
    }
  },

  /**
   * Restaura compras anteriores
   */
  async restorePurchases(): Promise<RevenueCatResult<CustomerInfo>> {
    try {
      const PurchasesModule = await getPurchases();
      if (!PurchasesModule) {
        return {
          ok: false,
          message: "RevenueCat no está disponible en esta plataforma",
        };
      }

      console.log("[RevenueCat] Restaurando compras...");
      const customerInfo = await PurchasesModule.restorePurchases();

      console.log("[RevenueCat] Compras restauradas:", {
        entitlements: Object.keys(customerInfo.entitlements.active),
      });

      // Sincronizar estado con Supabase después de restaurar compras
      await this.syncPremiumStatusWithSupabase(customerInfo);

      return { ok: true, data: customerInfo };
    } catch (error) {
      console.error("[RevenueCat] Error al restaurar compras:", error);
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Error al restaurar compras",
      };
    }
  },

  /**
   * Identifica al usuario con RevenueCat (útil para sincronizar entre dispositivos)
   */
  async identifyUser(userId: string): Promise<RevenueCatResult<void>> {
    try {
      const PurchasesModule = await getPurchases();
      if (!PurchasesModule) {
        return {
          ok: false,
          message: "RevenueCat no está disponible en esta plataforma",
        };
      }

      await PurchasesModule.logIn(userId);
      console.log("[RevenueCat] Usuario identificado:", userId);
      return { ok: true, data: undefined };
    } catch (error) {
      console.error("[RevenueCat] Error al identificar usuario:", error);
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Error al identificar usuario",
      };
    }
  },

  /**
   * Cierra sesión del usuario en RevenueCat
   */
  async logout(): Promise<RevenueCatResult<void>> {
    try {
      const PurchasesModule = await getPurchases();
      if (!PurchasesModule) {
        return { ok: true, data: undefined }; // En web/dev, retornar éxito sin hacer nada
      }

      await PurchasesModule.logOut();
      console.log("[RevenueCat] Usuario deslogueado");
      return { ok: true, data: undefined };
    } catch (error) {
      console.error("[RevenueCat] Error al cerrar sesión:", error);
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : "Error al cerrar sesión",
      };
    }
  },

  /**
   * Obtiene el entitlement ID usado en la app
   */
  getEntitlementId(): string {
    return ENTITLEMENT_ID;
  },
};
