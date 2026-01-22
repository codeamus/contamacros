// src/presentation/components/predictor/WeightPredictor.tsx
import { activityLogRepository } from "@/data/activity/activityLogRepository";
import { foodLogRepository } from "@/data/food/foodLogRepository";
import { Avatar } from "@/presentation/components/ui/Avatar";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { usePremium } from "@/presentation/hooks/subscriptions/usePremium";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface PredictionData {
  weightChange: number; // en kg
  consistency: number; // porcentaje
  hasEnoughData: boolean;
}

export default function WeightPredictor() {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const { profile } = useAuth();
  const { isPremium } = usePremium();
  const s = makeStyles(colors, typography);

  const [isExpanded, setIsExpanded] = useState(false);
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(false);

  // Animaciones
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);

  // Calcular predicción
  const calculatePrediction = useCallback(async () => {
    if (!isPremium || !profile) {
      setPrediction(null);
      return;
    }

    setLoading(true);
    try {
      // Obtener datos de los últimos 30 días
      const today = new Date();
      const days: string[] = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dayStr = date.toISOString().split("T")[0];
        days.push(dayStr);
      }

      // Obtener calorías consumidas y quemadas
      let totalConsumed = 0;
      let totalBurned = 0;
      let daysWithData = 0;

      for (const day of days) {
        const [foodRes, activityRes] = await Promise.all([
          foodLogRepository.listByDay(day),
          activityLogRepository.getTodayCalories(day),
        ]);

        const dayConsumed = foodRes.ok
          ? foodRes.data.reduce((sum, log) => sum + (log.calories || 0), 0)
          : 0;
        const dayBurned = activityRes.ok ? activityRes.data : 0;

        if (dayConsumed > 0 || dayBurned > 0) {
          totalConsumed += dayConsumed;
          totalBurned += dayBurned;
          daysWithData++;
        }
      }

      // Calcular balance promedio diario
      const avgDailyBalance =
        daysWithData > 0
          ? (totalConsumed - totalBurned) / daysWithData
          : 0;

      // Calcular consistencia
      const consistency = (daysWithData / 30) * 100;

      // Aplicar fórmula: (Balance diario * 30) / 7700
      // 7700 kcal ≈ 1 kg de grasa
      const weightChange = (avgDailyBalance * 30) / 7700;

      setPrediction({
        weightChange: Math.round(weightChange * 10) / 10, // 1 decimal
        consistency: Math.round(consistency),
        hasEnoughData: consistency >= 20,
      });
    } catch (error) {
      console.error("[WeightPredictor] Error calculando predicción:", error);
      setPrediction(null);
    } finally {
      setLoading(false);
    }
  }, [isPremium, profile]);

  useEffect(() => {
    calculatePrediction();
  }, [calculatePrediction]);

  // Animaciones
  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedPanelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  const handleToggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);

    if (newExpanded) {
      scale.value = withSpring(0.9, {
        damping: 15,
        stiffness: 200,
      });
      translateX.value = withSpring(-SCREEN_WIDTH + 120, {
        damping: 15,
        stiffness: 200,
      });
      opacity.value = withSpring(1, {
        damping: 15,
        stiffness: 200,
      });
    } else {
      scale.value = withSpring(1, {
        damping: 15,
        stiffness: 200,
      });
      translateX.value = withSpring(0, {
        damping: 15,
        stiffness: 200,
      });
      opacity.value = withSpring(0, {
        damping: 15,
        stiffness: 200,
      });
    }
  }, [isExpanded, scale, translateX, opacity]);

  // No mostrar si no es premium
  if (!isPremium) {
    return null;
  }

  const weightChange = prediction?.weightChange ?? 0;
  const isPositive = weightChange > 0;
  const hasEnoughData = prediction?.hasEnoughData ?? false;

  return (
    <>
      {/* Botón flotante */}
      <Animated.View
        style={[s.floatingButton, animatedButtonStyle]}
        pointerEvents="box-none"
      >
        <Pressable onPress={handleToggle} style={s.buttonPressable}>
          <MaterialCommunityIcons
            name="trending-up"
            size={24}
            color={colors.onCta}
          />
          <Text style={s.buttonLabel}>PREDICCIÓN</Text>
        </Pressable>
      </Animated.View>

      {/* Panel expandido */}
      {isExpanded && (
        <Animated.View
          style={[s.panelContainer, animatedPanelStyle]}
          pointerEvents="box-none"
        >
          <Pressable
            style={s.backdrop}
            onPress={handleToggle}
            activeOpacity={1}
          />
          <View style={s.panel}>
            <BlurView intensity={80} style={s.blurContainer}>
              {/* Avatar */}
              {profile && (
                <View style={s.avatarContainer}>
                  <Avatar
                    avatarUrl={profile.avatar_url}
                    fullName={profile.full_name}
                    size={32}
                    colors={colors}
                    typography={typography}
                  />
                </View>
              )}

              {/* Contenido */}
              <View style={s.content}>
                {loading ? (
                  <Text style={s.loadingText}>Calculando...</Text>
                ) : !hasEnoughData ? (
                  <View style={s.errorContainer}>
                    <MaterialCommunityIcons
                      name="alert-circle-outline"
                      size={32}
                      color={colors.textSecondary}
                    />
                    <Text style={s.errorText}>Faltan datos</Text>
                  </View>
                ) : (
                  <>
                    <View style={s.predictionRow}>
                      <MaterialCommunityIcons
                        name={isPositive ? "arrow-up" : "arrow-down"}
                        size={28}
                        color={isPositive ? "#EF4444" : "#10B981"}
                      />
                      <Text style={s.predictionValue}>
                        {isPositive ? "+" : ""}
                        {weightChange} kg
                      </Text>
                    </View>
                    <Text style={s.predictionLabel}>En 30 días</Text>
                  </>
                )}
              </View>

              {/* Botón cerrar */}
              <Pressable onPress={handleToggle} style={s.closeButton}>
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color={colors.textSecondary}
                />
              </Pressable>
            </BlurView>
          </View>
        </Animated.View>
      )}
    </>
  );
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    floatingButton: {
      position: "absolute",
      bottom: 100,
      right: 18,
      zIndex: 1000,
    },
    buttonPressable: {
      alignItems: "center",
      justifyContent: "center",
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.brand,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 6,
    },
    buttonLabel: {
      fontFamily: typography.caption?.fontFamily,
      fontSize: 7,
      fontWeight: "700",
      color: colors.onCta,
      marginTop: 2,
      letterSpacing: 0.5,
    },
    panelContainer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 999,
    },
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.3)",
    },
    panel: {
      position: "absolute",
      right: 18,
      bottom: 100,
      width: SCREEN_WIDTH - 100,
      maxWidth: 320,
    },
    blurContainer: {
      borderRadius: 24,
      overflow: "hidden",
      backgroundColor: colors.surface + "E0",
      padding: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
    avatarContainer: {
      position: "absolute",
      top: 16,
      right: 16,
    },
    content: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 120,
    },
    predictionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 8,
    },
    predictionValue: {
      fontFamily: typography.heading?.fontFamily,
      fontSize: 36,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    predictionLabel: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    loadingText: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 14,
      color: colors.textSecondary,
    },
    errorContainer: {
      alignItems: "center",
      gap: 12,
    },
    errorText: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    closeButton: {
      position: "absolute",
      top: 12,
      left: 12,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surface + "80",
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
