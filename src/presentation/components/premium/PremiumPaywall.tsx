// src/presentation/components/premium/PremiumPaywall.tsx
import { AuthService } from "@/domain/services/authService";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { useToast } from "@/presentation/hooks/ui/useToast";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
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

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type PremiumPlan = "monthly" | "annual";

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

const PLANS = {
  monthly: {
    price: 9.99,
    period: "mes",
    label: "Plan Mensual",
  },
  annual: {
    price: 49.99,
    period: "año",
    label: "Plan Anual",
    savings: 50,
    popular: true,
  },
};

export default function PremiumPaywall({
  visible,
  onClose,
  onSuccess,
}: PremiumPaywallProps) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const { profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const s = makeStyles(colors, typography);

  const [selectedPlan, setSelectedPlan] = useState<PremiumPlan>("annual");
  const [isProcessing, setIsProcessing] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

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

    setIsProcessing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // TODO: Integrar con sistema de pagos real (Stripe, RevenueCat, etc.)
      // Por ahora, simulamos la activación premium
      console.log("[PremiumPaywall] Procesando suscripción:", selectedPlan);

      // Simular delay de procesamiento
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Actualizar perfil a premium
      const res = await AuthService.updateMyProfile({
        is_premium: true,
      });

      if (!res.ok) {
        throw new Error(res.message || "Error al activar premium");
      }

      // Refrescar perfil
      await refreshProfile();

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

  const handleTermsPress = () => {
    Linking.openURL("https://contamacro.app/terms");
  };

  const handlePrivacyPress = () => {
    Linking.openURL("https://contamacro.app/privacy");
  };

  const selectedPlanData = PLANS[selectedPlan];
  const monthlyPrice = selectedPlan === "annual" 
    ? (PLANS.annual.price / 12).toFixed(2)
    : PLANS.monthly.price.toFixed(2);

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
              
              {/* Plan Mensual */}
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
                    <Text style={s.planLabel}>{PLANS.monthly.label}</Text>
                    <Text style={s.planPrice}>
                      ${PLANS.monthly.price.toFixed(2)}
                      <Text style={s.planPeriod}> / {PLANS.monthly.period}</Text>
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

              {/* Plan Anual */}
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
                {PLANS.annual.popular && (
                  <View style={s.popularBadge}>
                    <Text style={s.popularBadgeText}>MÁS POPULAR</Text>
                  </View>
                )}
                <View style={s.planHeader}>
                  <View style={s.planInfo}>
                    <Text style={s.planLabel}>{PLANS.annual.label}</Text>
                    <View style={s.planPriceRow}>
                      <Text style={s.planPrice}>
                        ${PLANS.annual.price.toFixed(2)}
                        <Text style={s.planPeriod}> / {PLANS.annual.period}</Text>
                      </Text>
                      <View style={s.savingsBadge}>
                        <Text style={s.savingsBadgeText}>
                          Ahorra {PLANS.annual.savings}%
                        </Text>
                      </View>
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
            </View>

            {/* Prueba Gratuita */}
            <View style={s.trialContainer}>
              <MaterialCommunityIcons
                name="gift"
                size={20}
                color={colors.brand}
              />
              <Text style={s.trialText}>
                Pruébalo <Text style={s.trialBold}>GRATIS</Text> por 7 días. Luego ${PLANS.annual.price.toFixed(2)}/año. Cancela cuando quieras.
              </Text>
            </View>

            {/* CTA Principal */}
            <Pressable
              onPress={handleSubscribe}
              disabled={isProcessing}
              style={({ pressed }) => [
                s.ctaButton,
                (pressed || isProcessing) && s.ctaButtonPressed,
              ]}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={colors.onCta} />
              ) : (
                <>
                  <Text style={s.ctaButtonText}>Comenzar mi semana gratuita</Text>
                  <MaterialCommunityIcons
                    name="arrow-right"
                    size={20}
                    color={colors.onCta}
                  />
                </>
              )}
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
