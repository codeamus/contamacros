// src/presentation/components/smartCoach/SmartCoachCard.tsx
import type { SmartCoachRecommendation } from "@/domain/models/smartCoach";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

type SmartCoachCardProps = {
  recommendation: SmartCoachRecommendation | null;
  loading: boolean;
  isPremium: boolean;
  onUpgrade?: () => void;
};

export default function SmartCoachCard({
  recommendation,
  loading,
  isPremium,
  onUpgrade,
}: SmartCoachCardProps) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const s = makeStyles(colors, typography);

  // Estado bloqueado (no premium)
  if (!isPremium) {
    return (
      <View style={s.container}>
        <View style={[s.gradient, { backgroundColor: colors.surface }]}>
          <View style={s.content}>
            <View style={s.iconContainer}>
              <MaterialCommunityIcons
                name="star"
                size={24}
                color={colors.textSecondary}
              />
            </View>
            <View style={s.textContainer}>
              <Text style={s.title}>Smart Coach Premium</Text>
              <Text style={s.body}>
                Obtén recomendaciones personalizadas basadas en tu progreso y la hora del día.
              </Text>
            </View>
            <Pressable
              onPress={() => {
                onUpgrade?.();
                // TODO: Navegar a pantalla de suscripción
                router.push("/(tabs)/settings");
              }}
              style={({ pressed }) => [
                s.upgradeButton,
                pressed && s.upgradeButtonPressed,
              ]}
            >
              <Text style={s.upgradeButtonText}>Ver más</Text>
              <MaterialCommunityIcons
                name="arrow-right"
                size={16}
                color={colors.brand}
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
        <View style={[s.gradient, s.loadingContainer]}>
          <ActivityIndicator size="small" color={colors.brand} />
          <Text style={s.loadingText}>Analizando tu progreso...</Text>
        </View>
      </View>
    );
  }

  // Sin recomendación (meta exacta o sin datos suficientes)
  if (!recommendation) {
    return null;
  }

  // Recomendación de comida
  if (recommendation.type === "food") {
    return (
      <View style={s.container}>
        <View
          style={[
            s.gradient,
            s.foodGradient,
            { backgroundColor: colors.brand + "15" },
          ]}
        >
          <View style={s.content}>
            <View style={s.iconContainer}>
              <MaterialCommunityIcons
                name="food-apple"
                size={24}
                color={colors.brand}
              />
            </View>
            <View style={s.textContainer}>
              <Text style={s.title}>Recomendación de Comida</Text>
              <Text style={s.body}>{recommendation.message}</Text>
              {recommendation.foods.length > 0 && (
                <View style={s.foodsContainer}>
                  {recommendation.foods.map((food, index) => (
                    <Pressable
                      key={food.id}
                      onPress={() => {
                        router.push({
                          pathname: "/(tabs)/add-food",
                          params: { foodId: food.id },
                        });
                      }}
                      style={({ pressed }) => [
                        s.foodItem,
                        pressed && s.foodItemPressed,
                      ]}
                    >
                      <Text style={s.foodItemText}>
                        {food.name_es}
                        {index < recommendation.foods.length - 1 ? ", " : ""}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  }

  // Recomendación de ejercicio
  if (recommendation.type === "exercise") {
    return (
      <View style={s.container}>
        <View
          style={[
            s.gradient,
            s.exerciseGradient,
            { backgroundColor: colors.cta + "15" },
          ]}
        >
          <View style={s.content}>
            <View style={s.iconContainer}>
              <MaterialCommunityIcons
                name="dumbbell"
                size={24}
                color={colors.cta}
              />
            </View>
            <View style={s.textContainer}>
              <Text style={s.title}>Recomendación de Ejercicio</Text>
              <Text style={s.body}>{recommendation.message}</Text>
              <View style={s.exercisesContainer}>
                {recommendation.exercises.map(({ exercise, minutesNeeded }) => (
                  <View key={exercise.id} style={s.exerciseItem}>
                    <MaterialCommunityIcons
                      name={(exercise.icon_name as any) || "run"}
                      size={20}
                      color={colors.cta}
                    />
                    <Text style={s.exerciseItemText}>
                      {exercise.name_es}: {minutesNeeded} min
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

  return null;
}

function makeStyles(colors: any, typography: any) {
  return StyleSheet.create({
    container: {
      marginHorizontal: 16,
      marginVertical: 8,
      borderRadius: 16,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
    },
    gradient: {
      padding: 16,
      borderRadius: 16,
    },
    foodGradient: {
      borderLeftWidth: 4,
      borderLeftColor: colors.brand,
    },
    exerciseGradient: {
      borderLeftWidth: 4,
      borderLeftColor: colors.cta,
    },
    loadingContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 24,
      gap: 12,
    },
    loadingText: {
      ...typography.body,
      color: colors.textSecondary,
    },
    content: {
      flexDirection: "row",
      gap: 12,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    textContainer: {
      flex: 1,
      gap: 6,
    },
    title: {
      ...typography.subtitle,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    body: {
      ...typography.body,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    upgradeButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: colors.surface,
    },
    upgradeButtonPressed: {
      opacity: 0.7,
    },
    upgradeButtonText: {
      ...typography.caption,
      fontWeight: "600",
      color: colors.brand,
    },
    foodsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginTop: 8,
      gap: 4,
    },
    foodItem: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: colors.surface,
    },
    foodItemPressed: {
      opacity: 0.7,
    },
    foodItemText: {
      ...typography.caption,
      color: colors.brand,
      fontWeight: "500",
    },
    exercisesContainer: {
      marginTop: 8,
      gap: 8,
    },
    exerciseItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: colors.surface,
    },
    exerciseItemText: {
      ...typography.caption,
      color: colors.textPrimary,
      fontWeight: "500",
    },
  });
}
