// src/presentation/components/premium/PremiumPaywall.tsx
import { AuthService } from "@/domain/services/authService";
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
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

// Tipo local para evitar importar react-native-purchases en tiempo de carga
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

const BENEFITS = [
  {
    icon: "brain" as const,
    title: "Smart Coach Pro",
    description: "Recomendaciones exactas de macros basadas en tu historial",
  },
  {
    icon: "watch" as const,
    title: "Conexión Salud",
    description: "Sincroniza Apple Health/Google Health y ajusta tus metas automáticamente",
  },
  {
    icon: "chart-line" as const,
    title: "Análisis Avanzado",
    description: "Visualiza tendencias y progresión de macros por semana",
  },
];

// Los precios se obtendrán dinámicamente de RevenueCat

export default function PremiumPaywall({
  visible,
  onClose,
  onSuccess,
}: PremiumPaywallProps) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const { profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const {
    offerings,
    purchasePackage,
    restorePurchases,
    reload,
    status,
  } = useRevenueCat();
  const s = makeStyles(colors, typography);

  const [isProcessing, setIsProcessing] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Mapear packages de RevenueCat a planes locales
  const planPackages = useMemo(() => {
    if (!offerings?.availablePackages) return null;

    const packages: Record<string, PurchasesPackage> = {};
    for (const pkg of offerings.availablePackages) {
      // RevenueCat usa identificadores como "monthly", "annual", "lifetime"
      // o "$rc_monthly", "$rc_annual", etc.
      const identifier = pkg.identifier.toLowerCase();
      if (identifier.includes("monthly") || identifier.includes("$rc_monthly")) {
        packages.monthly = pkg;
      } else if (
        identifier.includes("annual") ||
        identifier.includes("yearly") ||
        identifier.includes("$rc_annual")
      ) {
        packages.annual = pkg;
      } else if (
        identifier.includes("lifetime") ||
        identifier.includes("$rc_lifetime")
      ) {
        packages.lifetime = pkg;
      }
    }

    // Si no encontramos packages con esos nombres, usar los primeros disponibles
    if (Object.keys(packages).length === 0 && offerings.availablePackages.length > 0) {
      packages.monthly = offerings.availablePackages[0];
      if (offerings.availablePackages.length > 1) {
        packages.annual = offerings.availablePackages[1];
      }
      if (offerings.availablePackages.length > 2) {
        packages.lifetime = offerings.availablePackages[2];
      }
    }

    return packages;
  }, [offerings]);

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

  // Obtener información de planes desde RevenueCat
  const plansData = useMemo(() => {
    if (!planPackages) {
      // Fallback a precios hardcodeados si no hay packages disponibles
      return {
        monthly: {
          price: 9.99,
          period: "mes",
          label: "Plan Mensual",
          package: null,
        },
        annual: {
          price: 49.99,
          period: "año",
          label: "Plan Anual",
          savings: 50,
          popular: true,
          package: null,
        },
        lifetime: {
          price: 99.99,
          period: "única vez",
          label: "Plan de por vida",
          package: null,
        },
      };
    }

    const monthlyPkg = planPackages.monthly;
    const annualPkg = planPackages.annual;
    const lifetimePkg = planPackages.lifetime;

    return {
      monthly: {
        price: monthlyPkg?.storeProduct.price ?? 9.99,
        priceString: monthlyPkg?.storeProduct.priceString ?? "$9.99",
        period: "mes",
        label: "Plan Mensual",
        package: monthlyPkg ?? null,
      },
      annual: {
        price: annualPkg?.storeProduct.price ?? 49.99,
        priceString: annualPkg?.storeProduct.priceString ?? "$49.99",
        period: "año",
        label: "Plan Anual",
        savings: annualPkg
          ? Math.round(
              ((monthlyPkg?.storeProduct.price ?? 9.99) * 12 -
                (annualPkg.storeProduct.price ?? 49.99)) /
                ((monthlyPkg?.storeProduct.price ?? 9.99) * 12) *
                100,
            )
          : 50,
        popular: true,
        package: annualPkg ?? null,
      },
      lifetime: {
        price: lifetimePkg?.storeProduct.price ?? 99.99,
        priceString: lifetimePkg?.storeProduct.priceString ?? "$99.99",
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
    } else {
      slideAnim.setValue(SCREEN_HEIGHT);
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
    }
  }, [visible, slideAnim, scaleAnim, opacityAnim]);

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

    setIsProcessing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      console.log("[PremiumPaywall] Procesando suscripción:", selectedPlan);

      // Comprar package con RevenueCat
      const result = await purchasePackage(selectedPackage);

      if (!result.ok) {
        if (result.message === "Compra cancelada") {
          // No mostrar error si el usuario canceló
          return;
        }
        throw new Error(result.message || "Error al procesar la compra");
      }

      // Recargar estado de RevenueCat
      await reload();

      // Actualizar perfil en Supabase para mantener consistencia
      // (RevenueCat es la fuente de verdad, pero actualizamos Supabase para compatibilidad)
      try {
        await AuthService.updateMyProfile({
          is_premium: true,
        });
        await refreshProfile();
      } catch (profileError) {
        console.warn("[PremiumPaywall] Error al actualizar perfil (no crítico):", profileError);
        // No fallar si esto falla, RevenueCat ya tiene el estado correcto
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({
        message: "¡Bienvenido a Coach Pro! 💎",
        type: "success",
        duration: 3000,
      });

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("[PremiumPaywall] Error:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast({
        message: error instanceof Error ? error.message : "Error al procesar la suscripción",
        type: "error",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const result = await restorePurchases();

      if (!result.ok) {
        throw new Error(result.message || "Error al restaurar compras");
      }

      // Recargar estado
      await reload();

      // Actualizar perfil si se restauró una suscripción activa
      const hasActiveSubscription = result.message?.includes("exitosamente");
      if (hasActiveSubscription) {
        try {
          await AuthService.updateMyProfile({
            is_premium: true,
          });
          await refreshProfile();
        } catch (profileError) {
          console.warn("[PremiumPaywall] Error al actualizar perfil:", profileError);
        }
      }

      Haptics.notificationAsync(
        hasActiveSubscription
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      );
      showToast({
        message: result.message || "Compras restauradas",
        type: hasActiveSubscription ? "success" : "info",
        duration: 3000,
      });

      if (hasActiveSubscription) {
        onSuccess?.();
        onClose();
      }
    } catch (error) {
      console.error("[PremiumPaywall] Error al restaurar:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast({
        message: error instanceof Error ? error.message : "Error al restaurar compras",
        type: "error",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTermsPress = () => {
    Linking.openURL("https://contamacro.app/terms");
  };

  const handlePrivacyPress = () => {
    Linking.openURL("https://contamacro.app/privacy");
  };

  const selectedPlanData = plansData[selectedPlan];
  const monthlyPrice =
    selectedPlan === "annual" && plansData.monthly.price
      ? (plansData.annual.price / 12).toFixed(2)
      : plansData.monthly.price?.toFixed(2) ?? "9.99";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View
        style={[
          s.overlay,
          {
            opacity: opacityAnim,
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        
        <Animated.View
          style={[
            s.container,
            {
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim },
              ],
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
              <Text style={s.title}>Lleva tu Nutrición al Siguiente Nivel</Text>
              <Text style={s.subtitle}>
                Únete a la comunidad Pro y alcanza tus metas un 40% más rápido
              </Text>
            </View>

            {/* Beneficios */}
            <View style={s.benefitsContainer}>
              {BENEFITS.map((benefit, index) => (
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
                  <View style={s.benefitIconContainer}>
                    <MaterialCommunityIcons
                      name={benefit.icon}
                      size={28}
                      color={colors.brand}
                    />
                  </View>
                  <View style={s.benefitTextContainer}>
                    <Text style={s.benefitTitle}>{benefit.title}</Text>
                    <Text style={s.benefitDescription}>{benefit.description}</Text>
                  </View>
                </Animated.View>
              ))}
            </View>

            {/* Selector de Planes */}
            <View style={s.plansContainer}>
              <Text style={s.plansTitle}>Elige tu plan</Text>
              
              {!planPackages && (
                <View style={s.errorContainer}>
                  <MaterialCommunityIcons
                    name="alert-circle"
                    size={24}
                    color={colors.cta}
                  />
                  <Text style={s.errorText}>
                    No hay planes disponibles en este momento. Por favor, intenta más tarde.
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
                        <Text style={s.planPeriod}> / {plansData.monthly.period}</Text>
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
                          <Text style={s.planPeriod}> / {plansData.annual.period}</Text>
                        </Text>
                        {plansData.annual.savings && plansData.annual.savings > 0 && (
                          <View style={s.savingsBadge}>
                            <Text style={s.savingsBadgeText}>
                              Ahorra {plansData.annual.savings}%
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={s.planMonthlyEquivalent}>
                        ${monthlyPrice} / mes
                      </Text>
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
              {plansData.lifetime.package && (
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
                      <Text style={s.planLabel}>{plansData.lifetime.label}</Text>
                      <Text style={s.planPrice}>
                        {plansData.lifetime.priceString}
                        <Text style={s.planPeriod}> / {plansData.lifetime.period}</Text>
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
              )}
            </View>

            {/* Prueba Gratuita */}
            <View style={s.trialContainer}>
              <MaterialCommunityIcons
                name="gift"
                size={20}
                color={colors.brand}
              />
              <Text style={s.trialText}>
                Pruébalo <Text style={s.trialBold}>GRATIS</Text> por 7 días. Luego {plansData.annual.priceString}/año. Cancela cuando quieras.
              </Text>
            </View>

            {/* CTA Principal */}
            <Pressable
              onPress={handleSubscribe}
              disabled={isProcessing || !planPackages || !selectedPlanData?.package}
              style={({ pressed }) => [
                s.ctaButton,
                (pressed || isProcessing || !planPackages || !selectedPlanData?.package) && s.ctaButtonPressed,
              ]}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={colors.onCta} />
              ) : (
                <>
                  <Text style={s.ctaButtonText}>
                    {selectedPlan === "lifetime" 
                      ? "Comprar ahora" 
                      : "Comenzar mi semana gratuita"}
                  </Text>
                  <MaterialCommunityIcons
                    name="arrow-right"
                    size={20}
                    color={colors.onCta}
                  />
                </>
              )}
            </Pressable>

            {/* Botón Restaurar Compras */}
            <Pressable
              onPress={handleRestore}
              disabled={isProcessing}
              style={({ pressed }) => [
                s.restoreButton,
                (pressed || isProcessing) && s.restoreButtonPressed,
              ]}
            >
              <Text style={s.restoreButtonText}>Restaurar compras</Text>
            </Pressable>

            {/* Pie de página */}
            <View style={s.footer}>
              <Pressable onPress={handleTermsPress} style={s.footerLink}>
                <Text style={s.footerLinkText}>Términos de servicio</Text>
              </Pressable>
              <Text style={s.footerSeparator}> • </Text>
              <Pressable onPress={handlePrivacyPress} style={s.footerLink}>
                <Text style={s.footerLinkText}>Política de privacidad</Text>
              </Pressable>
            </View>
          </ScrollView>

          {/* Botón cerrar */}
          <Pressable
            onPress={onClose}
            style={s.closeButton}
          >
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
      backgroundColor: colors.brand + "15",
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
      marginBottom: 24,
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
    restoreButton: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    restoreButtonPressed: {
      opacity: 0.7,
    },
    restoreButtonText: {
      ...typography.body,
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    closeButton: {
      position: "absolute",
      top: 16,
      right: 16,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10,
    },
  });
}
