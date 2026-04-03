// src/presentation/components/premium/PremiumPaywall.tsx
import { RevenueCatService } from "@/domain/services/revenueCatService";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useRevenueCat } from "@/presentation/hooks/subscriptions/useRevenueCat";
import { useToast } from "@/presentation/hooks/ui/useToast";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Linking,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import type { PurchasesOffering } from "react-native-purchases";
import { PACKAGE_TYPE } from "react-native-purchases";

// Tipo local para PurchasesPackage con storeProduct
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

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type PremiumPlan = "monthly" | "annual" | "lifetime";

type PremiumPaywallProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

const BENEFIT_ICON_AI = "#38BDF8"; // Celeste IA — vibrante en dark
const BENEFIT_ICON_PRO = "#FBBF24"; // Destellos — ámbar, coherente con dark

const BENEFITS = [
  {
    icon: "robot" as const,
    title: "Fitness Coach Pro",
    description:
      "Tu coach IA conversacional. Pídele recetas, planes y rutinas según tus macros del día.",
    iconColor: BENEFIT_ICON_AI,   // celeste
  },
  {
    icon: "camera-iris" as const,
    title: "Escáner nutricional IA ilimitado",
    description:
      "Fotos de tus platos para obtener macros al instante con IA.",
    iconColor: BENEFIT_ICON_PRO,  // ámbar
  },
  {
    icon: "chef-hat" as const,
    title: "Recetas ilimitadas",
    description:
      "Crea menús personalizados según tus objetivos sin restricciones.",
    iconColor: BENEFIT_ICON_AI,   // celeste
  },
  {
    icon: "heart-pulse" as const,
    title: "Sincronización de Salud",
    description:
      "Conecta tus calorías quemadas automáticamente con Apple Health y Google Fit.",
    iconColor: BENEFIT_ICON_PRO,  // ámbar
  },
  {
    icon: "barcode-scan" as const,
    title: "Escáner de código de barras ilimitado",
    description:
      "Encuentra productos chilenos al instante. Sin límites de escaneos.",
    iconColor: BENEFIT_ICON_AI,   // celeste
  },
];

// Función helper para formatear precios según la moneda
// En Chile (CLP) usamos puntos como separador de miles en lugar de comas
const formatPriceForCurrency = (
  priceString: string,
  currencyCode?: string,
): string => {
  if (!priceString || priceString === "—") return priceString;

  // Si es CLP, reemplazar comas por puntos
  if (currencyCode === "CLP") {
    return priceString.replace(/,/g, ".");
  }

  return priceString;
};

// Precio formateado sin decimales (ej. $2.499 en vez de $2.499,17) — para plan lifetime
const formatRoundedPrice = (price: number, currencyCode: string): string => {
  const rounded = Math.round(price);
  if (currencyCode === "CLP") {
    return `$${rounded.toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  try {
    return rounded.toLocaleString(undefined, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  } catch {
    return `$${rounded}`;
  }
};

// Quita la parte decimal del string de precio (ej. "$2.499.17" -> "$2.499", "2.499,17" -> "2.499")
const stripPriceDecimals = (formatted: string): string => {
  if (!formatted || formatted === "—") return formatted;
  // Quitar decimales al final: .17 o ,17 (punto o coma + 1-3 dígitos al final)
  return formatted.replace(/[.,]\d{1,3}$/, "");
};

// Los precios se obtendrán dinámicamente de RevenueCat

export default function PremiumPaywall({
  visible,
  onClose,
  onSuccess,
}: PremiumPaywallProps) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const { refreshProfile } = useAuth();
  const { showToast } = useToast();
  const { reload } = useRevenueCat();
  const s = makeStyles(colors, typography);

  const [isProcessing, setIsProcessing] = useState(false);
  const [currentOffering, setCurrentOffering] =
    useState<PurchasesOffering | null>(null);
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [errorLoadingPrices, setErrorLoadingPrices] = useState<string | null>(
    null,
  );
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Obtener offerings usando RevenueCatService
  useEffect(() => {
    const fetchOfferings = async () => {
      // Solo intentar obtener offerings en plataformas nativas
      if (Platform.OS !== "ios" && Platform.OS !== "android") {
        setLoadingPrices(false);
        setErrorLoadingPrices(
          "RevenueCat no está disponible en esta plataforma",
        );
        return;
      }

      try {
        setLoadingPrices(true);
        setErrorLoadingPrices(null);

        const result = await RevenueCatService.getOfferings();

        if (!result.ok) {
          console.error(
            "[PremiumPaywall] Error al obtener ofertas:",
            result.message,
          );

          // Mensaje más amigable para errores de configuración
          let errorMessage = result.message || "Error al cargar los planes";
          if (result.code === "CONFIGURATION_ERROR") {
            errorMessage =
              "Configuración requerida: Para desarrollo, configura StoreKit Configuration en Xcode. Revisa la consola para instrucciones paso a paso.";
          }

          setErrorLoadingPrices(errorMessage);
          setCurrentOffering(null);
        } else if (!result.data) {
          console.warn(
            "[PremiumPaywall] ⚠️ No hay ofertas disponibles (offerings vacío)",
          );
          console.log(
            "[PremiumPaywall] ℹ️ Verificando productos del StoreKit local...",
          );
          console.log("[PremiumPaywall] 💡 Para desarrollo local:");
          console.log(
            "[PremiumPaywall]   1. Ejecuta: npx expo prebuild --platform ios",
          );
          console.log(
            "[PremiumPaywall]   2. Abre: open ios/ContaMacros.xcworkspace",
          );
          console.log(
            "[PremiumPaywall]   3. En Xcode: Product → Scheme → Edit Scheme → Run → Options",
          );
          console.log(
            "[PremiumPaywall]   4. Selecciona 'ContaMacros.storekit' en StoreKit Configuration",
          );
          console.log("[PremiumPaywall]   5. Ejecuta desde Xcode (⌘R)");
          setErrorLoadingPrices(
            "No hay planes disponibles. Para desarrollo, configura StoreKit Configuration en Xcode.",
          );
          setCurrentOffering(null);
        } else {
          const offering = result.data;
          console.log("[PremiumPaywall] Ofertas obtenidas:", {
            identifier: offering.identifier,
            availablePackages: offering.availablePackages.length,
            packages: (offering.availablePackages as any[])
              .filter(
                (pkg: any) => pkg.product != null || pkg.storeProduct != null,
              )
              .map((pkg: any) => ({
                identifier: pkg.identifier,
                packageType: pkg.packageType,
                productId:
                  pkg.product?.identifier || pkg.storeProduct?.identifier,
                productPrice:
                  pkg.product?.priceString || pkg.storeProduct?.priceString,
                currencyCode:
                  pkg.product?.currencyCode || pkg.storeProduct?.currencyCode,
              })),
          });
          setCurrentOffering(offering);
        }
      } catch (error) {
        console.error("[PremiumPaywall] Error al obtener ofertas:", error);
        setErrorLoadingPrices(
          error instanceof Error ? error.message : "Error al cargar los planes",
        );
        setCurrentOffering(null);
      } finally {
        setLoadingPrices(false);
      }
    };

    if (visible) {
      fetchOfferings();
    }
  }, [visible]);

  // Mapear packages de RevenueCat a planes locales usando PACKAGE_TYPE
  const planPackages = useMemo(() => {
    if (!currentOffering?.availablePackages) return null;

    // Filtrar packages con product válido (product o storeProduct)
    // En algunos casos storeProduct puede ser null pero product tiene los datos
    const validPackages = (currentOffering.availablePackages as any[]).filter(
      (pkg: any) => pkg.product != null || pkg.storeProduct != null,
    ) as PurchasesPackage[];

    if (validPackages.length === 0) {
      console.warn(
        "[PremiumPaywall] No hay packages válidos (sin product ni storeProduct)",
      );
      return null;
    }

    const packages: Record<string, PurchasesPackage> = {};

    for (const pkg of validPackages) {
      switch (pkg.packageType) {
        case PACKAGE_TYPE.MONTHLY:
          packages.monthly = pkg;
          break;
        case PACKAGE_TYPE.ANNUAL:
          packages.annual = pkg;
          break;
        case PACKAGE_TYPE.LIFETIME:
          packages.lifetime = pkg;
          break;
        default:
          // Ignorar tipos desconocidos
          break;
      }
    }

    // Fallback de seguridad: si el mapeo por tipo falla, usar los primeros disponibles
    if (Object.keys(packages).length === 0 && validPackages.length > 0) {
      if (validPackages[0]) packages.monthly = validPackages[0];
      if (validPackages[1]) packages.annual = validPackages[1];
      if (validPackages[2]) packages.lifetime = validPackages[2];
    }

    return packages;
  }, [currentOffering]);

  // Determinar plan inicial basado en packages disponibles
  const initialPlan = useMemo<PremiumPlan>(() => {
    if (!planPackages) return "annual";
    // Priorizar annual si está disponible, luego monthly, luego lifetime
    if (planPackages.annual) return "annual";
    if (planPackages.monthly) return "monthly";
    if (planPackages.lifetime) return "lifetime";
    return "annual";
  }, [planPackages]);

  const [selectedPlan, setSelectedPlan] = useState<PremiumPlan>(initialPlan);

  // Actualizar selectedPlan cuando cambian los packages disponibles
  useEffect(() => {
    setSelectedPlan(initialPlan);
  }, [initialPlan]);

  // Obtener información de planes desde RevenueCat con precios dinámicos
  const plansData = useMemo(() => {
    if (!planPackages) {
      return {
        monthly: {
          price: 0,
          priceString: "—",
          period: "mes",
          label: "Plan Mensual",
          package: null,
        },
        annual: {
          price: 0,
          priceString: "—",
          period: "año",
          label: "Plan Anual",
          savings: 0,
          popular: true,
          package: null,
        },
        lifetime: {
          price: 0,
          priceString: "—",
          period: "única vez",
          label: "Plan de por vida",
          package: null,
        },
      };
    }

    const monthlyPkg = planPackages.monthly;
    const annualPkg = planPackages.annual;
    const lifetimePkg = planPackages.lifetime;

    // Obtener precios dinámicos desde product (preferido) o storeProduct (fallback)
    // Los precios se muestran automáticamente según la región del usuario
    // Si el usuario está en Chile, los precios se mostrarán en CLP automáticamente
    // cuando estén configurados en App Store Connect para esa región
    const monthlyPrice =
      monthlyPkg?.product?.price ?? monthlyPkg?.storeProduct?.price ?? 0;
    const monthlyPriceStringRaw =
      monthlyPkg?.product?.priceString ??
      monthlyPkg?.storeProduct?.priceString ??
      "—";
    const monthlyCurrency =
      monthlyPkg?.product?.currencyCode ??
      monthlyPkg?.storeProduct?.currencyCode;
    const monthlyPriceString = formatPriceForCurrency(
      monthlyPriceStringRaw,
      monthlyCurrency,
    );

    const annualPrice =
      annualPkg?.product?.price ?? annualPkg?.storeProduct?.price ?? 0;
    const annualPriceStringRaw =
      annualPkg?.product?.priceString ??
      annualPkg?.storeProduct?.priceString ??
      "—";
    const annualCurrency =
      annualPkg?.product?.currencyCode ?? annualPkg?.storeProduct?.currencyCode;
    const annualPriceString = formatPriceForCurrency(
      annualPriceStringRaw,
      annualCurrency,
    );

    const lifetimePrice =
      lifetimePkg?.product?.price ?? lifetimePkg?.storeProduct?.price ?? 0;
    const lifetimePriceStringRaw =
      lifetimePkg?.product?.priceString ??
      lifetimePkg?.storeProduct?.priceString ??
      "—";
    const lifetimeCurrency =
      lifetimePkg?.product?.currencyCode ??
      lifetimePkg?.storeProduct?.currencyCode;
    // Mostrar precio sin decimales (ej. $2.499 en lugar de $2.499,17): primero intentar con número, luego limpiar string
    const lifetimeFormatted =
      lifetimePrice > 0 && lifetimeCurrency
        ? formatRoundedPrice(lifetimePrice, lifetimeCurrency)
        : formatPriceForCurrency(lifetimePriceStringRaw, lifetimeCurrency);
    const lifetimePriceString = stripPriceDecimals(lifetimeFormatted);

    // Log para debugging: ver qué moneda está usando
    if (monthlyCurrency || annualCurrency) {
      console.log("[PremiumPaywall] Monedas detectadas:", {
        monthly: monthlyCurrency,
        annual: annualCurrency,
        lifetime: lifetimeCurrency,
      });
    }

    // Calcular ahorro del plan anual comparado con el mensual
    let annualSavings = 0;
    if (monthlyPkg && annualPkg && monthlyPrice > 0 && annualPrice > 0) {
      const monthlyYearlyCost = monthlyPrice * 12;
      const savingsAmount = monthlyYearlyCost - annualPrice;
      annualSavings = Math.round((savingsAmount / monthlyYearlyCost) * 100);
    }

    return {
      monthly: {
        price: monthlyPrice,
        priceString: monthlyPriceString,
        currencyCode: monthlyCurrency,
        period: "mes",
        label: "Plan Mensual",
        package: monthlyPkg ?? null,
      },
      annual: {
        price: annualPrice,
        priceString: annualPriceString,
        currencyCode: annualCurrency,
        period: "año",
        label: "Plan Anual",
        savings: annualSavings,
        popular: true,
        package: annualPkg ?? null,
      },
      lifetime: {
        price: lifetimePrice,
        priceString: lifetimePriceString,
        currencyCode: lifetimeCurrency,
        period: "única vez",
        label: "Plan de por vida",
        package: lifetimePkg ?? null,
      },
    };
  }, [planPackages]);

  // Animación de entrada
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 8,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, scaleAnim, opacityAnim]);

  // Animación de salida antes de cerrar
  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const handleSubscribe = async () => {
    if (isProcessing) return;

    const selectedPackage = plansData[selectedPlan]?.package;
    if (!selectedPackage) {
      showToast({
        message: "Plan no disponible. Por favor, intenta más tarde.",
        type: "error",
      });
      return;
    }

    // Solo permitir compras en plataformas nativas
    if (Platform.OS !== "ios" && Platform.OS !== "android") {
      showToast({
        message: "Las compras no están disponibles en esta plataforma",
        type: "error",
      });
      return;
    }

    setIsProcessing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      console.log("[PremiumPaywall] Procesando suscripción:", {
        plan: selectedPlan,
        packageIdentifier: selectedPackage.identifier,
        productId:
          selectedPackage.product?.identifier ||
          selectedPackage.storeProduct?.identifier,
        price:
          selectedPackage.product?.priceString ||
          selectedPackage.storeProduct?.priceString,
        currencyCode:
          selectedPackage.product?.currencyCode ||
          selectedPackage.storeProduct?.currencyCode,
      });

      // Validar que el package tenga product antes de comprar
      if (!selectedPackage?.product?.identifier) {
        showToast({
          message:
            "Error: El plan seleccionado no es válido. Por favor, intenta de nuevo.",
          type: "error",
        });
        setIsProcessing(false);
        return;
      }

      // Comprar package usando RevenueCatService (maneja sincronización automática)
      const purchaseResult = await RevenueCatService.purchasePackage(
        selectedPackage as any,
      );

      if (!purchaseResult.ok) {
        throw new Error(
          purchaseResult.message || "Error al procesar la compra",
        );
      }

      const customerInfo = purchaseResult.data;
      const hasProEntitlement =
        customerInfo.entitlements.active["ContaMacros Pro"] !== undefined;

      console.log("[PremiumPaywall] Compra exitosa:", {
        entitlements: Object.keys(customerInfo.entitlements.active),
        hasProEntitlement,
        productId: selectedPackage.product.identifier,
      });

      // Recargar estado de RevenueCat (mantener loading hasta que se complete)
      await reload();

      // La sincronización con Supabase ya se hizo automáticamente en purchasePackage
      // Esperar un momento para que Supabase se actualice, luego refrescar perfil
      // Mantener el estado de loading hasta que todo esté sincronizado
      try {
        // Pequeño delay para asegurar que Supabase se haya actualizado
        await new Promise((resolve) => setTimeout(resolve, 500));
        await refreshProfile();
        console.log("[PremiumPaywall] ✅ Perfil actualizado después de compra");
      } catch (profileError) {
        console.warn(
          "[PremiumPaywall] Error al refrescar perfil (no crítico):",
          profileError,
        );
        // No fallar si esto falla, RevenueCat ya tiene el estado correcto y Supabase ya está sincronizado
      }

      // Solo cerrar el estado de loading después de que todo esté sincronizado
      setIsProcessing(false);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({
        message: "¡Bienvenido a Coach Pro! 💎",
        type: "success",
        duration: 3000,
      });

      onSuccess?.();
      onClose();
    } catch (error: any) {
      // RevenueCat lanza errores especiales para cancelaciones de usuario
      // Esto es normal y esperado - no es un error real
      if (error.userCancelled || error.code === "USER_CANCELLED") {
        console.log(
          "[PremiumPaywall] ℹ️ Compra cancelada por el usuario (comportamiento normal)",
        );
        // No mostrar error al usuario, simplemente cerrar el estado de procesamiento
        setIsProcessing(false);
        return;
      }

      // Solo mostrar error si NO es una cancelación
      console.error(
        "[PremiumPaywall] ❌ Error real al procesar compra:",
        error,
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast({
        message:
          error instanceof Error
            ? error.message
            : "Error al procesar la suscripción",
        type: "error",
      });
      setIsProcessing(false);
    }
  };

  const handleRestore = async () => {
    if (isProcessing) return;

    // Solo permitir restaurar en plataformas nativas
    if (Platform.OS !== "ios" && Platform.OS !== "android") {
      showToast({
        message: "Restaurar compras no está disponible en esta plataforma",
        type: "error",
      });
      return;
    }

    setIsProcessing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      console.log("[PremiumPaywall] Restaurando compras...");
      const result = await RevenueCatService.restorePurchases();

      if (!result.ok) {
        throw new Error(result.message || "Error al restaurar compras");
      }

      const customerInfo = result.data;
      const hasProEntitlement =
        customerInfo.entitlements.active["ContaMacros Pro"] !== undefined;

      console.log("[PremiumPaywall] Compras restauradas:", {
        entitlements: Object.keys(customerInfo.entitlements.active),
        hasProEntitlement,
      });

      // Recargar estado de RevenueCat (mantener loading hasta que se complete)
      await reload();

      // La sincronización con Supabase ya se hizo automáticamente en restorePurchases
      // Esperar un momento para que Supabase se actualice, luego refrescar perfil
      // Mantener el estado de loading hasta que todo esté sincronizado
      if (hasProEntitlement) {
        try {
          // Pequeño delay para asegurar que Supabase se haya actualizado
          await new Promise((resolve) => setTimeout(resolve, 500));
          await refreshProfile();
          console.log(
            "[PremiumPaywall] ✅ Perfil actualizado después de restaurar",
          );
        } catch (profileError) {
          console.warn(
            "[PremiumPaywall] Error al refrescar perfil (no crítico):",
            profileError,
          );
          // No fallar si esto falla, RevenueCat ya tiene el estado correcto y Supabase ya está sincronizado
        }
      }

      // Solo cerrar el estado de loading después de que todo esté sincronizado
      setIsProcessing(false);

      Haptics.notificationAsync(
        hasProEntitlement
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      );
      showToast({
        message: hasProEntitlement
          ? "Compras restauradas exitosamente"
          : "No se encontraron compras para restaurar",
        type: hasProEntitlement ? "success" : "info",
        duration: 3000,
      });

      if (hasProEntitlement) {
        onSuccess?.();
        onClose();
      }
    } catch (error) {
      console.error("[PremiumPaywall] Error al restaurar:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast({
        message:
          error instanceof Error ? error.message : "Error al restaurar compras",
        type: "error",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTermsPress = () => {
    Linking.openURL("https://www.apple.com/legal/internet-services/itunes/dev/stdeula/");
  };

  const handlePrivacyPress = () => {
    Linking.openURL("https://www.contamacros.cl/privacidad");
  };

  const selectedPlanData = plansData[selectedPlan];

  // Calcular precio mensual equivalente dinámicamente (sin decimales, ej. $2.499)
  const monthlyPrice = useMemo(() => {
    let price: number;
    let currencyCode: string | undefined;

    if (selectedPlan === "annual" && plansData.annual.price > 0) {
      price = plansData.annual.price / 12;
      currencyCode = plansData.annual.currencyCode;
    } else if (plansData.monthly.price > 0) {
      price = plansData.monthly.price;
      currencyCode = plansData.monthly.currencyCode;
    } else {
      return "—";
    }

    const rounded = Math.round(price);

    // Si es CLP, formatear con puntos como separador de miles, sin decimales
    if (currencyCode === "CLP") {
      const formattedInteger = rounded.toLocaleString("es-CL", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
      return formattedInteger;
    }

    // Para otras monedas, entero sin decimales (sin símbolo; el JSX añade $)
    return rounded.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }, [selectedPlan, plansData]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <Animated.View
        style={[
          s.overlay,
          {
            opacity: opacityAnim,
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <Animated.View
          style={[
            s.container,
            {
              transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
            },
          ]}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scrollContent}
          >
            {/* Header con diamante animado */}
            <View style={s.header}>
              <Animated.View
                style={[
                  s.diamondContainer,
                  {
                    transform: [
                      {
                        rotate: opacityAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0deg", "360deg"],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="diamond-stone"
                  size={64}
                  color={colors.brand}
                />
              </Animated.View>
              <Text style={s.proTitle}>ContaMacros Pro</Text>
              <Text style={s.title}>Lleva tu Nutrición al Siguiente Nivel</Text>
              <Text style={s.subtitle}>
                Únete a la comunidad Pro y alcanza tus metas un 40% más rápido
              </Text>
            </View>

            {/* Beneficios */}
            <View style={s.benefitsContainer}>
              {BENEFITS.map((benefit) => {
                const iconColor = benefit.iconColor ?? colors.brand;
                return (
                  <Animated.View
                    key={benefit.icon}
                    style={[
                      s.benefitCard,
                      {
                        opacity: opacityAnim,
                        transform: [
                          {
                            translateX: opacityAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [-20, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <View
                      style={[
                        s.benefitIconContainer,
                        { backgroundColor: iconColor + "20" },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={benefit.icon}
                        size={28}
                        color={iconColor}
                      />
                    </View>
                    <View style={s.benefitTextContainer}>
                      <Text style={s.benefitTitle}>{benefit.title}</Text>
                      <Text style={s.benefitDescription}>
                        {benefit.description}
                      </Text>
                    </View>
                  </Animated.View>
                );
              })}
            </View>

            {/* Selector de Planes */}
            <View style={s.plansContainer}>
              <Text style={s.plansTitle}>Elige tu plan</Text>

              {/* Indicador de carga mientras se obtienen los precios */}
              {loadingPrices && (
                <View style={s.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.brand} />
                  <Text style={s.loadingText}>
                    Cargando planes disponibles...
                  </Text>
                </View>
              )}

              {/* Mensaje de error si falla la carga */}
              {!loadingPrices && errorLoadingPrices && (
                <View style={s.errorContainer}>
                  <MaterialCommunityIcons
                    name="alert-circle"
                    size={24}
                    color={colors.cta}
                  />
                  <Text style={s.errorText}>{errorLoadingPrices}</Text>
                </View>
              )}

              {/* Mensaje si no hay packages disponibles */}
              {!loadingPrices && !errorLoadingPrices && !planPackages && (
                <View style={s.errorContainer}>
                  <MaterialCommunityIcons
                    name="alert-circle"
                    size={24}
                    color={colors.cta}
                  />
                  <Text style={s.errorText}>
                    No hay planes disponibles en este momento. Por favor,
                    intenta más tarde.
                  </Text>
                </View>
              )}

              {/* Plan Mensual */}
              {plansData.monthly.package && (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedPlan("monthly");
                  }}
                  style={({ pressed }) => [
                    s.planCard,
                    selectedPlan === "monthly" && s.planCardSelected,
                    pressed && s.planCardPressed,
                  ]}
                >
                  <View style={s.planHeader}>
                    <View style={s.planInfo}>
                      <Text style={s.planLabel}>{plansData.monthly.label}</Text>
                      <Text style={s.planPrice}>
                        {plansData.monthly.priceString}
                        <Text style={s.planPeriod}>
                          {" "}
                          / {plansData.monthly.period}
                        </Text>
                      </Text>
                    </View>
                    {selectedPlan === "monthly" && (
                      <View style={s.radioSelected}>
                        <View style={s.radioInner} />
                      </View>
                    )}
                    {selectedPlan !== "monthly" && (
                      <View style={s.radioUnselected} />
                    )}
                  </View>
                </Pressable>
              )}

              {/* Plan Anual */}
              {plansData.annual.package && (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedPlan("annual");
                  }}
                  style={({ pressed }) => [
                    s.planCard,
                    s.planCardAnnual,
                    selectedPlan === "annual" && s.planCardSelected,
                    pressed && s.planCardPressed,
                  ]}
                >
                  {plansData.annual.popular && (
                    <View style={s.popularBadge}>
                      <Text style={s.popularBadgeText}>MÁS POPULAR</Text>
                    </View>
                  )}
                  <View style={s.planHeader}>
                    <View style={s.planInfo}>
                      <Text style={s.planLabel}>{plansData.annual.label}</Text>
                      <View style={s.planPriceRow}>
                        <Text style={s.planPrice}>
                          {plansData.annual.priceString}
                          <Text style={s.planPeriod}>
                            {" "}
                            / {plansData.annual.period}
                          </Text>
                        </Text>
                        {plansData.annual.savings &&
                          plansData.annual.savings > 0 && (
                            <View style={s.savingsBadge}>
                              <Text style={s.savingsBadgeText}>
                                Ahorra {plansData.annual.savings}%
                              </Text>
                            </View>
                          )}
                      </View>
                      {monthlyPrice !== "—" && (
                        <Text style={s.planMonthlyEquivalent}>
                          ${monthlyPrice} / mes
                        </Text>
                      )}
                    </View>
                    {selectedPlan === "annual" && (
                      <View style={s.radioSelected}>
                        <View style={s.radioInner} />
                      </View>
                    )}
                    {selectedPlan !== "annual" && (
                      <View style={s.radioUnselected} />
                    )}
                  </View>
                </Pressable>
              )}

              {/* Plan Lifetime (si está disponible) */}
              {/* {plansData.lifetime.package && (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedPlan("lifetime");
                  }}
                  style={({ pressed }) => [
                    s.planCard,
                    selectedPlan === "lifetime" && s.planCardSelected,
                    pressed && s.planCardPressed,
                  ]}
                >
                  <View style={s.planHeader}>
                    <View style={s.planInfo}>
                      <Text style={s.planLabel}>
                        {plansData.lifetime.label}
                      </Text>
                      <Text style={s.planPrice}>
                        {plansData.lifetime.priceString}
                        <Text style={s.planPeriod}>
                          {" "}
                          / {plansData.lifetime.period}
                        </Text>
                      </Text>
                    </View>
                    {selectedPlan === "lifetime" && (
                      <View style={s.radioSelected}>
                        <View style={s.radioInner} />
                      </View>
                    )}
                    {selectedPlan !== "lifetime" && (
                      <View style={s.radioUnselected} />
                    )}
                  </View>
                </Pressable>
              )} */}
            </View>

            {/* Prueba Gratuita */}
            {plansData.annual.priceString !== "—" && (
              <View style={s.trialContainer}>
                <MaterialCommunityIcons
                  name="gift"
                  size={20}
                  color={colors.brand}
                />
                <Text style={s.trialText}>
                  Pruébalo <Text style={s.trialBold}>GRATIS</Text> por 7 días.
                  Luego {plansData.annual.priceString}/año. Cancela cuando
                  quieras.
                </Text>
              </View>
            )}

            {/* Mensaje de cierre */}
            <Text style={s.closingMessage}>
              Desbloquea el poder de la IA y toma el control total de tu cambio
              hoy mismo.
            </Text>

            {/* CTA Principal */}
            <Pressable
              onPress={handleSubscribe}
              disabled={
                isProcessing ||
                loadingPrices ||
                !planPackages ||
                !selectedPlanData?.package ||
                !!errorLoadingPrices
              }
              style={({ pressed }) => [
                s.ctaButton,
                (pressed ||
                  isProcessing ||
                  loadingPrices ||
                  !planPackages ||
                  !selectedPlanData?.package ||
                  !!errorLoadingPrices) &&
                  s.ctaButtonPressed,
              ]}
            >
              {isProcessing ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <ActivityIndicator size="small" color={colors.onCta} />
                  <Text style={s.ctaButtonText}>Procesando...</Text>
                </View>
              ) : loadingPrices ? (
                <ActivityIndicator size="small" color={colors.onCta} />
              ) : (
                <>
                  <Text style={s.ctaButtonText}>
                    {selectedPlan === "lifetime"
                      ? `Comprar ahora — ${selectedPlanData?.priceString ?? ""}`
                      : `Suscribirse ahora — ${selectedPlanData?.priceString ?? ""}/${selectedPlanData?.period ?? ""}`}
                  </Text>
                  <MaterialCommunityIcons
                    name="arrow-right"
                    size={20}
                    color={colors.onCta}
                  />
                </>
              )}
            </Pressable>

            {/* Texto legal de autorenovación (Apple Guideline 3.1.2c) */}
            <Text style={s.autoRenewText}>
              La suscripción se renovará automáticamente a menos que se desactive
              en la configuración de tu cuenta de iTunes al menos 24 horas antes
              de que finalice el período actual. El pago se cargará a tu cuenta
              de Apple ID al confirmar la compra.
            </Text>

            {/* Botón Restaurar Compras */}
            <View style={s.restoreContainer}>
              <Pressable
                onPress={handleRestore}
                disabled={isProcessing}
                style={({ pressed }) => [
                  s.restoreButton,
                  (pressed || isProcessing) && s.restoreButtonPressed,
                ]}
              >
                <MaterialCommunityIcons
                  name="download"
                  size={18}
                  color={colors.textSecondary}
                />
                <Text style={s.restoreButtonText}>
                  ¿Ya compraste antes? Restaurar suscripción
                </Text>
              </Pressable>
              <Text style={s.restoreHelperText}>
                Si ya compraste una suscripción en otro dispositivo o
                reinstalaste la app, presiona aquí para recuperar tu acceso
                premium.
              </Text>
            </View>

            {/* Pie de página */}
            <View style={s.footer}>
              <Pressable onPress={handleTermsPress} style={s.footerLink}>
                <Text style={s.footerLinkText}>Términos de Uso (EULA)</Text>
              </Pressable>
              <Text style={s.footerSeparator}> • </Text>
              <Pressable onPress={handlePrivacyPress} style={s.footerLink}>
                <Text style={s.footerLinkText}>Política de Privacidad</Text>
              </Pressable>
            </View>
          </ScrollView>

          {/* Botón cerrar */}
          <Pressable onPress={handleClose} style={s.closeButton}>
            <MaterialCommunityIcons
              name="close"
              size={24}
              color={colors.textSecondary}
            />
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      justifyContent: "flex-end",
    },
    container: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      maxHeight: SCREEN_HEIGHT * 0.9,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 20,
    },
    scrollContent: {
      padding: 24,
      paddingBottom: 40,
    },
    header: {
      alignItems: "center",
      marginBottom: 32,
    },
    diamondContainer: {
      marginBottom: 16,
      padding: 16,
      borderRadius: 24,
      backgroundColor: colors.brand + "15",
    },
    proTitle: {
      ...typography.h1,
      fontSize: 14,
      fontWeight: "700",
      color: colors.brand,
      textAlign: "center",
      letterSpacing: 1,
      textTransform: "uppercase" as const,
      marginBottom: 4,
    },
    title: {
      ...typography.h1,
      fontSize: 28,
      fontWeight: "800",
      color: colors.textPrimary,
      textAlign: "center",
      marginBottom: 8,
    },
    subtitle: {
      ...typography.body,
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 22,
    },
    benefitsContainer: {
      gap: 16,
      marginBottom: 32,
    },
    benefitCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    benefitIconContainer: {
      width: 56,
      height: 56,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 16,
    },
    benefitTextContainer: {
      flex: 1,
    },
    benefitTitle: {
      ...typography.subtitle,
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 4,
    },
    benefitDescription: {
      ...typography.body,
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    plansContainer: {
      marginBottom: 24,
    },
    plansTitle: {
      ...typography.subtitle,
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 16,
    },
    planCard: {
      padding: 20,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.border,
      marginBottom: 12,
      position: "relative",
    },
    planCardAnnual: {
      borderColor: colors.brand + "40",
      backgroundColor: colors.brand + "08",
    },
    planCardSelected: {
      borderColor: colors.brand,
      backgroundColor: colors.brand + "15",
    },
    planCardPressed: {
      opacity: 0.7,
    },
    popularBadge: {
      position: "absolute",
      top: -8,
      right: 16,
      backgroundColor: colors.brand,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    popularBadgeText: {
      ...typography.caption,
      fontSize: 10,
      fontWeight: "800",
      color: colors.onCta,
      letterSpacing: 0.5,
    },
    planHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    planInfo: {
      flex: 1,
    },
    planLabel: {
      ...typography.subtitle,
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 4,
    },
    planPriceRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 4,
    },
    planPrice: {
      ...typography.h2,
      fontSize: 24,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    planPeriod: {
      ...typography.body,
      fontSize: 14,
      fontWeight: "400",
      color: colors.textSecondary,
    },
    planMonthlyEquivalent: {
      ...typography.caption,
      fontSize: 12,
      color: colors.textSecondary,
      fontStyle: "italic",
    },
    savingsBadge: {
      backgroundColor: colors.brand,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    savingsBadgeText: {
      ...typography.caption,
      fontSize: 10,
      fontWeight: "700",
      color: colors.onCta,
    },
    radioSelected: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.brand,
    },
    radioUnselected: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
    },
    trialContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.brand + "10",
      marginBottom: 24,
    },
    trialText: {
      ...typography.body,
      fontSize: 13,
      color: colors.textPrimary,
      textAlign: "center",
      flex: 1,
    },
    trialBold: {
      fontWeight: "800",
      color: colors.brand,
    },
    closingMessage: {
      ...typography.body,
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
      marginBottom: 20,
      paddingHorizontal: 8,
    },
    ctaButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 18,
      paddingHorizontal: 24,
      borderRadius: 16,
      backgroundColor: colors.brand,
      shadowColor: colors.brand,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 8,
      marginBottom: 12,
    },
    ctaButtonPressed: {
      opacity: 0.8,
      transform: [{ scale: 0.98 }],
    },
    ctaButtonText: {
      ...typography.button,
      fontSize: 18,
      fontWeight: "800",
      color: colors.onCta,
      letterSpacing: 0.5,
    },
    autoRenewText: {
      ...typography.caption,
      fontSize: 11,
      color: colors.textSecondary,
      textAlign: "center" as const,
      lineHeight: 16,
      marginBottom: 16,
      paddingHorizontal: 12,
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    footerLink: {
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    footerLinkText: {
      ...typography.caption,
      fontSize: 11,
      color: colors.textSecondary,
      textDecorationLine: "underline",
    },
    footerSeparator: {
      ...typography.caption,
      fontSize: 11,
      color: colors.textSecondary,
    },
    loadingContainer: {
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
      gap: 12,
      marginBottom: 16,
    },
    loadingText: {
      ...typography.body,
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
    },
    errorContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.cta + "15",
      borderWidth: 1,
      borderColor: colors.cta + "40",
      marginBottom: 16,
    },
    errorText: {
      ...typography.body,
      fontSize: 13,
      color: colors.textPrimary,
      flex: 1,
    },
    restoreContainer: {
      marginBottom: 16,
    },
    restoreButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
    },
    restoreButtonPressed: {
      opacity: 0.7,
    },
    restoreButtonText: {
      ...typography.body,
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary,
      textAlign: "center",
    },
    restoreHelperText: {
      ...typography.caption,
      fontSize: 11,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 16,
      paddingHorizontal: 8,
    },
    closeButton: {
      position: "absolute",
      top: 16,
      right: 16,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.textSecondary + "20",
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10,
    },
  });
}
