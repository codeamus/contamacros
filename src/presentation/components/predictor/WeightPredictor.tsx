// src/presentation/components/predictor/WeightPredictor.tsx
import { activityLogRepository } from "@/data/activity/activityLogRepository";
import { foodLogRepository } from "@/data/food/foodLogRepository";
import { Avatar } from "@/presentation/components/ui/Avatar";
import { useAuth } from "@/presentation/hooks/auth/AuthProvider";
import { usePremium } from "@/presentation/hooks/subscriptions/usePremium";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

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

  // Animaciones con Animated de React Native
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current; // Panel en posición normal (arriba del botón)
  const opacity = useRef(new Animated.Value(0)).current;

  // Calcular predicción - Optimizado para 7 días
  const calculatePrediction = useCallback(async () => {
    if (!isPremium || !profile) {
      setPrediction(null);
      return;
    }

    setLoading(true);
    try {
      // Obtener datos de los últimos 7 días (optimizado)
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // Incluye hoy, así que 6 días atrás

      const startDate = sevenDaysAgo.toISOString().split("T")[0] || "";
      const endDate = today.toISOString().split("T")[0] || "";

      if (!startDate || !endDate) {
        throw new Error("Error al calcular fechas");
      }

      // Obtener datos en una sola consulta por rango
      const [foodRes, activityRes] = await Promise.all([
        foodLogRepository.getDailySummaries(startDate, endDate),
        activityLogRepository.getRecentActivity(7),
      ]);

      // Crear mapas para acceso rápido
      const foodMap = new Map<string, number>();
      if (foodRes.ok) {
        foodRes.data.forEach((item) => {
          foodMap.set(item.day, item.calories);
        });
      }

      const activityMap = new Map<string, number>();
      if (activityRes.ok && activityRes.data) {
        activityRes.data.forEach((item) => {
          if (item.day && item.day >= startDate && item.day <= endDate) {
            activityMap.set(item.day, item.calories_burned || 0);
          }
        });
      }

      // Calcular totales
      let totalConsumed = 0;
      let totalBurned = 0;
      let daysWithData = 0;

      // Iterar sobre los 7 días
      for (let i = 0; i < 7; i++) {
        const date = new Date(sevenDaysAgo);
        date.setDate(date.getDate() + i);
        const dayStr = date.toISOString().split("T")[0] || "";
        if (!dayStr) continue;

        const dayConsumed = foodMap.get(dayStr) || 0;
        const dayBurned = activityMap.get(dayStr) || 0;

        if (dayConsumed > 0 || dayBurned > 0) {
          totalConsumed += dayConsumed;
          totalBurned += dayBurned;
          daysWithData++;
        }
      }

      // Calcular balance promedio diario de los 7 días
      const avgDailyBalance =
        daysWithData > 0 ? (totalConsumed - totalBurned) / daysWithData : 0;

      // Calcular consistencia (basada en 7 días, pero validamos con 20% mínimo)
      const consistency = (daysWithData / 7) * 100;

      // Aplicar fórmula: (Balance diario promedio * 30) / 7700
      // Multiplicamos por 30 para proyectar a un mes, aunque los datos sean de 7 días
      // 7700 kcal ≈ 1 kg de grasa
      const weightChange = (avgDailyBalance * 30) / 7700;

      setPrediction({
        weightChange: Math.round(weightChange * 10) / 10, // 1 decimal
        consistency: Math.round(consistency),
        hasEnoughData: consistency >= 20, // Al menos 2 días de datos (20% de 7 días)
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

  // Estilos animados
  const animatedButtonStyle = {
    transform: [{ scale }],
  };

  const animatedPanelStyle = {
    transform: [{ translateY }],
  };

  const animatedBackdropStyle = {
    opacity,
  };

  const handleToggle = useCallback(() => {
    const newExpanded = !isExpanded;

    // Vibración sutil y satisfactoria al abrir
    if (newExpanded) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const springConfig = {
      tension: 300,
      friction: 20,
      useNativeDriver: true,
    };

    const closeConfig = {
      tension: 400,
      friction: 25,
      useNativeDriver: true,
    };

    if (newExpanded) {
      // Primero establecer el estado para renderizar el panel
      setIsExpanded(true);
      // El panel se abre de abajo hacia arriba
      // translateY positivo lo mueve hacia abajo (fuera de vista)
      // translateY negativo lo mueve hacia arriba
      // Empezamos abajo (fuera de vista) y animamos a 0
      translateY.setValue(30); // Empezar un poco abajo
      opacity.setValue(0);
      // Luego animar desde abajo hacia arriba
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 0.95,
          ...springConfig,
        }),
        Animated.spring(translateY, {
          toValue: 0, // Panel en su posición normal
          ...springConfig,
        }),
        Animated.spring(opacity, {
          toValue: 1,
          ...springConfig,
        }),
      ]).start();
    } else {
      // Animar hacia abajo (ocultar) - más rápido
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          ...closeConfig,
        }),
        Animated.spring(translateY, {
          toValue: 30, // Mover hacia abajo para ocultar
          ...closeConfig,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150, // Animación más rápida para el fade out
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Después de la animación, ocultar el panel
        setIsExpanded(false);
      });
    }
  }, [isExpanded, scale, translateY, opacity]);

  // No mostrar si no es premium
  if (!isPremium) {
    return null;
  }

  const weightChange = prediction?.weightChange ?? 0;
  const isPositive = weightChange > 0.5;
  const isNegative = weightChange < -0.5;
  const hasEnoughData = prediction?.hasEnoughData ?? false;

  // Obtener nombre del usuario (primera palabra del nombre completo o "Usuario")
  const userName = profile?.full_name?.split(" ")[0] || "Usuario";

  // Mensaje amigable según el estado
  const getCoachMessage = () => {
    if (!hasEnoughData) {
      return `¡Me faltan datos para conocer tu futuro! Registra tus comidas de hoy para darte una predicción exacta.`;
    }
    if (isPositive) {
      return `¡Hola ${userName}! Vas por buen camino si buscas ganar volumen. Tu balance actual proyecta +${Math.abs(weightChange).toFixed(1)}kg en un mes. ¡A darle duro al entrenamiento!`;
    }
    if (isNegative) {
      return `¡Excelente ritmo, ${userName}! Estás en déficit y podrías bajar ${Math.abs(weightChange).toFixed(1)}kg en 30 días. ¡Mantén esa disciplina!`;
    }
    // Estable (entre -0.5 y 0.5)
    return `¡Estás en el punto de equilibrio, ${userName}! Tu peso se mantendrá estable este mes. Ideal para mantener tus resultados.`;
  };

  // Color según el estado (verde esmeralda para pérdida, naranja suave para superávit)
  const getPredictionColor = () => {
    if (!hasEnoughData) return colors.textSecondary;
    if (isPositive) return "#FB923C"; // Naranja suave
    if (isNegative) return "#10B981"; // Verde esmeralda
    return colors.textSecondary; // Gris para estable
  };

  // Icono según el estado
  const getIconName = (): React.ComponentProps<
    typeof MaterialCommunityIcons
  >["name"] => {
    if (!hasEnoughData) return "information-outline";
    if (isPositive) return "trending-up";
    if (isNegative) return "trending-down";
    return "minus-circle";
  };

  return (
    <>
      {/* Botón flotante */}
      <Animated.View
        style={[s.floatingButton, animatedButtonStyle]}
        pointerEvents="box-none"
      >
        <Pressable onPress={handleToggle} style={s.buttonPressable(colors)}>
          <MaterialCommunityIcons
            name="chart-timeline-variant"
            size={22}
            color={colors.brand}
          />
        </Pressable>
      </Animated.View>

      {/* Panel expandido - Solo renderizar cuando está expandido */}
      {isExpanded && (
        <View style={s.panelContainer} pointerEvents="box-none">
          {/* Backdrop oscuro */}
          <Animated.View
            style={[s.backdropContainer, animatedBackdropStyle]}
            pointerEvents="auto"
          >
            <Pressable style={s.backdrop} onPress={handleToggle} />
          </Animated.View>
          {/* Panel con contenido */}
          <Animated.View
            style={[s.panel, animatedPanelStyle]}
            pointerEvents="auto"
            collapsable={false}
          >
            <View style={s.blurContainer}>
              {/* Avatar - Siempre mostrar, con placeholder si no hay avatar */}
              <View style={s.avatarContainer}>
                <Avatar
                  avatarUrl={profile?.avatar_url || null}
                  fullName={profile?.full_name || "Usuario"}
                  size={32}
                  colors={colors}
                  typography={typography}
                />
              </View>

              {/* Contenido - Minimalista */}
              <View style={s.content}>
                {loading ? (
                  <Text style={s.loadingText}>Calculando...</Text>
                ) : !hasEnoughData ? (
                  <>
                    <MaterialCommunityIcons
                      name="information-outline"
                      size={24}
                      color={colors.textSecondary}
                      style={{ marginBottom: 12 }}
                    />
                    <Text style={s.coachMessage}>{getCoachMessage()}</Text>
                  </>
                ) : (
                  <>
                    {/* Valor principal - Minimalista */}
                    <View style={s.predictionRow}>
                      <MaterialCommunityIcons
                        name={getIconName()}
                        size={28}
                        color={getPredictionColor()}
                      />
                      <Text
                        style={[
                          s.predictionValue,
                          { color: getPredictionColor() },
                        ]}
                      >
                        {isPositive ? "+" : ""}
                        {weightChange.toFixed(1)} kg
                      </Text>
                    </View>

                    {/* Mensaje del coach - Minimalista */}
                    <Text style={s.coachMessage}>{getCoachMessage()}</Text>
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
            </View>
          </Animated.View>
        </View>
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
    buttonPressable: (colors: any) => ({
      alignItems: "center",
      justifyContent: "center",
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
    }),
    panelContainer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 999,
    },
    backdropContainer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.3)",
    },
    panel: {
      position: "absolute",
      right: 18,
      bottom: 180, // Aparece arriba del botón (botón está en bottom: 100, altura ~56px, gap ~24px)
      width: Math.min(SCREEN_WIDTH - 100, 320),
      zIndex: 1000,
    },
    blurContainer: {
      borderRadius: 20,
      overflow: "hidden",
      backgroundColor: colors.surface + "F5", // 96% opacidad
      padding: 24,
      paddingTop: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 6,
    },
    avatarContainer: {
      position: "absolute",
      top: 16,
      right: 16,
    },
    content: {
      alignItems: "flex-start",
      justifyContent: "flex-start",
      minHeight: 80,
      paddingRight: 56, // Más espacio para avatar y botón cerrar (evitar choque)
      paddingLeft: 20, // Padding izquierdo para evitar choque con botón cerrar
      width: "100%",
    },
    predictionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
    },
    predictionValue: {
      fontFamily: typography.heading?.fontFamily,
      fontSize: 28,
      fontWeight: "700",
    },
    coachMessage: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 12,
      color: colors.textPrimary,
      lineHeight: 18,
      fontWeight: "400",
    },
    loadingText: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 14,
      color: colors.textSecondary,
    },
    errorContainer: {
      alignItems: "center",
    },
    errorText: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    closeButton: {
      position: "absolute",
      top: 8,
      left: 8,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
      opacity: 0.6,
      zIndex: 10,
    },
  });
}
