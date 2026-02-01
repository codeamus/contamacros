import type { MealType } from "@/domain/models/foodLogDb";
import { useTheme } from "@/presentation/theme/ThemeProvider";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { MealRow } from "./MealRow";

type MealData = { count: number; calories: number };

type MealsSectionProps = {
  breakfast: MealData;
  lunch: MealData;
  dinner: MealData;
  snack: MealData;
  totalCalories: number;
  loading: boolean;
  cardAnimation: Animated.Value | null | undefined;
};

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 14 },
  sectionAction: { fontSize: 13 },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  divider: { height: 1, opacity: 0.7 },
});

export function MealsSection({
  breakfast,
  lunch,
  dinner,
  snack,
  totalCalories,
  loading,
  cardAnimation,
}: MealsSectionProps) {
  const { theme } = useTheme();
  const { colors, typography } = theme;

  const navigateToDiary = (meal: MealType) => {
    router.push({
      pathname: "/(tabs)/diary",
      params: { meal },
    });
  };

  const navigateToAddFood = (meal: MealType) => {
    router.push({
      pathname: "/(tabs)/add-food",
      params: { meal },
    });
  };

  return (
    <>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <MaterialCommunityIcons
            name="silverware-fork-knife"
            size={18}
            color={colors.textPrimary}
          />
          <Text
            style={[
              styles.sectionTitle,
              {
                fontFamily: typography.subtitle?.fontFamily,
                color: colors.textPrimary,
              },
            ]}
          >
            Comidas
          </Text>
        </View>
        <Pressable onPress={() => router.push("/(tabs)/diary")}>
          <Text
            style={[
              styles.sectionAction,
              {
                fontFamily: typography.body?.fontFamily,
                color: colors.brand,
              },
            ]}
          >
            Ver todo
          </Text>
        </Pressable>
      </View>

      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
          cardAnimation && {
            opacity: cardAnimation,
            transform: [
              {
                translateY: cardAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0],
                }),
              },
            ],
          },
        ]}
      >
        <MealRow
          title="Desayuno"
          icon="coffee"
          count={breakfast.count}
          kcal={breakfast.calories}
          totalKcal={totalCalories}
          loading={loading}
          onOpen={() => navigateToDiary("breakfast")}
          onAdd={() => navigateToAddFood("breakfast")}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <MealRow
          title="Almuerzo"
          icon="food"
          count={lunch.count}
          kcal={lunch.calories}
          totalKcal={totalCalories}
          loading={loading}
          onOpen={() => navigateToDiary("lunch")}
          onAdd={() => navigateToAddFood("lunch")}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <MealRow
          title="Cena"
          icon="food-variant"
          count={dinner.count}
          kcal={dinner.calories}
          totalKcal={totalCalories}
          loading={loading}
          onOpen={() => navigateToDiary("dinner")}
          onAdd={() => navigateToAddFood("dinner")}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <MealRow
          title="Snack"
          icon="food-apple"
          count={snack.count}
          kcal={snack.calories}
          totalKcal={totalCalories}
          loading={loading}
          onOpen={() => navigateToDiary("snack")}
          onAdd={() => navigateToAddFood("snack")}
        />
      </Animated.View>
    </>
  );
}
