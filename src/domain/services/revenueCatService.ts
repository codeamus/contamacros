// src/domain/services/revenueCatService.ts
import { supabase } from "@/data/supabase/supabaseClient";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { AuthService } from "./authService";

const ENTITLEMENT_ID = "ContaMacros Pro";

// Importación lazy de RevenueCat para evitar errores en web/desarrollo
let Purchases: any = null;
let configured = false;
let configuredMaskedKey: string | null = null;
let configuring: Promise<void> | null = null;

type NativePlatform = "ios" | "android";
type RevenueCatKeySelection = {
  platform: NativePlatform;
  varName: "REVENUECAT_APPLE_API_KEY" | "REVENUECAT_ANDROID_API_KEY";
  expectedPrefix: "appl_" | "goog_";
  apiKey: string;
  source: "expoConfig.extra" | "process.env";
};

function maskKey(key: string) {
  const k = (key ?? "").trim();
  if (!k) return "";
  const knownPrefix =
    k.startsWith("appl_") || k.startsWith("goog_") ? k.slice(0, 5) : k.slice(0, 4);
  const tail = k.slice(-4);
  return `${knownPrefix}****${tail}`;
}

function readExtraString(key: string): string | undefined {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const v = extra[key];
  return typeof v === "string" ? v : undefined;
}

function getNativePlatform(): NativePlatform {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  throw new Error("RevenueCat no está soportado en esta plataforma.");
}

/**
 * Selecciona la API key correcta por plataforma.
 *
 * Orden de lectura:
 * 1) `Constants.expoConfig.extra`
 * 2) `process.env`
 *
 * Valida presencia (fuerte) y advierte si el prefijo no coincide.
 * NO imprime la key completa en logs.
 */
function getRevenueCatApiKey(): RevenueCatKeySelection {
  const platform = getNativePlatform();
  const varName =
    platform === "ios" ? "REVENUECAT_APPLE_API_KEY" : "REVENUECAT_ANDROID_API_KEY";
  const expectedPrefix = platform === "ios" ? "appl_" : "goog_";

  const fromExtra = readExtraString(varName);
  const fromEnv = (process.env?.[varName] as string | undefined) ?? undefined;

  const apiKey = (fromExtra ?? fromEnv ?? "").trim();
  const source: RevenueCatKeySelection["source"] = fromExtra
    ? "expoConfig.extra"
    : "process.env";

  if (!apiKey) {
    throw new Error(`Missing ${varName}`);
  }

  if (!apiKey.startsWith(expectedPrefix)) {
    console.warn(
      `[RevenueCat] ⚠️ La key ${varName} no tiene el prefijo esperado (${expectedPrefix}). key=${maskKey(
        apiKey,
      )}`,
    );
  }

  return { platform, varName, expectedPrefix, apiKey, source };
}

async function ensureConfigured(
  PurchasesModule: any,
  knownIsConfigured?: boolean | "unknown",
): Promise<void> {
  if (configured) return;
  if (configuring) return configuring;

  configuring = (async () => {
    const selection = getRevenueCatApiKey();
    const masked = maskKey(selection.apiKey);

    // Si el SDK expone isConfigured, respetarlo.
    let sdkConfigured: boolean | "unknown" =
      knownIsConfigured ?? "unknown";
    if (sdkConfigured === "unknown" && typeof PurchasesModule.isConfigured === "function") {
      sdkConfigured = await PurchasesModule.isConfigured();
    }

    if (sdkConfigured === true) {
      configured = true;
      configuredMaskedKey = configuredMaskedKey ?? "(unknown)";
      console.log(
        "[RevenueCat] SDK ya estaba configurado:",
        `platform=${selection.platform} key=${masked} source=${selection.source}`,
      );
      return;
    }

    await PurchasesModule.configure({ apiKey: selection.apiKey });
    configured = true;
    configuredMaskedKey = masked;
    console.log(
      "[RevenueCat] SDK configurado:",
      `platform=${selection.platform} key=${masked} source=${selection.source}`,
    );
  })();

  try {
    await configuring;
  } finally {
    configuring = null;
  }
}

async function getPurchases() {
  if (Purchases) return Purchases;

  // Solo importar en plataformas nativas
  if (Platform.OS === "ios" || Platform.OS === "android") {
    try {
      const PurchasesModule = await import("react-native-purchases");
      Purchases = PurchasesModule.default;
      return Purchases;
    } catch (error) {
      console.warn(
        "[RevenueCat] No se pudo importar react-native-purchases:",
        error,
      );
      return null;
    }
  }
  return null;
}

type CustomerInfo = any;
type PurchasesOffering = any;
type PurchasesPackage = any;

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
        if (Platform.OS === "android") {
          console.error(
            "[RevenueCat] Por favor, verifica los IDs en Google Play Console y que tienes License Testing configurado correctamente para licencias de prueba.",
          );
        } else if (Platform.OS === "ios") {
          console.error(
            "[RevenueCat] Por favor, verifica tu archivo StoreKit y configuración en App Store Connect.",
          );
        }
        return {
          ok: false,
          message: "RevenueCat no está disponible en esta plataforma",
        };
      }

      const selection = getRevenueCatApiKey();
      const androidApplicationId = Constants.expoConfig?.android?.package;
      const iosBundleId = Constants.expoConfig?.ios?.bundleIdentifier;
      console.log(
        "[RevenueCat] initialize:",
        `platform=${selection.platform} key=${maskKey(selection.apiKey)} package=${androidApplicationId ?? "—"} bundleId=${iosBundleId ?? "—"}`,
      );

      await ensureConfigured(PurchasesModule);

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
          error instanceof Error
            ? error.message
            : "Error al inicializar RevenueCat",
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
        console.warn(
          "[RevenueCat] No hay userId disponible para sincronizar estado premium",
        );
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
          console.log(
            "[RevenueCat] Estado premium sincronizado con Supabase (fallback):",
            {
              is_premium: hasEntitlement,
              entitlement: ENTITLEMENT_ID,
            },
          );
        }
      } else {
        console.log(
          "[RevenueCat] ✅ Estado premium sincronizado con Supabase:",
          {
            is_premium: hasEntitlement,
            entitlement: ENTITLEMENT_ID,
            userId: userId.substring(0, 8) + "...",
          },
        );
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
      console.log("[RevenueCat] Buscando ofertas para el paquete: Default");

      const PurchasesModule = await getPurchases();
      if (!PurchasesModule) {
        return { ok: true, data: null }; // En web/dev, retornar null sin error
      }

      // Validar que el SDK esté configurado antes de consultar offerings
      // (en algunos flujos, getOfferings puede llamarse antes de initialize()).
      let isConfigured: boolean | "unknown" = "unknown";
      if (typeof PurchasesModule.isConfigured === "function") {
        isConfigured = await PurchasesModule.isConfigured();
        console.log("[RevenueCat] ¿Está configurado?:", isConfigured);
      } else {
        console.log(
          "[RevenueCat] ¿Está configurado?:",
          "unknown (SDK no expone isConfigured())",
        );
      }

      // Imprimir el applicationId/bundleId que debería estar usando el SDK (según config nativa)
      const androidApplicationId = Constants.expoConfig?.android?.package;
      const iosBundleId = Constants.expoConfig?.ios?.bundleIdentifier;
      console.log(
        "[RevenueCat] applicationId (android.package):",
        androidApplicationId,
      );
      console.log(
        "[RevenueCat] bundleIdentifier (ios.bundleIdentifier):",
        iosBundleId,
      );

      // Asegurar configuración (sin hardcode de keys, idempotente).
      if (isConfigured === false) {
        console.warn(
          "[RevenueCat] SDK no estaba configurado. Configurando antes de getOfferings()...",
        );
      }
      await ensureConfigured(PurchasesModule, isConfigured);
      if (typeof PurchasesModule.isConfigured === "function") {
        const configuredNow = await PurchasesModule.isConfigured();
        console.log(
          "[RevenueCat] ¿Está configurado? (post-ensure):",
          configuredNow,
        );
      } else {
        console.log(
          "[RevenueCat] ¿Está configurado? (post-ensure):",
          configured ? true : "unknown",
        );
      }

      const offerings = await PurchasesModule.getOfferings();
      console.log("[RevenueCat] Offerings recuperados:", offerings.current);

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
        console.log(
          "[RevenueCat] 🔍 Debug completo de offerings:",
          JSON.stringify(offerings, null, 2),
        );
      }

      // Buscar específicamente el offering 'default'
      const defaultOffering = offerings.all?.["default"] || offerings.current;

      if (!defaultOffering) {
        console.warn(
          "[RevenueCat] ⚠️ No hay ofertas disponibles (default o current)",
        );
        console.log("[RevenueCat] 📋 Estado de offerings:", {
          hasAll: !!offerings.all,
          allKeys: Object.keys(offerings.all || {}),
          hasCurrent: !!offerings.current,
          currentId: offerings.current?.identifier,
          platform: Platform.OS,
        });
        console.log("[RevenueCat] 💡 Solución:");
        if (Platform.OS === "android") {
          console.log(
            "[RevenueCat]   1. Verifica que el applicationId (android.package en app.json) sea com.codeamusdev2.contamacro y que coincida EXACTO con tu app en Google Play Console",
          );
          console.log(
            "[RevenueCat]   2. Verifica que los IDs de producto en Google Play Console coincidan con los configurados en RevenueCat (ej: los que terminan en :premium-mensual-2026)",
          );
          console.log(
            "[RevenueCat]   3. Comprobar que el correo del probador esté en 'License Testing' de la Play Console",
          );
          console.log(
            "[RevenueCat]   4. Asegúrate de probar en un build instalado (dev-client / release), no en Expo Go",
          );
        } else if (Platform.OS === "ios") {
          console.log(
            "[RevenueCat] ℹ️ Verificando productos del StoreKit local...",
          );
          console.log(
            "[RevenueCat]   1. Asegúrate de que el archivo ContaMacros.storekit esté en el proyecto",
          );
          console.log(
            "[RevenueCat]   2. En Xcode: Product → Scheme → Edit Scheme → Run → Options",
          );
          console.log(
            "[RevenueCat]   3. Selecciona 'ContaMacros.storekit' en StoreKit Configuration",
          );
          console.log(
            "[RevenueCat]   4. Ejecuta la app desde Xcode (no desde Expo CLI)",
          );
        } else {
          console.log(
            "[RevenueCat]   - Esta plataforma no soporta compras in-app con RevenueCat.",
          );
        }
        return { ok: true, data: null };
      }

      // Filtrar paquetes que tienen un product válido (product o storeProduct)
      // En algunos casos storeProduct puede ser null pero product tiene los datos
      const validPackages = defaultOffering.availablePackages.filter(
        (pkg: any) => pkg.product != null || pkg.storeProduct != null,
      );

      console.log("[RevenueCat] Ofertas obtenidas:", {
        offeringIdentifier: defaultOffering.identifier,
        availablePackages: defaultOffering.availablePackages.length,
        validPackages: validPackages.length,
        packages: validPackages.map((pkg: any) => ({
          identifier: pkg.identifier,
          productId: pkg.product?.identifier || pkg.storeProduct?.identifier,
          price: pkg.product?.priceString || pkg.storeProduct?.priceString,
          currencyCode:
            pkg.product?.currencyCode || pkg.storeProduct?.currencyCode,
          hasProduct: !!pkg.product,
          hasStoreProduct: !!pkg.storeProduct,
          // Verificar si coincide con los IDs esperados
          isContamacrosMonth:
            (pkg.product?.identifier || pkg.storeProduct?.identifier) ===
            "contamacros_month",
          isContamacrosYearly:
            (pkg.product?.identifier || pkg.storeProduct?.identifier) ===
            "contamacros_yearly",
        })),
      });

      return { ok: true, data: defaultOffering };
    } catch (error: any) {
      try {
        console.log(
          "[RevenueCat] Error Completo:",
          JSON.stringify(error, null, 2),
        );
      } catch {
        console.log("[RevenueCat] Error Completo:", String(error));
      }

      // Señales útiles en Android (ej: cache / cancelación / error subyacente)
      try {
        const userCancelled =
          error?.userCancelled ??
          error?.user_cancelled ??
          error?.userCanceled ??
          error?.user_cancelled;
        const underlyingErrorMessage =
          error?.underlyingErrorMessage ??
          error?.underlying_error_message ??
          error?.userInfo?.underlyingErrorMessage ??
          error?.userInfo?.underlying_error_message;

        console.log(
          "[RevenueCat] Error (flags):",
          JSON.stringify(
            {
              userCancelled,
              underlyingErrorMessage,
            },
            null,
            2,
          ),
        );

        const msg = String(underlyingErrorMessage ?? "");
        if (
          msg &&
          msg.toLowerCase().includes("google play") &&
          msg.toLowerCase().includes("cache")
        ) {
          console.warn(
            "[RevenueCat] Posible error relacionado a 'Google Play Store cache':",
            msg,
          );
        }
      } catch {
        // no-op: evitar que logs rompan el flujo
      }

      // Manejar error específico de configuración de productos
      const errorMessage = error?.message || "Error al obtener ofertas";
      const isConfigurationError =
        errorMessage.includes("configuration") ||
        errorMessage.includes("could not be fetched") ||
        errorMessage.includes("StoreKit Configuration");

      if (isConfigurationError) {
        console.error(
          "[RevenueCat] ⚠️ Error de configuración de productos:",
          errorMessage,
        );
        console.log("[RevenueCat] 🔧 Pasos para solucionar:");
        if (Platform.OS === "android") {
          console.log(
            "[RevenueCat]   1. Verificar que el applicationId (android.package en app.json) sea com.codeamusdev2.contamacro",
          );
          console.log(
            "[RevenueCat]   2. Verificar que los IDs de producto en Google Play Console coincidan con los de RevenueCat (ej: ...:premium-mensual-2026 / ...:premium-anual-2026)",
          );
          console.log(
            "[RevenueCat]   3. Comprobar que el correo del probador esté en 'License Testing' (Google Play Console)",
          );
          console.log(
            "[RevenueCat]   4. Esperar propagación de cambios en Play Console y probar con una cuenta de Google correcta en el dispositivo",
          );
        } else if (Platform.OS === "ios") {
          console.log(
            "[RevenueCat]   1. Verifica que el archivo 'ContaMacros.storekit' esté en la raíz del proyecto",
          );
          console.log(
            "[RevenueCat]   2. Ejecuta: npx expo prebuild --platform ios",
          );
          console.log(
            "[RevenueCat]   3. Abre el proyecto en Xcode: open ios/ContaMacros.xcworkspace",
          );
          console.log(
            "[RevenueCat]   4. En Xcode: Product → Scheme → Edit Scheme (⌘<)",
          );
          console.log("[RevenueCat]   5. Selecciona 'Run' → pestaña 'Options'");
          console.log(
            "[RevenueCat]   6. En 'StoreKit Configuration', selecciona 'ContaMacros.storekit'",
          );
          console.log(
            "[RevenueCat]   7. Ejecuta la app desde Xcode (⌘R), NO desde Expo CLI",
          );
          console.log("[RevenueCat] 📋 Product IDs (iOS) esperados:");
          console.log("[RevenueCat]   - contamacros_month (Plan Mensual)");
          console.log("[RevenueCat]   - contamacros_yearly (Plan Anual)");
        }
        console.log(
          "[RevenueCat] 📖 Más info: https://rev.cat/why-are-offerings-empty",
        );

        return {
          ok: false,
          message:
            Platform.OS === "android"
              ? "Error de configuración: No se pudieron obtener los productos. Revisa Play Console (Product IDs + License Testing) y la configuración en RevenueCat. Ver consola para instrucciones."
              : "Error de configuración: Los productos no se pueden obtener. Para desarrollo, configura StoreKit Configuration en Xcode. Ver consola para instrucciones detalladas.",
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
        return {
          ok: false,
          message: "Package no válido: objeto undefined",
        };
      }

      // Usar la estructura moderna del SDK: product es la propiedad principal
      if (!packageToPurchase.product?.identifier) {
        return {
          ok: false,
          message: `Package no válido: no se encontró product.identifier. El package debe tener la estructura correcta del SDK de RevenueCat.`,
        };
      }

      const productId = packageToPurchase.product.identifier;

      // Verificar que el productId sea uno de los esperados
      const validProductIds = ["contamacros_month", "contamacros_yearly"];
      if (!validProductIds.includes(productId)) {
        console.warn("[RevenueCat] Product ID no reconocido:", productId);
      }

      console.log("[RevenueCat] Iniciando compra:", {
        identifier: packageToPurchase.identifier,
        productId: productId,
        price: packageToPurchase.product.priceString,
        currencyCode: packageToPurchase.product.currencyCode,
        hasProduct: !!packageToPurchase.product,
      });

      const { customerInfo } =
        await PurchasesModule.purchasePackage(packageToPurchase);

      // Verificar que la compra fue exitosa y el entitlement está activo
      const hasProEntitlement =
        customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;

      console.log("[RevenueCat] Compra exitosa:", {
        entitlements: Object.keys(customerInfo.entitlements.active),
        hasProEntitlement,
        productId: productId,
      });

      // Sincronizar estado con Supabase después de compra exitosa
      // Esto actualiza is_premium en la tabla profiles
      await this.syncPremiumStatusWithSupabase(customerInfo);

      return { ok: true, data: customerInfo };
    } catch (error: any) {
      // RevenueCat lanza errores especiales para cancelaciones de usuario
      // Esto es normal y esperado - no es un error real
      if (error.userCancelled || error.code === "USER_CANCELLED") {
        console.log(
          "[RevenueCat] ℹ️ Compra cancelada por el usuario (comportamiento normal)",
        );
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
          error instanceof Error
            ? error.message
            : "Error al procesar la compra",
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

      // Verificar si se restauró una suscripción activa
      const hasProEntitlement =
        customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;

      console.log("[RevenueCat] Compras restauradas:", {
        entitlements: Object.keys(customerInfo.entitlements.active),
        hasProEntitlement,
      });

      // Sincronizar estado con Supabase después de restaurar compras
      // Esto actualiza is_premium en la tabla profiles según el estado del entitlement
      await this.syncPremiumStatusWithSupabase(customerInfo);

      return { ok: true, data: customerInfo };
    } catch (error) {
      console.error("[RevenueCat] Error al restaurar compras:", error);
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : "Error al restaurar compras",
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
