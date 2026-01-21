// src/presentation/components/smartCoach/SmartCoachPro.tsx
import { foodLogRepository } from "@/data/food/foodLogRepository";
import type { SmartCoachRecommendation } from "@/domain/models/smartCoach";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { todayStrLocal } from "@/presentation/utils/date";
import * as Haptics from "expo-haptics";

/**
 * Mapea nombres de iconos inválidos a iconos válidos de MaterialCommunityIcons
 */
function getValidExerciseIcon(iconName: string | null | undefined): React.ComponentProps<typeof MaterialCommunityIcons>["name"] {
  if (!iconName) return "run";
  
  const iconMap: Record<string, React.ComponentProps<typeof MaterialCommunityIcons>["name"]> = {
    "droplet": "water", // Natación - usar "water" en lugar de "droplet"
    "zap": "lightning-bolt", // HIIT
    "walking": "walk", // Caminata
    "run": "run", // Running
    "activity": "dumbbell", // Saltar la cuerda
    "flower": "flower", // Yoga
    "bike": "bike", // Bicicleta
  };
  
  return iconMap[iconName.toLowerCase()] || iconName as any || "run";
}

type SmartCoachProProps = {
  recommendation: SmartCoachRecommendation | null;
  loading: boolean;
  isPremium: boolean;
  onUpgrade?: () => void;
};

export default function SmartCoachPro({
  recommendation,
  loading,
  isPremium,
  onUpgrade,
}: SmartCoachProProps) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const s = makeStyles(colors, typography);
  const [isAdding, setIsAdding] = useState(false);

  const handleQuickAdd = useCallback(async () => {
    if (!recommendation || recommendation.type === "exercise") return;

    const food = recommendation.recommendedFood;
    const day = todayStrLocal();
    const meal = getMealByHour();

    const grams = food.recommendedAmount;
    const factor = grams / 100;
    const calories = Math.round(food.kcal_100g * factor);
    const protein = Math.round(food.protein_100g * factor);
    const carbs = Math.round(food.carbs_100g * factor);
    const fat = Math.round(food.fat_100g * factor);

    setIsAdding(true);
    try {
      const res = await foodLogRepository.create({
        day,
        meal,
        name: food.name,
        grams,
        calories,
        protein_g: protein,
        carbs_g: carbs,
        fat_g: fat,
        source: null,
        off_id: null,
        source_type: null,
        food_id: null,
        user_food_id: null,
      });

      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsAdding(false);
    }
  }, [recommendation]);

  function getMealByHour(): "breakfast" | "lunch" | "dinner" | "snack" {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return "breakfast";
    if (hour >= 11 && hour < 15) return "lunch";
    if (hour >= 15 && hour < 19) return "snack";
    return "dinner";
  }

  // Estado no premium (paywall con blur effect)
  if (!isPremium) {
    return (
      <View style={s.container}>
        <View style={[s.card, s.premiumCard]}>
          {/* Overlay con blur effect */}
          <View style={[s.blurOverlay, { backgroundColor: colors.surface + "E6" }]} />
          
          <View style={s.premiumContent}>
            <View style={[s.iconContainer, s.premiumIconContainer]}>
              <MaterialCommunityIcons
                name="lock"
                size={28}
                color={colors.brand}
              />
            </View>
            <View style={s.premiumTextContainer}>
              <Text style={s.premiumTitle}>Coach Pro 💎</Text>
              <Text style={s.premiumBody}>
                Desbloquea recomendaciones personalizadas de macros y ejercicio con Coach Pro
              </Text>
            </View>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onUpgrade?.();
                router.push("/(tabs)/settings");
              }}
              style={({ pressed }) => [
                s.upgradeButton,
                pressed && s.upgradeButtonPressed,
              ]}
            >
              <Text style={s.upgradeButtonText}>Desbloquear Coach Pro</Text>
              <MaterialCommunityIcons
                name="arrow-right"
                size={18}
                color={colors.onCta}
              />
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // Estado cargando
  if (loading) {
    return (
      <View style={s.container}>
        <View style={[s.card, s.loadingCard]}>
          <ActivityIndicator size="small" color={colors.brand} />
          <Text style={s.loadingText}>Analizando tu progreso...</Text>
        </View>
      </View>
    );
  }

  // Sin recomendación
  if (!recommendation) {
    return null;
  }

  // ESCENARIO C: Recomendación de ejercicio
  if (recommendation.type === "exercise") {
    const firstExercise = recommendation.exercises[0];
    return (
      <View style={s.container}>
        <View style={[s.card, s.exerciseCard]}>
          <View style={s.content}>
            <View style={[s.iconContainer, s.exerciseIconContainer]}>
              <MaterialCommunityIcons
                name={getValidExerciseIcon(firstExercise.exercise.icon_name)}
                size={28}
                color={colors.cta}
              />
            </View>
            <View style={s.textContainer}>
              <Text style={s.title}>Coach Pro</Text>
              <Text style={s.message}>{recommendation.message}</Text>
              <View style={s.exercisesContainer}>
                {recommendation.exercises.map(({ exercise, minutesNeeded }) => (
                  <View key={exercise.id} style={s.exerciseItem}>
                    <MaterialCommunityIcons
                      name={getValidExerciseIcon(exercise.icon_name)}
                      size={20}
                      color={colors.cta}
                    />
                    <Text style={s.exerciseItemText}>
                      {exercise.name_es}: {Math.round(minutesNeeded)} min
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // ESCENARIO A y B: Recomendación de comida
  const food = recommendation.recommendedFood;
  const isFromHistory = food.source === "history";

  return (
    <View style={s.container}>
      <View style={[s.card, s.foodCard]}>
        <View style={s.content}>
          <View style={[s.iconContainer, s.foodIconContainer]}>
            <MaterialCommunityIcons
              name="food-apple"
              size={28}
              color={colors.brand}
            />
          </View>
          <View style={s.textContainer}>
            <View style={s.headerRow}>
              <Text style={s.title}>Coach Pro</Text>
              {isFromHistory && (
                <View style={s.historyBadge}>
                  <MaterialCommunityIcons
                    name="history"
                    size={12}
                    color={colors.brand}
                  />
                  <Text style={s.historyBadgeText}>De tu historial</Text>
                </View>
              )}
            </View>
            <Text style={s.message}>{recommendation.message}</Text>

            {/* Información nutricional */}
            <View style={s.nutritionInfo}>
              <Text style={s.nutritionText}>
                {food.recommendedAmount}
                {food.unitLabel ? ` ${food.unitLabel}` : "g"} •{" "}
                {Math.round(
                  (food.kcal_100g * food.recommendedAmount) / 100,
                )}{" "}
                kcal
              </Text>
              {food.timesEaten && food.timesEaten > 1 && (
                <Text style={s.historyInfo}>
                  Lo has comido {food.timesEaten} veces en los últimos 30 días
                </Text>
              )}
            </View>

            {/* Botón Quick Add */}
            <Pressable
              onPress={handleQuickAdd}
              disabled={isAdding}
              style={({ pressed }) => [
                s.quickAddButton,
                (pressed || isAdding) && s.quickAddButtonPressed,
              ]}
            >
              {isAdding ? (
                <ActivityIndicator size="small" color={colors.onCta} />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="plus-circle"
                    size={18}
                    color={colors.onCta}
                  />
                  <Text style={s.quickAddButtonText}>Agregar</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    container: {
      marginHorizontal: 16,
      marginVertical: 8,
    },
    card: {
      borderRadius: 16,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    premiumCard: {
      position: "relative",
      overflow: "hidden",
    },
    blurOverlay: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.95,
    },
    premiumIconContainer: {
      borderColor: colors.brand + "40",
      backgroundColor: colors.brand + "15",
    },
    foodCard: {
      borderLeftWidth: 4,
      borderLeftColor: colors.brand,
    },
    exerciseCard: {
      borderLeftWidth: 4,
      borderLeftColor: colors.cta,
    },
    loadingCard: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 32,
      gap: 12,
    },
    loadingText: {
      ...typography.body,
      color: colors.textSecondary,
    },
    premiumContent: {
      padding: 20,
      gap: 16,
      alignItems: "center",
    },
    content: {
      padding: 16,
      gap: 12,
    },
    iconContainer: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
    },
    foodIconContainer: {
      borderColor: colors.brand + "40",
      backgroundColor: colors.brand + "15",
    },
    exerciseIconContainer: {
      borderColor: colors.cta + "40",
      backgroundColor: colors.cta + "15",
    },
    textContainer: {
      flex: 1,
      gap: 8,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
    },
    title: {
      ...typography.subtitle,
      fontWeight: "700",
      color: colors.textPrimary,
      fontSize: 18,
    },
    message: {
      ...typography.body,
      color: colors.textPrimary,
      lineHeight: 22,
      fontSize: 15,
    },
    historyBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: colors.brand + "20",
    },
    historyBadgeText: {
      ...typography.caption,
      fontSize: 11,
      fontWeight: "600",
      color: colors.brand,
    },
    nutritionInfo: {
      marginTop: 4,
      gap: 4,
    },
    nutritionText: {
      ...typography.caption,
      fontSize: 12,
      color: colors.textSecondary,
    },
    historyInfo: {
      ...typography.caption,
      fontSize: 11,
      color: colors.textSecondary,
      fontStyle: "italic",
    },
    quickAddButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginTop: 8,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: colors.brand,
    },
    quickAddButtonPressed: {
      opacity: 0.8,
    },
    quickAddButtonText: {
      ...typography.button,
      color: colors.onCta,
      fontWeight: "600",
    },
    exercisesContainer: {
      marginTop: 8,
      gap: 8,
    },
    exerciseItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.surface,
    },
    exerciseItemText: {
      ...typography.body,
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: "500",
    },
    premiumTitle: {
      ...typography.subtitle,
      fontWeight: "700",
      fontSize: 20,
      color: colors.textPrimary,
    },
    premiumTextContainer: {
      alignItems: "center",
      gap: 8,
    },
    premiumBody: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
    },
    upgradeButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 12,
      backgroundColor: colors.brand,
    },
    upgradeButtonPressed: {
      opacity: 0.8,
    },
    upgradeButtonText: {
      ...typography.button,
      color: colors.onCta,
      fontWeight: "600",
      fontSize: 15,
    },
  });
}
