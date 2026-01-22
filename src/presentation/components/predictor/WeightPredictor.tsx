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
  const translateX = useRef(new Animated.Value(0)).current; // Panel en posición normal
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
        daysWithData > 0
          ? (totalConsumed - totalBurned) / daysWithData
          : 0;

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
    transform: [{ translateX }],
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
      tension: 200,
      friction: 15,
      useNativeDriver: true,
    };

    if (newExpanded) {
      // Primero establecer el estado para renderizar el panel
      setIsExpanded(true);
      // El panel está posicionado con right: 18
      // translateX positivo lo mueve hacia la derecha (fuera de pantalla)
      // translateX negativo lo mueve hacia la izquierda
      // Empezamos fuera de pantalla (a la derecha) y animamos a 0
      const panelWidth = Math.min(SCREEN_WIDTH - 100, 320);
      translateX.setValue(panelWidth + 18); // Fuera de pantalla a la derecha
      opacity.setValue(0);
      // Luego animar desde fuera de la pantalla (derecha) hacia su posición
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 0.9,
          ...springConfig,
        }),
        Animated.spring(translateX, {
          toValue: 0, // Panel en su posición normal (right: 18)
          ...springConfig,
        }),
        Animated.spring(opacity, {
          toValue: 1,
          ...springConfig,
        }),
      ]).start();
    } else {
      // Primero animar hacia fuera (hacia la derecha)
      const panelWidth = Math.min(SCREEN_WIDTH - 100, 320);
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          ...springConfig,
        }),
        Animated.spring(translateX, {
          toValue: panelWidth + 18, // Mover fuera de la pantalla hacia la derecha
          ...springConfig,
        }),
        Animated.spring(opacity, {
          toValue: 0,
          ...springConfig,
        }),
      ]).start(() => {
        // Después de la animación, ocultar el panel
        setIsExpanded(false);
      });
    }
  }, [isExpanded, scale, translateX, opacity]);

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
  const getIconName = (): React.ComponentProps<typeof MaterialCommunityIcons>["name"] => {
    if (!hasEnoughData) return "help-circle";
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
        <Pressable onPress={handleToggle} style={s.buttonPressable}>
          <MaterialCommunityIcons
            name={getIconName()}
            size={24}
            color={colors.onCta}
          />
          <Text style={s.buttonLabel}>PREDICCIÓN</Text>
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
            <Pressable
              style={s.backdrop}
              onPress={handleToggle}
            />
          </Animated.View>
          {/* Panel con contenido */}
          <Animated.View
            style={[s.panel, animatedPanelStyle]}
            pointerEvents="auto"
            collapsable={false}
          >
            <View style={s.blurContainer}>
              {/* Avatar - Solo si está disponible */}
              {profile?.avatar_url && (
                <View style={s.avatarContainer}>
                  <Avatar
                    avatarUrl={profile.avatar_url}
                    fullName={profile.full_name}
                    size={28}
                    colors={colors}
                    typography={typography}
                  />
                </View>
              )}

              {/* Contenido - Protagonista: flecha y número */}
              <View style={s.content}>
                {loading ? (
                  <Text style={s.loadingText}>Calculando...</Text>
                ) : !hasEnoughData ? (
                  <>
                    <View style={s.errorContainer}>
                      <MaterialCommunityIcons
                        name="help-circle"
                        size={40}
                        color={colors.textSecondary}
                      />
                    </View>
                    <View style={s.messageContainer}>
                      <Text style={s.coachMessage}>{getCoachMessage()}</Text>
                    </View>
                  </>
                ) : (
                  <>
                    {/* Valor principal con icono */}
                    <View style={s.predictionRow}>
                      <MaterialCommunityIcons
                        name={getIconName()}
                        size={36}
                        color={getPredictionColor()}
                      />
                      <View style={{ marginLeft: 12 }}>
                        <Text style={[s.predictionValue, { color: getPredictionColor() }]}>
                          {isPositive ? "+" : ""}
                          {weightChange.toFixed(1)} kg
                        </Text>
                      </View>
                    </View>
                    {/* Etiqueta "Tendencia mensual" */}
                    <Text style={s.trendLabel}>Tendencia mensual</Text>
                    
                    {/* Mensaje del coach */}
                    <View style={s.messageContainer}>
                      <Text style={s.coachMessage}>{getCoachMessage()}</Text>
                    </View>
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
      bottom: 100,
      width: Math.min(SCREEN_WIDTH - 100, 320),
      zIndex: 1000,
    },
    blurContainer: {
      borderRadius: 24,
      overflow: "hidden",
      backgroundColor: colors.surface + "F2", // 95% opacidad
      padding: 30,
      paddingBottom: 24,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 8,
    },
    avatarContainer: {
      position: "absolute",
      top: 16,
      right: 16,
    },
    content: {
      alignItems: "flex-start",
      justifyContent: "flex-start",
      minHeight: 120,
      paddingRight: 40, // Espacio para el botón cerrar
      width: "100%",
    },
    predictionRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 4,
    },
    predictionValue: {
      fontFamily: typography.heading?.fontFamily,
      fontSize: 36,
      fontWeight: "700",
    },
    trendLabel: {
      fontFamily: typography.caption?.fontFamily,
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: "500",
      marginBottom: 16,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    messageContainer: {
      marginTop: 8,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border + "40",
      width: "100%",
    },
    coachMessage: {
      fontFamily: typography.body?.fontFamily,
      fontSize: 13,
      color: colors.textPrimary,
      lineHeight: 20,
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
      top: 12,
      left: 12,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
      opacity: 0.7,
      zIndex: 10,
    },
  });
}
